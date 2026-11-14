import logging
from typing import Dict, Any
from fastapi import FastAPI, HTTPException
from app.engine import AnalyticsMLEngine

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(name)s: %(message)s")
logger = logging.getLogger("ml_sidecar")

app = FastAPI(title="EcommerceBot ML Sidecar", version="1.0.0")
engine = AnalyticsMLEngine()

@app.get("/health")
def health():
    return {"status": "ok", "service": "ml-sidecar"}

@app.post("/api/ml/analyze")
def analyze(payload: Dict[str, Any]):
    try:
        return engine.process_analytics(payload)
    except Exception as e:
        logger.error(f"Erro inesperado no ML Sidecar: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))
