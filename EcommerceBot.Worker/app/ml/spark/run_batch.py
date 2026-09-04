import os
import sys
import json
import argparse
from datetime import datetime, timezone, timedelta
import random

from app.ml.spark.batch_pipeline import SparkBatchPipeline

def generate_synthetic_transactions(n_customers: int = 150, n_orders: int = 800):
    """
    Gera histórico sintético realista de transações de e-commerce para calibração de modelos.
    """
    now = datetime.now(timezone.utc)
    customers = [f"cust_{i:04d}" for i in range(1, n_customers + 1)]
    transactions = []

    for _ in range(n_orders):
        cust = random.choice(customers)
        days_ago = random.expovariate(1 / 45) # Distribuição exponencial com média de 45 dias
        order_date = (now - timedelta(days=min(365, days_ago))).isoformat()
        amount = round(random.lognormvariate(4.5, 0.8), 2) # Distribuição log-normal realista de ticket
        amount = max(19.90, min(amount, 3500.00))

        transactions.append({
            "customerId": cust,
            "orderDate": order_date,
            "amount": amount
        })

    return transactions

if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8")

def upload_artifacts_to_r2(metrics: dict, report_path: str, latest_report_path: str) -> bool:
    """
    Envia artefatos serializados (.joblib, metadata.json, relatórios) para o Cloudflare R2
    utilizando a API compatível com S3 (boto3).
    """
    account_id = os.environ.get("R2_ACCOUNT_ID")
    access_key = os.environ.get("R2_ACCESS_KEY_ID")
    secret_key = os.environ.get("R2_SECRET_ACCESS_KEY")
    bucket = os.environ.get("R2_BUCKET_NAME", "ecommerce-bot-backups")

    if not account_id or not access_key or not secret_key:
        print("[R2 UPLOAD] ⚠️ Credenciais do Cloudflare R2 não configuradas no ambiente (R2_ACCOUNT_ID, etc).")
        return False

    try:
        import boto3
    except ImportError:
        print("[R2 UPLOAD] ⚠️ Biblioteca 'boto3' não encontrada. Instale via: pip install boto3")
        return False

    endpoint_url = f"https://{account_id}.r2.cloudflarestorage.com"
    timestamp = datetime.now(timezone.utc).strftime("%Y%m%d_%H%M%S")

    files_to_upload = []
    artifact_path = metrics.get("artifact_path")
    if artifact_path and os.path.exists(artifact_path):
        files_to_upload.append(artifact_path)
    meta_path = os.path.join(os.path.dirname(artifact_path), "rfm_pipeline_metadata.json") if artifact_path else None
    if meta_path and os.path.exists(meta_path):
        files_to_upload.append(meta_path)
    if report_path and os.path.exists(report_path):
        files_to_upload.append(report_path)
    if latest_report_path and os.path.exists(latest_report_path):
        files_to_upload.append(latest_report_path)

    try:
        print(f"[R2 UPLOAD] Sincronizando {len(files_to_upload)} arquivos com Cloudflare R2 ({bucket})...")
        s3 = boto3.client(
            "s3",
            endpoint_url=endpoint_url,
            aws_access_key_id=access_key,
            aws_secret_access_key=secret_key,
            region_name="auto"
        )
        for fpath in files_to_upload:
            fname = os.path.basename(fpath)
            # Versão histórica
            s3.upload_file(fpath, bucket, f"ml-artifacts/rfm/{timestamp}/{fname}")
            # Versão latest para consumo imediato da VPS
            s3.upload_file(fpath, bucket, f"ml-artifacts/rfm/latest/{fname}")
            print(f"   [R2] Uploaded: {fname} -> s3://{bucket}/ml-artifacts/rfm/latest/{fname}")

        print(f"[R2 UPLOAD] ✅ Artefatos sincronizados com Cloudflare R2 com sucesso!")
        return True
    except Exception as e:
        print(f"[R2 UPLOAD] ❌ Falha ao enviar artefatos para o R2: {e}")
        return False

def main():
    parser = argparse.ArgumentParser(description="Executa o pipeline Spark Batch de treino e gera relatório para o NotebookLM.")
    parser.add_argument("--input", type=str, help="Caminho para arquivo JSON de transações. Se omitido, gera dataset sintético.")
    parser.add_argument("--clusters", type=int, default=4, help="Número de clusters RFM (padrão: 4).")
    parser.add_argument("--output-report", type=str, help="Caminho para o relatório Markdown do NotebookLM.")
    parser.add_argument("--upload-r2", action="store_true", help="Faz upload automático dos artefatos para o Cloudflare R2 (S3 API).")
    args = parser.parse_args()

    pipeline = SparkBatchPipeline()

    if args.input and os.path.exists(args.input):
        print(f"[INPUT] Carregando transações reais de: {args.input}")
        with open(args.input, "r", encoding="utf-8") as f:
            transactions = json.load(f)
    else:
        print("[DATA] Gerando dataset sintético para calibração...")
        transactions = generate_synthetic_transactions()

    print(f"[BATCH] Treinando pipeline Spark RFM com {len(transactions)} transações...")
    metrics = pipeline.train_rfm_pipeline(transactions, n_clusters=args.clusters)

    report_path = args.output_report
    if not report_path:
        reports_dir = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(os.path.dirname(os.path.dirname(__file__))))), "docs", "notebooklm", "reports")
        os.makedirs(reports_dir, exist_ok=True)
        date_str = datetime.now(timezone.utc).strftime("%Y%m%d")
        report_path = os.path.join(reports_dir, f"metrics_report_{date_str}.md")

    report_content = pipeline.generate_notebooklm_report(metrics, output_path=report_path)

    # Salva cópia canônica latest_metrics_report.md para o recurso MCP resource://ml/latest-metrics
    latest_report_path = os.path.join(reports_dir, "latest_metrics_report.md")
    try:
        with open(latest_report_path, "w", encoding="utf-8") as f:
            f.write(report_content)
    except Exception as e:
        print(f"[WARN] Não foi possível salvar latest_metrics_report.md: {e}")

    print(f"[OK] Calibração concluída com sucesso!")
    print(f"[ARTIFACT] Artefato exportado: {metrics.get('artifact_path')}")
    print(f"[NOTEBOOKLM] Relatório NotebookLM: {report_path}")
    print(f"[NOTEBOOKLM] Ponteiro MCP: {latest_report_path}")
    print(f"[METRIC] Silhouette Score: {metrics.get('silhouette_score', 0):.4f}")

    # Upload para Cloudflare R2 se solicitado por flag ou env var
    if args.upload_r2 or os.environ.get("AUTO_UPLOAD_R2", "").lower() == "true":
        upload_artifacts_to_r2(metrics, report_path, latest_report_path)

if __name__ == "__main__":
    main()

