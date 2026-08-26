import logging
from typing import List, Dict, Any, Optional
from datetime import datetime, timezone
import pandas as pd
import numpy as np

logger = logging.getLogger(__name__)

class LTVForecaster:
    """
    Algoritmo de Projeção de LTV (Customer Lifetime Value) para E-commerce.
    Estima a receita esperada de cada cliente para os próximos 3, 6 e 12 meses
    utilizando a taxa histórica de recompra, ticket médio e decaimento temporal.
    """

    def forecast_ltv(self, transactions: List[Dict[str, Any]]) -> Dict[str, Any]:
        """
        Calcula o LTV histórico e projeta a receita futura por cliente e para a loja inteira.
        """
        if not transactions:
            return {
                "forecasts": [],
                "summary": {
                    "projected_revenue_3m": 0.0,
                    "projected_revenue_6m": 0.0,
                    "projected_revenue_12m": 0.0
                }
            }

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
            return {"forecasts": [], "summary": {"projected_revenue_3m": 0.0, "projected_revenue_6m": 0.0, "projected_revenue_12m": 0.0}}

        df = pd.DataFrame(data)
        ref_date = df['order_date'].max()

        forecasts = []
        for cust_id, group in df.groupby('customer_id'):
            order_count = len(group)
            total_spent = float(group['amount'].sum())
            avg_ticket = total_spent / max(1, order_count)
            first_order = group['order_date'].min()
            last_order = group['order_date'].max()

            customer_age_days = max(1, (ref_date - first_order).days)
            recency_days = max(0, (ref_date - last_order).days)

            # Frequência mensal de compras
            monthly_frequency = (order_count / max(1.0, customer_age_days / 30.0))

            # Fator de retenção exponencial com base na recência recente
            retention_decay = np.exp(-0.015 * recency_days)

            # Projeção de compras futuras esperadas
            expected_orders_3m = max(0.1, monthly_frequency * 3.0 * retention_decay)
            expected_orders_6m = max(0.15, monthly_frequency * 6.0 * retention_decay)
            expected_orders_12m = max(0.2, monthly_frequency * 12.0 * retention_decay)

            predicted_rev_3m = round(float(expected_orders_3m * avg_ticket), 2)
            predicted_rev_6m = round(float(expected_orders_6m * avg_ticket), 2)
            predicted_rev_12m = round(float(expected_orders_12m * avg_ticket), 2)

            # Tier de Valor do Cliente
            if total_spent >= 1500 or predicted_rev_12m >= 1000:
                tier = "DIAMOND"
            elif total_spent >= 600 or predicted_rev_12m >= 500:
                tier = "GOLD"
            elif total_spent >= 200 or predicted_rev_12m >= 200:
                tier = "SILVER"
            else:
                tier = "BRONZE"

            forecasts.append({
                "customerId": cust_id,
                "historicalLtv": round(total_spent, 2),
                "averageTicket": round(avg_ticket, 2),
                "orderCount": order_count,
                "projectedRevenue3m": predicted_rev_3m,
                "projectedRevenue6m": predicted_rev_6m,
                "projectedRevenue12m": predicted_rev_12m,
                "customerTier": tier
            })

        total_3m = sum(f["projectedRevenue3m"] for f in forecasts)
        total_6m = sum(f["projectedRevenue6m"] for f in forecasts)
        total_12m = sum(f["projectedRevenue12m"] for f in forecasts)

        return {
            "forecasts": sorted(forecasts, key=lambda x: x["projectedRevenue12m"], reverse=True),
            "summary": {
                "total_customers": len(forecasts),
                "total_historical_revenue": round(float(df['amount'].sum()), 2),
                "projected_revenue_3m": round(total_3m, 2),
                "projected_revenue_6m": round(total_6m, 2),
                "projected_revenue_12m": round(total_12m, 2),
                "tier_distribution": pd.Series([f["customerTier"] for f in forecasts]).value_counts().to_dict()
            }
        }
