# app/db/mongodb.py
from __future__ import annotations

from typing import Optional
from motor.motor_asyncio import AsyncIOMotorClient, AsyncIOMotorDatabase

from app.core.config import settings

client: Optional[AsyncIOMotorClient] = None
db: Optional[AsyncIOMotorDatabase] = None


async def connect_to_mongo() -> None:
    """
    Initialize a single AsyncIOMotorClient and expose `db`.
    Safe to call multiple times.
    """
    global client, db
    if client is not None and db is not None:
        return

    # Settings expected:
    #   settings.MONGO_URI -> e.g. "mongodb://localhost:27017"
    #   settings.DB_NAME   -> e.g. "job_gap_fsd"
    uri = getattr(settings, "MONGO_URI", None) or getattr(settings, "MONGODB_URI", None)
    name = getattr(settings, "DB_NAME", None) or getattr(settings, "MONGODB_DB", None)

    if not uri or not name:
        raise RuntimeError("Mongo settings missing: require MONGO_URI/MONGODB_URI and DB_NAME/MONGODB_DB")

    client = AsyncIOMotorClient(uri)
    db = client[name]


async def close_mongo_connection() -> None:
    """Close the AsyncIOMotorClient."""
    global client, db
    if client is not None:
        client.close()
    client = None
    db = None


def get_db() -> AsyncIOMotorDatabase:
    """Synchronous accessor used by modules that can’t be async."""
    if db is None:
        raise RuntimeError("MongoDB is not connected yet. Call connect_to_mongo() at startup.")
    return db
