from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from pydantic import BaseModel
from typing import Optional
from datetime import datetime, timezone

from ..deps import get_db, verify_telegram_auth
from ..models import User, WaterLog

router = APIRouter()


class WaterLogCreate(BaseModel):
    amount_liters: Optional[float] = None
    bottles: Optional[float] = None


def _water_log_response(log: WaterLog) -> dict:
    return {
        "id": log.id,
        "amount_liters": log.amount_liters,
        "bottles": log.bottles,
        "water_bottle_size": log.water_bottle_size,
        "logged_at": log.logged_at.isoformat(),
    }


@router.get("/")
def get_water_logs(
    db: Session = Depends(get_db),
    telegram_user: dict = Depends(verify_telegram_auth),
):
    """Get today's water logs for the authenticated user."""
    user = db.query(User).filter(User.telegram_id == telegram_user["id"]).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    today_start = datetime.now(timezone.utc).replace(hour=0, minute=0, second=0, microsecond=0, tzinfo=None)
    logs = (
        db.query(WaterLog)
        .filter(WaterLog.user_id == user.id, WaterLog.logged_at >= today_start)
        .order_by(WaterLog.logged_at.desc())
        .all()
    )
    return [_water_log_response(log) for log in logs]


@router.post("/", status_code=201)
def log_water(
    body: WaterLogCreate,
    db: Session = Depends(get_db),
    telegram_user: dict = Depends(verify_telegram_auth),
):
    """
    Log water intake. Provide either `amount_liters` or `bottles` (uses user's bottle size).
    """
    user = db.query(User).filter(User.telegram_id == telegram_user["id"]).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    if body.amount_liters is None and body.bottles is None:
        raise HTTPException(status_code=422, detail="Provide either amount_liters or bottles")

    bottle_size = user.water_bottle_size

    if body.bottles is not None:
        amount_liters = body.bottles * bottle_size
        bottles = body.bottles
    else:
        amount_liters = body.amount_liters or 0.0
        bottles = round(amount_liters / bottle_size, 2) if bottle_size else None

    log = WaterLog(
        user_id=user.id,
        amount_liters=amount_liters,
        bottles=bottles,
        water_bottle_size=bottle_size,
    )
    db.add(log)
    db.commit()
    db.refresh(log)

    return _water_log_response(log)


@router.delete("/{log_id}", status_code=204)
def delete_water_log(
    log_id: int,
    db: Session = Depends(get_db),
    telegram_user: dict = Depends(verify_telegram_auth),
):
    """Delete a water log entry."""
    user = db.query(User).filter(User.telegram_id == telegram_user["id"]).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    log = db.query(WaterLog).filter(WaterLog.id == log_id, WaterLog.user_id == user.id).first()
    if not log:
        raise HTTPException(status_code=404, detail="Water log not found")

    db.delete(log)
    db.commit()
