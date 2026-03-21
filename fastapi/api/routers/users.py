from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from ..deps import get_db, verify_telegram_auth
from ..models import User, FoodLog, WaterLog

from typing import Optional
from datetime import datetime

router = APIRouter()


@router.post("/", status_code=201)
def create_or_get_user(
    db: Session = Depends(get_db),
    telegram_user: dict = Depends(verify_telegram_auth),
):
    """
    Create user from Telegram initData (or return existing user)
    """
    telegram_id = telegram_user["id"]
    user = db.query(User).filter(User.telegram_id == telegram_id).first()
    if user:
        return {
            "id": user.id,
            "telegram_id": user.telegram_id,
            "username": user.username,
            "goals": {
                "daily_protein_goal": user.daily_protein_goal,
                "daily_calorie_goal": user.daily_calorie_goal,
                "daily_water_goal": user.daily_water_goal,
            },
            "water_bottle_size": user.water_bottle_size,
        }

    new_user = User(
        telegram_id=telegram_id,
        username=telegram_user.get("username"),
    )
    db.add(new_user)
    db.commit()
    db.refresh(new_user)

    return {
        "id": new_user.id,
        "telegram_id": new_user.telegram_id,
        "username": new_user.username,
        "goals": {
            "daily_protein_goal": new_user.daily_protein_goal,
            "daily_calorie_goal": new_user.daily_calorie_goal,
            "daily_water_goal": new_user.daily_water_goal,
        },
        "water_bottle_size": new_user.water_bottle_size,
    }


@router.get("/me")
def get_daily_summary(
    db: Session = Depends(get_db),
    telegram_user: dict = Depends(verify_telegram_auth),
):
    """
    Get today's food/water logs + goals for the authenticated user
    """
    user = db.query(User).filter(User.telegram_id == telegram_user["id"]).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    today_start = datetime.utcnow().replace(hour=0, minute=0, second=0, microsecond=0)

    food_logs = db.query(FoodLog).filter(
        FoodLog.user_id == user.id,
        FoodLog.logged_at >= today_start,
    ).all()

    water_logs = db.query(WaterLog).filter(
        WaterLog.user_id == user.id,
        WaterLog.logged_at >= today_start,
    ).all()

    # Calculate totals
    total_calories = sum(log.calories or 0.0 for log in food_logs)
    total_protein = sum(log.protein or 0.0 for log in food_logs)
    total_carbs = sum(log.carbohydrates or 0.0 for log in food_logs)
    total_fats = sum(log.fats or 0.0 for log in food_logs)
    total_water = sum(log.amount_liters for log in water_logs)

    return {
        "date": today_start.date().isoformat(),
        "macros": {
            "calories": {
                "total": total_calories,
                "goal": user.daily_calorie_goal,
                "remaining": round(user.daily_calorie_goal - total_calories, 1),
            },
            "protein": {
                "total": total_protein,
                "goal": user.daily_protein_goal,
                "remaining": round(user.daily_protein_goal - total_protein, 1),
            },
            "carbohydrates": total_carbs,
            "fats": total_fats,
        },
        "water": {
            "total": total_water,
            "goal": user.daily_water_goal,
            "remaining": round(user.daily_water_goal - total_water, 1),
        },
        "meals_logged": len(food_logs),
    }


@router.put("/me/goals")
def update_goals(
    daily_calorie_goal: Optional[float] = None,
    daily_protein_goal: Optional[float] = None,
    daily_water_goal: Optional[float] = None,
    bottle_size: Optional[float] = None,
    db: Session = Depends(get_db),
    telegram_user: dict = Depends(verify_telegram_auth),
):
    """
    Update the authenticated user's daily goals
    """
    user = db.query(User).filter(User.telegram_id == telegram_user["id"]).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    if daily_calorie_goal is not None:
        user.daily_calorie_goal = daily_calorie_goal
    if daily_protein_goal is not None:
        user.daily_protein_goal = daily_protein_goal
    if daily_water_goal is not None:
        user.daily_water_goal = daily_water_goal
    if bottle_size is not None:
        user.water_bottle_size = bottle_size

    db.commit()
    db.refresh(user)

    return {
        "message": "Goals updated",
        "goals": {
            "protein": user.daily_protein_goal,
            "calories": user.daily_calorie_goal,
            "water": user.daily_water_goal,
        },
        "water_bottle_size": user.water_bottle_size,
    }
