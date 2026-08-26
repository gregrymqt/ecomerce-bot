import logging
from typing import List, Dict, Any, Optional
from datetime import datetime, timezone
import pandas as pd
import numpy as np

logger = logging.getLogger(__name__)

class ChurnPredictor:
    """
    Classificador de Risco de Churn (Evasão de Clientes) para e-commerce.
    Utiliza modelagem probabilística com base no ciclo de recompra histórico do cliente,
    dias de inatividade e volume transacional.
    """

    def predict_churn(self, transactions: List[Dict[str, Any]], inactive_threshold_days: int = 90) -> Dict[str, Any]:
        """
        Calcula a probabilidade de churn e categoriza o nível de risco de cada cliente.
        """
        if not transactions:
            return {"predictions": [], "summary": {"at_risk_count": 0, "healthy_count": 0}}

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

        if not data:
            return {"predictions": [], "summary": {"at_risk_count": 0, "healthy_count": 0}}

        df = pd.DataFrame(data)
        ref_date = df['order_date'].max()

        # Agrupa pedidos ordenados por cliente
        df_sorted = df.sort_values(by=['customer_id', 'order_date'])

        predictions = []
        for cust_id, group in df_sorted.groupby('customer_id'):
            order_count = len(group)
            total_spent = float(group['amount'].sum())
            last_order_date = group['order_date'].max()
            recency_days = max(0, (ref_date - last_order_date).days)

            # Calcula intervalo médio entre compras para clientes recorrentes
            if order_count > 1:
                intervals = group['order_date'].diff().dropna().apply(lambda x: x.days)
                avg_interval_days = max(1.0, float(intervals.mean()))
            else:
                avg_interval_days = float(inactive_threshold_days / 2.0)

            # Relação entre a recência atual e o ciclo esperado de recompra
            cycle_ratio = recency_days / avg_interval_days

            # Função logística sigmoide calibrada para e-commerce
            # z = b0 + b1*cycle_ratio + b2*(recency / threshold)
            z = -2.0 + 1.2 * cycle_ratio + 1.5 * (recency_days / max(1, inactive_threshold_days))
            churn_prob = 1.0 / (1.0 + np.exp(-z))
            churn_prob = float(np.clip(churn_prob, 0.01, 0.99))

            # Classificação de Risco e Ação Recomendada
            if churn_prob >= 0.80:
                risk_level = "CRITICAL"
                action = "DISPATCH_URGENT_RETENTION_COUPON"
            elif churn_prob >= 0.55:
                risk_level = "HIGH"
                action = "SEND_WINBACK_EMAIL_SEQUENCE"
            elif churn_prob >= 0.30:
                risk_level = "MEDIUM"
                action = "SEND_PRODUCT_RECOMMENDATION"
            else:
                risk_level = "LOW"
                action = "MAINTAIN_STANDARD_NURTURING"

            predictions.append({
                "customerId": cust_id,
                "recencyDays": int(recency_days),
                "frequency": int(order_count),
                "totalSpent": round(total_spent, 2),
                "avgRepurchaseCycleDays": round(avg_interval_days, 1),
                "churnProbability": round(churn_prob, 4),
                "riskLevel": risk_level,
                "recommendedAction": action
            })

        # Sumário
        at_risk_count = sum(1 for p in predictions if p["riskLevel"] in ["HIGH", "CRITICAL"])
        healthy_count = sum(1 for p in predictions if p["riskLevel"] in ["LOW", "MEDIUM"])

        return {
            "predictions": sorted(predictions, key=lambda x: x["churnProbability"], reverse=True),
            "summary": {
                "total_analyzed": len(predictions),
                "at_risk_count": at_risk_count,
                "healthy_count": healthy_count,
                "avg_churn_risk_global": round(float(np.mean([p["churnProbability"] for p in predictions])), 4)
            }
        }
