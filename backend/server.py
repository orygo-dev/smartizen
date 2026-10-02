from fastapi import FastAPI, APIRouter
from dotenv import load_dotenv
from pathlib import Path
import os
import logging

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / ".env")

from starlette.middleware.cors import CORSMiddleware  # noqa: E402
from core.db import client  # noqa: E402
from seed import run_seed  # noqa: E402
from routers import auth, regions, rt, residents, civic, social, dashboard  # noqa: E402
from routers import households, stories, chat, letters_pdf, uploads, marketplace, reels, umkm, orders  # noqa: E402
from core.storage import storage  # noqa: E402

logging.basicConfig(level=logging.INFO, format="%(asctime)s - %(name)s - %(levelname)s - %(message)s")
logger = logging.getLogger("rakatin")

app = FastAPI(title="RAKATIN API", version="1.0.0")

health = APIRouter(prefix="/api")


@health.get("/")
async def root():
    return {"app": "RAKATIN", "tagline": "Warga Terhubung, Lingkungan Maju", "status": "ok"}


@health.get("/health")
async def health_check():
    try:
        await client.admin.command("ping")
        db_ok = True
    except Exception:
        db_ok = False
    return {"status": "ok" if db_ok else "degraded", "db": db_ok}


app.include_router(health)
app.include_router(auth.router)
app.include_router(regions.router)
app.include_router(rt.router)
app.include_router(residents.router)
app.include_router(civic.router)
app.include_router(social.router)
app.include_router(dashboard.router)
app.include_router(households.router)
app.include_router(stories.router)
app.include_router(chat.router)
app.include_router(letters_pdf.router)
app.include_router(uploads.router)
app.include_router(orders.router)
app.include_router(marketplace.router)
app.include_router(reels.router)
app.include_router(umkm.router)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=False,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.on_event("startup")
async def _startup():
    await run_seed()
    try:
        storage.init()
        logger.info("Storage provider ready: %s", storage.name)
    except Exception as e:
        logger.error("Storage init failed (%s): %s", storage.name, e)
    logger.info("RAKATIN seed complete.")


@app.on_event("shutdown")
async def _shutdown():
    client.close()
