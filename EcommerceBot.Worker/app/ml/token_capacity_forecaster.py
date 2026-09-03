import logging
import math
import statistics
from typing import List, Dict, Any, Optional
from datetime import datetime, timezone

logger = logging.getLogger(__name__)

class TokenCapacityForecaster:
    """
    Motor Preditivo de FinOps & Capacidade de Tokens de IA (DeepSeek, Gemini e OpenRouter).
    Analisa o histórico real de consumo de tokens (Burn Rate ponderado), volatilidade (sigma)
    e saldo remanescente para projetar 3 cenários de compra mensal: Baixa, Recomendada e Segurança.
    """

    SUPPORTED_PROVIDERS = ["DEEPSEEK", "GEMINI", "OPENROUTER"]

    def forecast_capacity(
        self,
        usage_history: List[Dict[str, Any]],
        current_balances: Optional[Dict[str, float]] = None,
        forecast_days: int = 30
    ) -> Dict[str, Any]:
        """
        Executa a projeção estatística de demanda de tokens e custos para o horizonte estipulado.
        
        :param usage_history: Lista de registros diários de consumo (date, provider, tokens, cost_usd)
        :param current_balances: Dicionário contendo o saldo atual em USD por operadora
        :param forecast_days: Horizonte de previsão em dias (padrão 30 dias)
        """
        if current_balances is None:
            current_balances = {}

        # Normaliza saldos
        balances = {
            p: float(current_balances.get(p, 0.0) or current_balances.get(p.lower(), 0.0) or 0.0)
            for p in self.SUPPORTED_PROVIDERS
        }

        # Agrupa histórico por (provedor, data)
        grouped_data = self._group_usage_by_provider(usage_history)

        provider_results = {}
        total_balance = sum(balances.values())

        for provider in self.SUPPORTED_PROVIDERS:
            p_history = grouped_data.get(provider, [])
            provider_results[provider] = self._calculate_provider_forecast(
                provider=provider,
                history=p_history,
                current_balance=balances.get(provider, 0.0),
                forecast_days=forecast_days
            )

        # Projeção Consolidada da Plataforma
        consolidated = self._calculate_consolidated_forecast(provider_results, total_balance, forecast_days)

        return {
            "forecastHorizonDays": forecast_days,
            "generatedAt": datetime.now(timezone.utc).isoformat(),
            "providers": provider_results,
            "consolidated": consolidated
        }

    def _group_usage_by_provider(self, usage_history: List[Dict[str, Any]]) -> Dict[str, List[Dict[str, Any]]]:
        grouped: Dict[str, Dict[str, Dict[str, Any]]] = {}

        for item in usage_history:
            dt_str = item.get("date") or item.get("orderDate") or item.get("createdAt") or ""
            prov = str(item.get("provider") or "").upper().strip()
            tokens = int(item.get("tokens") or item.get("totalTokens") or 0)
            cost = float(item.get("costUsd") or item.get("estimatedCostUsd") or item.get("cost_usd") or 0.0)

            if not prov or not dt_str:
                continue

            # Extrai apenas YYYY-MM-DD
            day_str = str(dt_str)[:10]

            if prov not in grouped:
                grouped[prov] = {}

            if day_str not in grouped[prov]:
                grouped[prov][day_str] = {"date": day_str, "tokens": 0, "cost_usd": 0.0}

            grouped[prov][day_str]["tokens"] += tokens
            grouped[prov][day_str]["cost_usd"] += cost

        # Ordena cada lista cronologicamente
        result: Dict[str, List[Dict[str, Any]]] = {}
        for prov, days_map in grouped.items():
            sorted_days = sorted(days_map.values(), key=lambda x: x["date"])
            result[prov] = sorted_days

        return result

    def _calculate_provider_forecast(
        self,
        provider: str,
        history: List[Dict[str, Any]],
        current_balance: float,
        forecast_days: int
    ) -> Dict[str, Any]:
        """
        Calcula os cenários estatísticos para uma operadora individual.
        """
        n = len(history)

        # Se não houver histórico real suficiente, utiliza baseline proporcional
        if n < 2:
            default_daily_tokens = 50000 if provider == "DEEPSEEK" else 30000 if provider == "GEMINI" else 20000
            default_token_cost = 0.000003 if provider == "DEEPSEEK" else 0.0000025 if provider == "GEMINI" else 0.000005

            daily_burn_tokens = float(default_daily_tokens)
            daily_burn_cost = default_daily_tokens * default_token_cost
            sigma_tokens = default_daily_tokens * 0.30
            growth_rate = 0.10
            median_daily_tokens = default_daily_tokens * 0.85
        else:
            tokens_list = [float(h["tokens"]) for h in history]
            costs_list = [float(h["cost_usd"]) for h in history]

            # Média ponderada com pesos lineares crescentes para dias mais recentes
            weights = [0.6 + 0.8 * (i / max(1, n - 1)) for i in range(n)]
            sum_w = sum(weights)
            daily_burn_tokens = sum(w * t for w, t in zip(weights, tokens_list)) / sum_w
            daily_burn_cost = sum(w * c for w, c in zip(weights, costs_list)) / sum_w

            median_daily_tokens = float(statistics.median(tokens_list))
            sigma_tokens = float(statistics.stdev(tokens_list)) if n > 1 else daily_burn_tokens * 0.25

            # Taxa de crescimento recente (primeira metade vs segunda metade)
            half = max(1, n // 2)
            first_half_avg = sum(tokens_list[:half]) / half
            second_half_avg = sum(tokens_list[half:]) / (n - half)
            raw_growth = (second_half_avg - first_half_avg) / max(1.0, first_half_avg)
            growth_rate = max(-0.20, min(0.60, raw_growth))

        cost_per_token = (daily_burn_cost / max(1.0, daily_burn_tokens)) if daily_burn_tokens > 0 else 0.000003

        # 1. Cenário Baixa (Mínimo Basal)
        low_tokens = int(max(1000, median_daily_tokens * forecast_days))
        low_cost = round(low_tokens * cost_per_token, 2)

        # 2. Cenário Recomendada (Tendência Ponderada + Crescimento)
        rec_tokens = int(max(low_tokens, daily_burn_tokens * (1.0 + growth_rate) * forecast_days))
        rec_cost = round(rec_tokens * cost_per_token, 2)

        # 3. Cenário Segurança (Buffer de Pico com 2 Desvios Padrão)
        safety_buffer = int(2.0 * sigma_tokens * math.sqrt(forecast_days))
        safety_tokens = int(rec_tokens + max(5000, safety_buffer))
        safety_cost = round(safety_tokens * cost_per_token, 2)

        # Runway (Autonomia em dias antes do saldo zerar)
        if daily_burn_cost > 0.0001:
            runway_days = round(current_balance / daily_burn_cost, 1)
        else:
            runway_days = 999.0

        is_critical = runway_days < 7.0
        recommended_topup = round(max(0.0, rec_cost - current_balance), 2)

        return {
            "provider": provider,
            "currentBalanceUsd": round(current_balance, 2),
            "dailyBurnRateTokens": int(daily_burn_tokens),
            "dailyBurnRateUsd": round(daily_burn_cost, 4),
            "growthRatePercent": round(growth_rate * 100, 1),
            "runwayDays": runway_days,
            "isCritical": is_critical,
            "recommendedTopupUsd": recommended_topup,
            "scenarios": {
                "low": {
                    "label": "Baixa (Mínimo)",
                    "tokens": low_tokens,
                    "estimatedCostUsd": low_cost,
                    "description": "Consumo basal mínimo sem picos de demanda."
                },
                "recommended": {
                    "label": "Recomendada (Ideal)",
                    "tokens": rec_tokens,
                    "estimatedCostUsd": rec_cost,
                    "description": "Previsão realista considerando crescimento e sazonalidade."
                },
                "safety": {
                    "label": "Segurança (Buffer de Pico)",
                    "tokens": safety_tokens,
                    "estimatedCostUsd": safety_cost,
                    "description": "Margem de 95% para absorver surtos e scraping intensivo sem travar."
                }
            }
        }

    def _calculate_consolidated_forecast(
        self,
        provider_results: Dict[str, Any],
        total_balance: float,
        forecast_days: int
    ) -> Dict[str, Any]:
        """
        Consolida os cenários de todas as operadoras em uma visão geral da plataforma.
        """
        tot_burn_tokens = sum(p["dailyBurnRateTokens"] for p in provider_results.values())
        tot_burn_cost = sum(p["dailyBurnRateUsd"] for p in provider_results.values())

        tot_low_tokens = sum(p["scenarios"]["low"]["tokens"] for p in provider_results.values())
        tot_low_cost = sum(p["scenarios"]["low"]["estimatedCostUsd"] for p in provider_results.values())

        tot_rec_tokens = sum(p["scenarios"]["recommended"]["tokens"] for p in provider_results.values())
        tot_rec_cost = sum(p["scenarios"]["recommended"]["estimatedCostUsd"] for p in provider_results.values())

        tot_safe_tokens = sum(p["scenarios"]["safety"]["tokens"] for p in provider_results.values())
        tot_safe_cost = sum(p["scenarios"]["safety"]["estimatedCostUsd"] for p in provider_results.values())

        if tot_burn_cost > 0.0001:
            consolidated_runway = round(total_balance / tot_burn_cost, 1)
        else:
            consolidated_runway = 999.0

        is_critical = consolidated_runway < 7.0 or any(p["isCritical"] for p in provider_results.values())
        recommended_topup = round(max(0.0, tot_rec_cost - total_balance), 2)

        return {
            "currentTotalBalanceUsd": round(total_balance, 2),
            "dailyBurnRateTokensTotal": int(tot_burn_tokens),
            "dailyBurnRateUsdTotal": round(tot_burn_cost, 4),
            "consolidatedRunwayDays": consolidated_runway,
            "isCritical": is_critical,
            "recommendedTopupUsd": recommended_topup,
            "scenarios": {
                "low": {
                    "label": "Baixa (Mínimo)",
                    "tokens": tot_low_tokens,
                    "estimatedCostUsd": round(tot_low_cost, 2),
                    "description": "Demanda mínima esperada para o próximo mês."
                },
                "recommended": {
                    "label": "Recomendada (Ideal)",
                    "tokens": tot_rec_tokens,
                    "estimatedCostUsd": round(tot_rec_cost, 2),
                    "description": "Valor ideal de compra para manter a operação saudável."
                },
                "safety": {
                    "label": "Segurança (Buffer de Pico)",
                    "tokens": tot_safe_tokens,
                    "estimatedCostUsd": round(tot_safe_cost, 2),
                    "description": "Reserva contra picos para que o sistema nunca pare."
                }
            }
        }
