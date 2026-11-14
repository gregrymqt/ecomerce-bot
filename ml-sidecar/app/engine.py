import logging
from typing import Dict, Any
from app.ml.rfm_segmentation import RFMSegmentation
from app.ml.churn_predictor import ChurnPredictor
from app.ml.ltv_forecaster import LTVForecaster
from app.ml.token_capacity_forecaster import TokenCapacityForecaster

logger = logging.getLogger(__name__)

class AnalyticsMLEngine:
    def __init__(self):
        self.rfm_model = RFMSegmentation()
        self.churn_model = ChurnPredictor()
        self.ltv_model = LTVForecaster()
        self.token_forecaster = TokenCapacityForecaster()

    def process_analytics(self, payload: Dict[str, Any]) -> Dict[str, Any]:
        tenant_id = payload.get("tenantId") or payload.get("tenant_id")
        job_type = (payload.get("jobType") or payload.get("job_type") or "FULL_ANALYTICS").upper()
        transactions = payload.get("transactions", [])
        usage_history = payload.get("usageHistory") or payload.get("usage_history") or []
        current_balances = payload.get("currentBalances") or payload.get("current_balances") or {}
        forecast_days = int(payload.get("forecastDays") or payload.get("forecast_days") or 30)

        logger.info(f"Processando ML job={job_type} para tenant={tenant_id}")

        results = {
            "tenantId": tenant_id,
            "jobType": job_type,
            "status": "SUCCESS",
            "rfm": None,
            "churn": None,
            "ltv": None,
            "tokenCapacity": None
        }

        try:
            if job_type in ["TOKEN_CAPACITY_FORECAST"]:
                results["tokenCapacity"] = self.token_forecaster.forecast_capacity(
                    usage_history=usage_history,
                    current_balances=current_balances,
                    forecast_days=forecast_days
                )

            if job_type in ["RFM_SEGMENTATION", "FULL_ANALYTICS"]:
                results["rfm"] = self.rfm_model.segment_customers(transactions)

            if job_type in ["CHURN_PREDICTION", "FULL_ANALYTICS"]:
                results["churn"] = self.churn_model.predict_churn(transactions)

            if job_type in ["LTV_FORECAST", "FULL_ANALYTICS"]:
                results["ltv"] = self.ltv_model.forecast_ltv(transactions)

        except Exception as e:
            logger.error(f"Erro no processamento de Machine Learning: {e}", exc_info=True)
            results["status"] = "FAILED"
            results["errorMessage"] = str(e)

        return results
