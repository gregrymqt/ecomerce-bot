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

def main():
    parser = argparse.ArgumentParser(description="Executa o pipeline Spark Batch de treino e gera relatório para o NotebookLM.")
    parser.add_argument("--input", type=str, help="Caminho para arquivo JSON de transações. Se omitido, gera dataset sintético.")
    parser.add_argument("--clusters", type=int, default=4, help="Número de clusters RFM (padrão: 4).")
    parser.add_argument("--output-report", type=str, help="Caminho para o relatório Markdown do NotebookLM.")
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

    print(f"[OK] Calibração concluída com sucesso!")
    print(f"[ARTIFACT] Artefato exportado: {metrics.get('artifact_path')}")
    print(f"[NOTEBOOKLM] Relatório NotebookLM: {report_path}")
    print(f"[METRIC] Silhouette Score: {metrics.get('silhouette_score', 0):.4f}")

if __name__ == "__main__":
    main()
