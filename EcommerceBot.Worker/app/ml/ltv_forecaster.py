import logging
from typing import List, Dict, Any, Optional
from datetime import datetime, timezone
import pandas as pd
import numpy as np

logger = logging.getLogger(__name__)

class LTVForecaster:
    """
    Algoritmo de Projeção de LTV Transacional B2B para Pacotes de Recarga de Quotas IA.
    Calcula o LTV como: Ticket Médio por Recarga * Frequência Anual de Recargas * Tempo Médio de Atividade.
    Estima a receita esperada de cada cliente para os próximos 3, 6 e 12 meses
    utilizando a taxa histórica de recarga, ticket médio e decaimento de retenção.
    """

    def forecast_ltv(self, transactions: List[Dict[str, Any]]) -> Dict[str, Any]:
        """
        Calcula o LTV histórico e projeta a receita futura por cliente e para a base inteira.
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

            # Fórmula Transacional B2B de Recargas:
            # LTV = Ticket Médio por Recarga * Frequência Anual de Recargas * Tempo Médio de Atividade (Lifespan)
            customer_age_years = max(30.0, float(customer_age_days)) / 365.0
            annual_recharge_frequency = max(1.0, float(order_count) / customer_age_years)
            recency_retention = float(np.exp(-0.01 * recency_days))
            expected_lifespan_years = max(0.5, 2.0 * recency_retention)
            projected_ltv = round(float(avg_ticket * annual_recharge_frequency * expected_lifespan_years), 2)

            # Projeção de recargas futuras esperadas por horizonte temporal
            expected_recharges_3m = max(0.1, (annual_recharge_frequency / 4.0) * recency_retention)
            expected_recharges_6m = max(0.15, (annual_recharge_frequency / 2.0) * recency_retention)
            expected_recharges_12m = max(0.2, annual_recharge_frequency * recency_retention)

            predicted_rev_3m = round(float(expected_recharges_3m * avg_ticket), 2)
            predicted_rev_6m = round(float(expected_recharges_6m * avg_ticket), 2)
            predicted_rev_12m = round(float(expected_recharges_12m * avg_ticket), 2)

            # Tier de Valor do Cliente baseado em gasto histórico e LTV projetado
            if total_spent >= 1500 or projected_ltv >= 1500:
                tier = "DIAMOND"
            elif total_spent >= 600 or projected_ltv >= 600:
                tier = "GOLD"
            elif total_spent >= 200 or projected_ltv >= 200:
                tier = "SILVER"
            else:
                tier = "BRONZE"

            forecasts.append({
                "customerId": cust_id,
                "historicalLtv": round(total_spent, 2),
                "averageTicket": round(avg_ticket, 2),
                "orderCount": order_count,
                "annualRechargeFrequency": round(float(annual_recharge_frequency), 2),
                "expectedLifespanYears": round(float(expected_lifespan_years), 2),
                "projectedLtv": projected_ltv,
                "projectedRevenue3m": predicted_rev_3m,
                "projectedRevenue6m": predicted_rev_6m,
                "projectedRevenue12m": predicted_rev_12m,
                "customerTier": tier
            })

        total_3m = sum(f["projectedRevenue3m"] for f in forecasts)
        total_6m = sum(f["projectedRevenue6m"] for f in forecasts)
        total_12m = sum(f["projectedRevenue12m"] for f in forecasts)
        total_projected_ltv = sum(f["projectedLtv"] for f in forecasts)

        return {
            "forecasts": sorted(forecasts, key=lambda x: x["projectedLtv"], reverse=True),
            "summary": {
                "total_customers": len(forecasts),
                "total_historical_revenue": round(float(df['amount'].sum()), 2),
                "projected_total_ltv": round(total_projected_ltv, 2),
                "projected_revenue_3m": round(total_3m, 2),
                "projected_revenue_6m": round(total_6m, 2),
                "projected_revenue_12m": round(total_12m, 2),
                "tier_distribution": pd.Series([f["customerTier"] for f in forecasts]).value_counts().to_dict()
            }
        }
