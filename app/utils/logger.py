import logging
import sys
from pythonjsonlogger import jsonlogger

def get_logger(name: str) -> logging.Logger:
    logger = logging.getLogger(name)
    
    # If the logger already has handlers, it might have been configured already
    if logger.handlers:
        return logger

    logger.setLevel(logging.INFO)

    logHandler = logging.StreamHandler(sys.stdout)
    # Define standard format
    # Using python-json-logger, the format string fields become keys in the JSON
    formatter = jsonlogger.JsonFormatter(
        '%(asctime)s %(levelname)s %(name)s %(message)s',
        rename_fields={
            "asctime": "timestamp",
            "levelname": "level",
            "name": "module"
        },
        datefmt='%Y-%m-%d %H:%M:%S'
    )
    logHandler.setFormatter(formatter)
    logger.addHandler(logHandler)

    return logger
