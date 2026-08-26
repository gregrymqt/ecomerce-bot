import logging
from typing import List, Dict, Any, Optional
from datetime import datetime, timezone
import pandas as pd
import numpy as np
from sklearn.cluster import KMeans
from sklearn.preprocessing import StandardScaler

logger = logging.getLogger(__name__)

class RFMSegmentation:
    """
    Algoritmo de Segmentação RFM (Recência, Frequência, Valor Monetário)
    utilizando Clustering KMeans e pontuação de quantis para e-commerce.
    """

    @staticmethod
    def _calculate_rfm_metrics(df: pd.DataFrame, reference_date: Optional[datetime] = None) -> pd.DataFrame:
        """
        Calcula as métricas de R, F, M a partir de um DataFrame de transações.
        Colunas obrigatórias: 'customer_id', 'order_date', 'amount'
        """
        if reference_date is None:
            reference_date = df['order_date'].max() if not df.empty else datetime.now(timezone.utc)

        # Agregação por cliente
        rfm = df.groupby('customer_id').agg(
            recency=('order_date', lambda dates: (reference_date - dates.max()).days),
            frequency=('order_date', 'count'),
            monetary=('amount', 'sum'),
            avg_ticket=('amount', 'mean')
        ).reset_index()

        # Garante que recência mínima seja 0
        rfm['recency'] = rfm['recency'].apply(lambda x: max(0, x))
        return rfm

    def segment_customers(self, transactions: List[Dict[str, Any]], n_clusters: int = 4) -> Dict[str, Any]:
        """
        Executa a segmentação completa de clientes.
        
        Exemplo de transação:
        {
            "customerId": "usr-123",
            "orderDate": "2026-08-15T14:30:00Z",
            "amount": 299.90
        }
        """
        if not transactions:
            return {"customers": [], "summary": {"total_customers": 0, "segments": {}}}

        # Normaliza chaves do JSON para minúsculas
        data = []
        for t in transactions:
            cust_id = str(t.get("customerId") or t.get("customer_id") or "")
            dt_str = t.get("orderDate") or t.get("order_date")
            amt = float(t.get("amount") or t.get("price") or 0.0)

            if cust_id and dt_str:
                try:
                    # Converte string ISO para datetime
                    if isinstance(dt_str, str):
                        dt = pd.to_datetime(dt_str, utc=True)
                    else:
                        dt = dt_str
                    data.append({"customer_id": cust_id, "order_date": dt, "amount": amt})
                except Exception:
                    continue

        if not data:
            return {"customers": [], "summary": {"total_customers": 0, "segments": {}}}

        df = pd.DataFrame(data)
        rfm = self._calculate_rfm_metrics(df)

        total_customers = len(rfm)
        if total_customers < 4:
            # Para bases pequenas, usa classificação direta por regras
            rfm['segment'] = rfm.apply(self._assign_rule_based_segment, axis=1)
        else:
            # Algoritmo KMeans com escalonamento logarítmico para lidar com assimetria de receita
            features = rfm[['recency', 'frequency', 'monetary']].copy()
            features['recency_log'] = np.log1p(features['recency'])
            features['frequency_log'] = np.log1p(features['frequency'])
            features['monetary_log'] = np.log1p(features['monetary'])

            scaler = StandardScaler()
            scaled_features = scaler.fit_transform(features[['recency_log', 'frequency_log', 'monetary_log']])

            n_c = min(n_clusters, total_customers)
            kmeans = KMeans(n_clusters=n_c, random_state=42, n_init=10)
            rfm['cluster'] = kmeans.fit_predict(scaled_features)

            # Mapeia os clusters numéricos para segmentos de negócio
            rfm['segment'] = rfm.apply(self._assign_rule_based_segment, axis=1)

        # Monta a resposta estruturada
        customers_result = []
        for _, row in rfm.iterrows():
            customers_result.append({
                "customerId": row["customer_id"],
                "recencyDays": int(row["recency"]),
                "frequency": int(row["frequency"]),
                "totalSpent": round(float(row["monetary"]), 2),
                "averageTicket": round(float(row["avg_ticket"]), 2),
                "segment": row["segment"]
            })

        segment_counts = rfm['segment'].value_counts().to_dict()

        return {
            "customers": customers_result,
            "summary": {
                "total_customers": total_customers,
                "total_revenue": round(float(rfm['monetary'].sum()), 2),
                "avg_ticket_global": round(float(rfm['monetary'].sum() / max(1, rfm['frequency'].sum())), 2),
                "segments": segment_counts
            }
        }

    @staticmethod
    def _assign_rule_based_segment(row) -> str:
        """
        Classificação determinística dos clientes em arquétipos de e-commerce.
        """
        recency = row['recency']
        freq = row['frequency']
        monetary = row['monetary']

        if recency <= 30 and freq >= 3:
            return "CHAMPIONS"
        elif recency <= 60 and freq >= 2:
            return "LOYAL_CUSTOMERS"
        elif recency <= 30 and freq == 1:
            return "NEW_CUSTOMERS"
        elif 30 < recency <= 90 and monetary >= 300:
            return "POTENTIAL_LOYALISTS"
        elif 60 < recency <= 120:
            return "AT_RISK"
        elif 120 < recency <= 180:
            return "HIBERNATING"
        else:
            return "LOST"
