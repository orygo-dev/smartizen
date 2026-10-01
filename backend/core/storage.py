"""Object storage provider abstraction. Select with STORAGE_PROVIDER = emergent | s3 | mongo."""
import os
import asyncio
import base64
import logging
import requests
from core.db import db

logger = logging.getLogger("rakatin.storage")
APP_NAME = "smartizen"


class EmergentStorage:
    name = "emergent"
    max_bytes = 50 * 1024 * 1024

    def __init__(self):
        base = (os.environ.get("INTEGRATION_PROXY_URL") or "").strip() or "https://integrations.emergentagent.com"
        self.url = base.rstrip("/") + "/objstore/api/v1/storage"
        self.key = None

    def init(self, force=False):
        if self.key and not force:
            return self.key
        r = requests.post(f"{self.url}/init", json={"emergent_key": os.environ["EMERGENT_LLM_KEY"]}, timeout=30)
        r.raise_for_status()
        self.key = r.json()["storage_key"]
        return self.key

    def _put(self, path, data, ctype):
        for attempt in (0, 1):
            r = requests.put(f"{self.url}/objects/{path}", data=data, timeout=180,
                             headers={"X-Storage-Key": self.init(force=attempt == 1), "Content-Type": ctype})
            if r.status_code == 404 and attempt == 0:
                continue
            r.raise_for_status()
            return r.json()["path"]

    def _get(self, path):
        for attempt in (0, 1):
            r = requests.get(f"{self.url}/objects/{path}", headers={"X-Storage-Key": self.init(force=attempt == 1)}, timeout=120)
            if r.status_code == 404 and attempt == 0:
                continue
            r.raise_for_status()
            return r.content

    async def put(self, path, data, ctype):
        return await asyncio.to_thread(self._put, path, data, ctype)

    async def get(self, path):
        return await asyncio.to_thread(self._get, path)


class S3Storage:
    """AWS S3 / Cloudflare R2 (S3-compatible). Set S3_ENDPOINT_URL for R2."""
    name = "s3"
    max_bytes = 50 * 1024 * 1024

    def __init__(self):
        import boto3
        self.bucket = os.environ["S3_BUCKET"]
        self.client = boto3.client(
            "s3", endpoint_url=os.environ.get("S3_ENDPOINT_URL") or None,
            aws_access_key_id=os.environ["S3_ACCESS_KEY_ID"],
            aws_secret_access_key=os.environ["S3_SECRET_ACCESS_KEY"],
            region_name=os.environ.get("S3_REGION") or "auto")

    def init(self, force=False):
        return True

    async def put(self, path, data, ctype):
        await asyncio.to_thread(self.client.put_object, Bucket=self.bucket, Key=path, Body=data, ContentType=ctype)
        return path

    async def get(self, path):
        obj = await asyncio.to_thread(self.client.get_object, Bucket=self.bucket, Key=path)
        return await asyncio.to_thread(obj["Body"].read)


class MongoStorage:
    """Dev fallback only (16MB document limit)."""
    name = "mongo"
    max_bytes = 15 * 1024 * 1024

    def init(self, force=False):
        return True

    async def put(self, path, data, ctype):
        await db.media_blobs.update_one({"path": path}, {"$set": {"path": path, "data": base64.b64encode(data).decode("ascii")}}, upsert=True)
        return path

    async def get(self, path):
        doc = await db.media_blobs.find_one({"path": path})
        return base64.b64decode(doc["data"])


_PROVIDERS = {"emergent": EmergentStorage, "s3": S3Storage, "mongo": MongoStorage}
storage = _PROVIDERS[os.environ["STORAGE_PROVIDER"].lower()]()


async def read_media(doc: dict) -> bytes:
    if doc.get("data"):  # legacy base64-in-document uploads
        return base64.b64decode(doc["data"])
    provider = _PROVIDERS[doc.get("provider", storage.name)]
    target = storage if provider is type(storage) else provider()
    return await target.get(doc["storage_path"])
