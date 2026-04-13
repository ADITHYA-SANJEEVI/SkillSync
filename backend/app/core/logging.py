import logging
import sys
import json
from datetime import datetime

class JsonFormatter(logging.Formatter):
    def format(self, record: logging.LogRecord) -> str:
        payload = {
            "ts": datetime.utcnow().isoformat() + "Z",
            "level": record.levelname.lower(),
            "msg": record.getMessage(),
            "name": record.name,
            "module": record.module,
            "func": record.funcName,
            "line": record.lineno,
        }
        return json.dumps(payload, ensure_ascii=False)

def setup_logging():
    handler = logging.StreamHandler(sys.stdout)
    handler.setFormatter(JsonFormatter())
    root = logging.getLogger()
    root.setLevel(logging.INFO)
    while root.handlers:
        root.removeHandler(root.handlers[0])
    root.addHandler(handler)
