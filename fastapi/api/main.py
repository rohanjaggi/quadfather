import os

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from .database import engine
from . import models
from .routers import foods, water, users, analytics

app = FastAPI()

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


@app.get("/")
def health_check():
    return {"status": "ok"}
