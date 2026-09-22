import logging
import sys
from pathlib import Path
from logging.handlers import RotatingFileHandler
from pythonjsonlogger import jsonlogger

BASE_DIR = Path(__file__).resolve().parent.parent.parent.parent
LOGS_DIR = BASE_DIR / "logs"

def get_logger(name: str) -> logging.Logger:
    logger = logging.getLogger(name)
    
    if logger.handlers:
        return logger

    logger.setLevel(logging.INFO)

    formatter = jsonlogger.JsonFormatter(
        '%(asctime)s %(levelname)s %(name)s %(message)s',
        rename_fields={
            "asctime": "timestamp",
            "levelname": "level",
            "name": "module"
        },
        datefmt='%Y-%m-%d %H:%M:%S'
    )

    # 1. Console StreamHandler
    log_handler = logging.StreamHandler(sys.stdout)
    log_handler.setFormatter(formatter)
    logger.addHandler(log_handler)

    # 2. RotatingFileHandler persistido para observabilidade e ferramenta MCP
    try:
        LOGS_DIR.mkdir(parents=True, exist_ok=True)
        file_handler = RotatingFileHandler(
            LOGS_DIR / "scraper_worker.log",
            maxBytes=5 * 1024 * 1024,  # 5 MB
            backupCount=3,
            encoding="utf-8"
        )
        file_handler.setFormatter(formatter)
        logger.addHandler(file_handler)
    except Exception:
        pass

    return logger
