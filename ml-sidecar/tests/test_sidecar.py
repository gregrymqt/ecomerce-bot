from fastapi.testclient import TestClient
from app.main import app

client = TestClient(app)

def test_health():
    response = client.get("/health")
    assert response.status_code == 200
    assert response.json() == {"status": "ok", "service": "ml-sidecar"}

def test_analyze_rfm():
    payload = {
        "tenantId": "00000000-0000-0000-0000-000000000001",
        "jobType": "RFM_SEGMENTATION",
        "transactions": [
            {
                "customerId": "cust-1",
                "createdAt": "2026-08-01T12:00:00Z",
                "amount": 150.0
            },
            {
                "customerId": "cust-2",
                "createdAt": "2026-08-15T12:00:00Z",
                "amount": 300.0
            }
        ]
    }
    response = client.post("/api/ml/analyze", json=payload)
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "SUCCESS"
    assert data["rfm"] is not None
