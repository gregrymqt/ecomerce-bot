import unittest
from app.ml.rfm_segmentation import RFMSegmentation
from app.ml.churn_predictor import ChurnPredictor
from app.ml.ltv_forecaster import LTVForecaster

class TestMLModule(unittest.TestCase):
    def test_rfm_segmentation(self):
        rfm = RFMSegmentation()
        transactions = [
            {"customerId": "c1", "orderDate": "2026-08-20T10:00:00Z", "amount": 350.0},
            {"customerId": "c1", "orderDate": "2026-08-10T10:00:00Z", "amount": 250.0},
            {"customerId": "c1", "orderDate": "2026-08-01T10:00:00Z", "amount": 400.0},
            {"customerId": "c2", "orderDate": "2026-01-01T10:00:00Z", "amount": 50.0},
            {"customerId": "c3", "orderDate": "2026-08-22T10:00:00Z", "amount": 120.0},
        ]

        result = rfm.segment_customers(transactions)
        self.assertEqual(result["summary"]["total_customers"], 3)
        self.assertEqual(result["summary"]["total_revenue"], 1170.0)
        self.assertEqual(len(result["customers"]), 3)

    def test_churn_predictor(self):
        churn = ChurnPredictor()
        transactions = [
            {"customerId": "active_user", "orderDate": "2026-08-25T10:00:00Z", "amount": 100.0},
            {"customerId": "churned_user", "orderDate": "2025-01-01T10:00:00Z", "amount": 100.0},
        ]

        result = churn.predict_churn(transactions)
        predictions = {p["customerId"]: p for p in result["predictions"]}
        
        self.assertIn(predictions["active_user"]["riskLevel"], ["LOW", "MEDIUM"])
        self.assertIn(predictions["churned_user"]["riskLevel"], ["HIGH", "CRITICAL"])

    def test_ltv_forecaster(self):
        ltv = LTVForecaster()
        transactions = [
            {"customerId": "vip_user", "orderDate": "2026-08-25T10:00:00Z", "amount": 1000.0},
            {"customerId": "vip_user", "orderDate": "2026-07-25T10:00:00Z", "amount": 800.0},
        ]

        result = ltv.forecast_ltv(transactions)
        self.assertEqual(result["summary"]["total_customers"], 1)
        self.assertEqual(result["forecasts"][0]["customerTier"], "DIAMOND")
        self.assertGreater(result["summary"]["projected_revenue_12m"], 0)

if __name__ == "__main__":
    unittest.main()
