import os
from pathlib import Path
from dotenv import load_dotenv
import motor.motor_asyncio as motor

# Load .env from repo root (job-gap-fsd/.env)
env_path = Path(__file__).resolve().parents[2] / ".env"
if env_path.exists():
    load_dotenv(env_path)
else:
    load_dotenv()

MONGO_URI = os.getenv("MONGO_URI", "mongodb://localhost:27017")
DB_NAME = os.getenv("DB_NAME", "jobgap")

client = motor.AsyncIOMotorClient(MONGO_URI)
db = client[DB_NAME]
