import os
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from .database import engine
from . import models
from .routers import foods, water, users, analytics, webhook

WEBHOOK_URL: str = os.getenv("WEBHOOK_URL", "")       # e.g. https://quadfather.fly.dev
WEBHOOK_SECRET: str = os.getenv("WEBHOOK_SECRET", "") # random secret string


@asynccontextmanager
async def lifespan(app: FastAPI):
    if WEBHOOK_URL and WEBHOOK_SECRET:
        from .bot_handlers import bot
        bot.set_webhook(url=f"{WEBHOOK_URL}/webhook/{WEBHOOK_SECRET}")
    yield
    if WEBHOOK_URL and WEBHOOK_SECRET:
        from .bot_handlers import bot
        bot.delete_webhook()


app = FastAPI(lifespan=lifespan)

models.Base.metadata.create_all(bind=engine)

allowed_origins = os.getenv("ALLOWED_ORIGINS", "http://localhost:3000").split(",")

app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(users.router, prefix="/users", tags=["users"])
app.include_router(foods.router, prefix="/foods", tags=["foods"])
app.include_router(water.router, prefix="/water", tags=["water"])
app.include_router(analytics.router, prefix="/analytics", tags=["analytics"])
app.include_router(webhook.router, prefix="/webhook", tags=["webhook"])


@app.get("/")
def health_check():
    return {"status": "ok"}
