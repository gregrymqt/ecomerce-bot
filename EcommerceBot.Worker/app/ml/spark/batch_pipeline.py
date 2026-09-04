import os
import json
import logging
from typing import List, Dict, Any, Optional
from datetime import datetime, timezone
import pandas as pd
import numpy as np
import joblib
from sklearn.cluster import KMeans
from sklearn.preprocessing import StandardScaler
from sklearn.metrics import silhouette_score

logger = logging.getLogger(__name__)

ARTIFACTS_DIR = os.path.join(os.path.dirname(os.path.dirname(__file__)), "models", "artifacts")

class SparkBatchPipeline:
    """
    Pipeline de processamento analítico em lote (Batch & Data Plane) compatível com PySpark / Spark Jobs.
    Treina e calibra os centróides de clusterização RFM, exporta artefatos serializados (.joblib)
    para o Worker de inferência em produção e gera relatórios para o Google NotebookLM.
    """

    def __init__(self, artifacts_dir: str = ARTIFACTS_DIR):
        self.artifacts_dir = artifacts_dir
        os.makedirs(self.artifacts_dir, exist_ok=True)

    def train_rfm_pipeline(self, transactions: List[Dict[str, Any]], n_clusters: int = 4) -> Dict[str, Any]:
        """
        Executa o treinamento em lote com cálculo de centróides e silhueta.
        Salva o pipeline serializado em self.artifacts_dir/rfm_pipeline.joblib.
        """
        if not transactions or len(transactions) < n_clusters:
            logger.warning("Volume insuficiente de transações para calibração em lote.")
            return {"status": "INSUFFICIENT_DATA", "metrics": {}}

        data = []
        for t in transactions:
            cust_id = str(t.get("customerId") or t.get("customer_id") or "")
            dt_str = t.get("orderDate") or t.get("order_date")
            amt = float(t.get("amount") or t.get("price") or 0.0)

            if cust_id and dt_str:
                try:
                    dt = pd.to_datetime(dt_str, utc=True) if isinstance(dt_str, str) else dt_str
                    data.append({"customer_id": cust_id, "order_date": dt, "amount": amt})
                except Exception:
                    continue

        df = pd.DataFrame(data)
        ref_date = df['order_date'].max()

        # Agregação RFM
        rfm = df.groupby('customer_id').agg(
            recency=('order_date', lambda dates: (ref_date - dates.max()).days),
            frequency=('order_date', 'count'),
            monetary=('amount', 'sum'),
            avg_ticket=('amount', 'mean')
        ).reset_index()

        rfm['recency'] = rfm['recency'].apply(lambda x: max(0, x))

        features = ['recency', 'frequency', 'monetary']
        X = rfm[features].copy()

        # Normalização logarítmica para estabilização de assimetria
        X_log = np.log1p(X)

        scaler = StandardScaler()
        X_scaled = scaler.fit_transform(X_log)

        kmeans = KMeans(n_clusters=n_clusters, random_state=42, n_init=10)
        clusters = kmeans.fit_predict(X_scaled)
        rfm['cluster'] = clusters

        # Avaliação de qualidade do agrupamento
        sil_score = -1.0
        if len(rfm) > n_clusters:
            try:
                sil_score = float(silhouette_score(X_scaled, clusters))
            except Exception:
                pass

        # Atribuição semântica de perfis de negócio com base nos centróides
        cluster_profiles = {}
        for c in range(n_clusters):
            c_data = rfm[rfm['cluster'] == c]
            cluster_profiles[c] = {
                "count": int(len(c_data)),
                "avg_recency_days": round(float(c_data['recency'].mean()), 1),
                "avg_frequency": round(float(c_data['frequency'].mean()), 1),
                "avg_monetary": round(float(c_data['monetary'].mean()), 2),
                "total_revenue": round(float(c_data['monetary'].sum()), 2)
            }

        # Ordena clusters pelo valor médio monetário para rotulação
        sorted_by_value = sorted(cluster_profiles.keys(), key=lambda k: cluster_profiles[k]['avg_monetary'], reverse=True)
        label_names = ["Campeões (VIP)", "Clientes Fiéis", "Em Risco", "Inativos / Ocasionais"]
        cluster_labels = {c: label_names[i] if i < len(label_names) else f"Segmento {c}" for i, c in enumerate(sorted_by_value)}

        for c, label in cluster_labels.items():
            cluster_profiles[c]["label"] = label

        # Exportação determinística de artefato para o Worker de inferência
        artifact_path = os.path.join(self.artifacts_dir, "rfm_pipeline.joblib")
        trained_at_iso = datetime.now(timezone.utc).isoformat()
        joblib.dump({
            "scaler": scaler,
            "kmeans": kmeans,
            "cluster_labels": cluster_labels,
            "trained_at": trained_at_iso,
            "n_samples": len(rfm),
            "silhouette_score": sil_score
        }, artifact_path)

        # Exportação do manifesto JSON desacoplado para telemetria via MCP
        metadata_path = os.path.join(self.artifacts_dir, "rfm_pipeline_metadata.json")
        metadata = {
            "model": "RFM_KMeans",
            "version": "1.0",
            "trainedAt": trained_at_iso,
            "sampleCount": len(rfm),
            "clusterCount": n_clusters,
            "silhouetteScore": sil_score,
            "totalRevenue": round(float(rfm['monetary'].sum()), 2),
            "artifactPath": artifact_path,
            "status": "HEALTHY" if sil_score >= 0.35 else "WARNING_LOW_SILHOUETTE",
            "clusterDistribution": {
                str(c): {
                    "label": p.get("label", f"Cluster {c}"),
                    "count": p.get("count", 0),
                    "percentage": round((p.get("count", 0) / len(rfm) * 100), 2) if len(rfm) > 0 else 0
                }
                for c, p in cluster_profiles.items()
            }
        }
        with open(metadata_path, "w", encoding="utf-8") as f:
            json.dump(metadata, f, indent=2, ensure_ascii=False)

        logger.info(f"✅ [SparkBatchPipeline] Artefato serializado salvo com sucesso em: {artifact_path}")
        logger.info(f"📊 [SparkBatchPipeline] Manifesto de telemetria MCP salvo em: {metadata_path}")

        metrics = {
            "status": "CALIBRATED",
            "total_customers": len(rfm),
            "total_revenue": round(float(rfm['monetary'].sum()), 2),
            "silhouette_score": sil_score,
            "artifact_path": artifact_path,
            "profiles": cluster_profiles
        }

        return metrics

    def generate_notebooklm_report(self, metrics: Dict[str, Any], output_path: Optional[str] = None) -> str:
        """
        Gera um relatório estruturado em Markdown otimizado para ingestão no Google NotebookLM.
        Zero PII (dados 100% agregados por perfil e métricas de distribuição).
        """
        now_str = datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M:%S UTC")
        profiles = metrics.get("profiles", {})
        total_customers = metrics.get("total_customers", 0)
        total_revenue = metrics.get("total_revenue", 0.0)
        sil_score = metrics.get("silhouette_score", 0.0)

        lines = [
            f"# 📊 Relatório Executivo de Inteligência Analítica & RFM",
            f"**Gerado em:** {now_str}",
            f"**Ambiente:** Google Spark / PySpark Batch Calibration",
            f"**Finalidade:** Grounding e Estudo Cognitivo no Google NotebookLM",
            "",
            "---",
            "",
            "## 📌 1. Sumário Executivo do E-commerce",
            f"- **Base Total de Clientes Analisados:** {total_customers}",
            f"- **Faturamento Consolidado:** R$ {total_revenue:,.2f}",
            f"- **Qualidade do Agrupamento (Silhouette Score):** {sil_score:.4f} (Ideal > 0.35)",
            "",
            "---",
            "",
            "## 👥 2. Perfil dos Segmentos Identificados",
            "",
            "| Segmento | Clientes | % da Base | Ticket Médio | Recência Média (dias) | Faturamento Total |",
            "|---|---|---|---|---|---|"
        ]

        for c, p in profiles.items():
            pct = (p['count'] / total_customers * 100) if total_customers > 0 else 0
            lines.append(
                f"| **{p.get('label', 'Segmento')}** | {p['count']} | {pct:.1f}% | R$ {p['avg_monetary']:,.2f} | {p['avg_recency_days']} dias | R$ {p['total_revenue']:,.2f} |"
            )

        lines.extend([
            "",
            "---",
            "",
            "## 💡 3. Recomendações Táticas por Cluster",
            "- **Campeões (VIP):** Criar programa de fidelidade exclusivo, acesso antecipado a lançamentos e atendimento prioritário.",
            "- **Clientes Fiéis:** Campanhas de cross-sell e upsell recomendando produtos complementares aos pedidos habituais.",
            "- **Em Risco:** Disparo de e-mails transacionais com cupons de reativação por tempo limitado.",
            "- **Inativos / Ocasionais:** Campanhas de remarketing de baixo custo e pesquisas de satisfação.",
            "",
            "---",
            "",
            "## 🤖 4. Prompts de Estudo Recomendados para o Google NotebookLM",
            "Cole este relatório no seu caderno do NotebookLM e pergunte:",
            "1. *'Qual cluster concentra o maior faturamento e qual a estratégia ideal para blindá-lo?'*",
            "2. *'Qual a taxa de clientes em risco e qual o impacto financeiro estimado caso eles evadam?'*",
            "3. *'Gere um script de áudio/podcast resumindo a saúde da carteira de clientes para a diretoria.'*",
            ""
        ])

        report_content = "\n".join(lines)

        if output_path:
            os.makedirs(os.path.dirname(os.path.abspath(output_path)), exist_ok=True)
            with open(output_path, "w", encoding="utf-8") as f:
                f.write(report_content)
            logger.info(f"📄 Relatório NotebookLM salvo em: {output_path}")

        return report_content
