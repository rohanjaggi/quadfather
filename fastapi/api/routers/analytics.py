from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from datetime import datetime, timezone, timedelta

from ..deps import get_db, verify_telegram_auth
from ..models import User, FoodLog, WaterLog

router = APIRouter()


@router.get("/daily")
def get_daily_analytics(
    days: int = 7,
    db: Session = Depends(get_db),
    telegram_user: dict = Depends(verify_telegram_auth),
):
    """Return daily aggregated nutrition and water data for the last N days."""
    if days < 1 or days > 90:
        raise HTTPException(status_code=400, detail="days must be between 1 and 90")

    user = db.query(User).filter(User.telegram_id == telegram_user["id"]).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    today = datetime.now(timezone.utc).date()
    result = []

    for i in range(days - 1, -1, -1):
        day = today - timedelta(days=i)
        day_start = datetime(day.year, day.month, day.day, 0, 0, 0)
        day_end = datetime(day.year, day.month, day.day, 23, 59, 59)

        food_logs = (
            db.query(FoodLog)
            .filter(
                FoodLog.user_id == user.id,
                FoodLog.logged_at >= day_start,
                FoodLog.logged_at <= day_end,
            )
            .all()
        )

        calories = sum(log.calories or 0 for log in food_logs)
        protein = sum(log.protein or 0 for log in food_logs)
        carbs = sum(log.carbohydrates or 0 for log in food_logs)
        fats = sum(log.fats or 0 for log in food_logs)

        water_logs = (
            db.query(WaterLog)
            .filter(
                WaterLog.user_id == user.id,
                WaterLog.logged_at >= day_start,
                WaterLog.logged_at <= day_end,
            )
            .all()
        )

        water = sum(log.amount_liters for log in water_logs)

        result.append({
            "date": day.isoformat(),
            "calories": round(calories),
            "protein": round(protein, 1),
            "carbohydrates": round(carbs, 1),
            "fats": round(fats, 1),
            "water": round(water, 2),
            "meals_logged": len(food_logs),
        })

    return {
        "days": result,
        "goals": {
            "calories": user.daily_calorie_goal,
            "protein": user.daily_protein_goal,
            "water": user.daily_water_goal,
        },
    }
