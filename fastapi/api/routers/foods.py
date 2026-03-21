from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form
from sqlalchemy.orm import Session
from pydantic import BaseModel
from typing import Optional
from datetime import datetime, timezone

from ..deps import get_db, verify_telegram_auth, verify_bot_auth
from ..models import User, SavedFood, FoodLog
from ..services.gemini import analyse_meal

router = APIRouter()


class FoodLogCreate(BaseModel):
    food_name: str
    calories: float
    protein: float
    carbohydrates: float
    fats: float
    servings: float = 1.0
    saved_food_id: Optional[int] = None
    raw_text_input: Optional[str] = None
    source: str = "manual"


class SavedFoodCreate(BaseModel):
    name: str
    calories: float
    protein: float
    carbohydrates: float
    fats: float
    description: Optional[str] = None
    serving_label: Optional[str] = None
    source: str = "manual"


def _food_log_response(log: FoodLog) -> dict:
    return {
        "id": log.id,
        "food_name": log.food_name,
        "servings": log.servings,
        "calories": log.calories,
        "protein": log.protein,
        "carbohydrates": log.carbohydrates,
        "fats": log.fats,
        "source": log.source,
        "saved_food_id": log.saved_food_id,
        "logged_at": log.logged_at.isoformat(),
    }


def _saved_food_response(food: SavedFood) -> dict:
    return {
        "id": food.id,
        "name": food.name,
        "description": food.description,
        "calories": food.calories,
        "protein": food.protein,
        "carbohydrates": food.carbohydrates,
        "fats": food.fats,
        "serving_label": food.serving_label,
        "source": food.source,
        "created_at": food.created_at.isoformat(),
    }


@router.get("/")
def get_food_logs(
    db: Session = Depends(get_db),
    telegram_user: dict = Depends(verify_telegram_auth),
):
    """Get today's food logs for the authenticated user."""
    user = db.query(User).filter(User.telegram_id == telegram_user["id"]).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    today_start = datetime.now(timezone.utc).replace(hour=0, minute=0, second=0, microsecond=0, tzinfo=None)
    logs = (
        db.query(FoodLog)
        .filter(FoodLog.user_id == user.id, FoodLog.logged_at >= today_start)
        .order_by(FoodLog.logged_at.desc())
        .all()
    )

    return [_food_log_response(log) for log in logs]


@router.post("/", status_code=201)
def log_food(
    body: FoodLogCreate,
    db: Session = Depends(get_db),
    telegram_user: dict = Depends(verify_telegram_auth),
):
    """Log a food entry for the authenticated user."""
    user = db.query(User).filter(User.telegram_id == telegram_user["id"]).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    if body.saved_food_id is not None:
        saved = db.query(SavedFood).filter(
            SavedFood.id == body.saved_food_id,
            SavedFood.user_id == user.id,
        ).first()
        if not saved:
            raise HTTPException(status_code=404, detail="Saved food not found")

    log = FoodLog(
        user_id=user.id,
        saved_food_id=body.saved_food_id,
        food_name=body.food_name,
        raw_text_input=body.raw_text_input,
        servings=body.servings,
        calories=body.calories * body.servings,
        protein=body.protein * body.servings,
        carbohydrates=body.carbohydrates * body.servings,
        fats=body.fats * body.servings,
        source=body.source,
    )
    db.add(log)
    db.commit()
    db.refresh(log)

    return _food_log_response(log)


@router.delete("/{log_id}", status_code=204)
def delete_food_log(
    log_id: int,
    db: Session = Depends(get_db),
    telegram_user: dict = Depends(verify_telegram_auth),
):
    """Delete a food log entry."""
    user = db.query(User).filter(User.telegram_id == telegram_user["id"]).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    log = db.query(FoodLog).filter(FoodLog.id == log_id, FoodLog.user_id == user.id).first()
    if not log:
        raise HTTPException(status_code=404, detail="Food log not found")

    db.delete(log)
    db.commit()


@router.post("/analyse")
async def analyse_food(
    image: UploadFile = File(...),
    description: str = Form(""),
    _telegram_user: dict = Depends(verify_telegram_auth),
):
    """Send a meal photo to Gemini and get back estimated macros. Does not log anything."""
    if not image.content_type or not image.content_type.startswith("image/"):
        raise HTTPException(status_code=422, detail="File must be an image")

    image_bytes = await image.read()
    try:
        result = analyse_meal(image_bytes, image.content_type, description)
    except ValueError as e:
        raise HTTPException(status_code=422, detail=str(e))
    except RuntimeError as e:
        raise HTTPException(status_code=503, detail=str(e))

    return result


@router.post("/bot/analyse")
async def bot_analyse_food(
    image: UploadFile = File(...),
    description: str = Form(""),
    _telegram_id: int = Depends(verify_bot_auth),
):
    """Bot-authenticated meal photo analysis — no WebApp initData required."""
    if not image.content_type or not image.content_type.startswith("image/"):
        raise HTTPException(status_code=422, detail="File must be an image")

    image_bytes = await image.read()
    try:
        result = analyse_meal(image_bytes, image.content_type, description)
    except ValueError as e:
        raise HTTPException(status_code=422, detail=str(e))
    except RuntimeError as e:
        raise HTTPException(status_code=503, detail=str(e))

    return result


@router.get("/saved")
def get_saved_foods(
    db: Session = Depends(get_db),
    telegram_user: dict = Depends(verify_telegram_auth),
):
    """Get all saved foods for the authenticated user."""
    user = db.query(User).filter(User.telegram_id == telegram_user["id"]).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    foods = (
        db.query(SavedFood)
        .filter(SavedFood.user_id == user.id)
        .order_by(SavedFood.name)
        .all()
    )
    return [_saved_food_response(f) for f in foods]


@router.post("/saved", status_code=201)
def save_food(
    body: SavedFoodCreate,
    db: Session = Depends(get_db),
    telegram_user: dict = Depends(verify_telegram_auth),
):
    """Save a food macro profile for reuse."""
    user = db.query(User).filter(User.telegram_id == telegram_user["id"]).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    existing = db.query(SavedFood).filter(
        SavedFood.user_id == user.id,
        SavedFood.name == body.name,
    ).first()
    if existing:
        raise HTTPException(status_code=409, detail="A saved food with this name already exists")

    food = SavedFood(
        user_id=user.id,
        name=body.name,
        description=body.description,
        calories=body.calories,
        protein=body.protein,
        carbohydrates=body.carbohydrates,
        fats=body.fats,
        serving_label=body.serving_label,
        source=body.source,
    )
    db.add(food)
    db.commit()
    db.refresh(food)

    return _saved_food_response(food)


@router.delete("/saved/{food_id}", status_code=204)
def delete_saved_food(
    food_id: int,
    db: Session = Depends(get_db),
    telegram_user: dict = Depends(verify_telegram_auth),
):
    """Delete a saved food."""
    user = db.query(User).filter(User.telegram_id == telegram_user["id"]).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    food = db.query(SavedFood).filter(
        SavedFood.id == food_id,
        SavedFood.user_id == user.id,
    ).first()
    if not food:
        raise HTTPException(status_code=404, detail="Saved food not found")

    db.delete(food)
    db.commit()
