from sqlalchemy import Column, DateTime, Integer, String, Text, ForeignKey, Table, Float, UniqueConstraint
from sqlalchemy.orm import declarative_base, relationship, Mapped, mapped_column
from .database import Base
from datetime import datetime
from typing import Optional

Base = declarative_base()

class User(Base):
    __tablename__ = "users"
    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    telegram_id: Mapped[int] = mapped_column(Integer, unique=True, index=True)
    username: Mapped[Optional[str]] = mapped_column(String(50))

    daily_protein_goal: Mapped[float] = mapped_column(Float, default=120.0) # in grams
    daily_calorie_goal: Mapped[float] = mapped_column(Float, default=2000.0) # in calories
    daily_water_goal: Mapped[float] = mapped_column(Float, default=3) # in liters
    water_bottle_size: Mapped[float] = mapped_column(Float, default=0.5) # in liters

    created_at: Mapped[Optional[datetime]] = mapped_column(DateTime, default=datetime.utcnow)

    saved_foods = relationship("SavedFood", back_populates="user", cascade="all, delete-orphan")
    food_logs = relationship("FoodLog", back_populates="user", cascade="all, delete-orphan")
    water_logs = relationship("WaterLog", back_populates="user", cascade="all, delete-orphan")

class SavedFood(Base):
    """
    Reusable food macro profile (cached result)
    """
    __tablename__ = "saved_foods"
    __table_args__ = (
        UniqueConstraint("user_id", "name", name="uq_user_food_name"),
    )

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)

    name = Column(String(100), nullable=False, index=True) # user-defined name for the food
    description = Column(Text, nullable=True)
    image_path = Column(String(255), nullable=True) # path to the Telegram image

    # Macros per serving
    calories = Column(Float, nullable=False)
    protein = Column(Float, nullable=False)
    carbohydrates = Column(Float, nullable=False)
    fats = Column(Float, nullable=False)

    serving_label = Column(String(100), nullable=True) # e.g. "1 cup", "100g"
    source = Column(String(20), default="gemini") # gemini | manual

    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)

    user = relationship("User", back_populates="saved_foods")
    logs = relationship("FoodLog", back_populates="saved_food")

class FoodLog(Base):
    """
    Actual eating event. Can be a SavedFood or a one-off entry
    """
    __tablename__ = "food_logs"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    saved_food_id = Column(Integer, ForeignKey("saved_foods.id", ondelete="SET NULL"), nullable=True, index=True)

    food_name = Column(String(100))
    raw_text_input = Column(Text, nullable=True) # original user input for traceability
    image_path = Column(String(255), nullable=True) # path to the Telegram image

    servings = Column(Float, default=1.0, nullable=False) # number of servings consumed

    calories: Mapped[Optional[float]] = mapped_column(Float)
    protein: Mapped[Optional[float]] = mapped_column(Float)
    carbohydrates: Mapped[Optional[float]] = mapped_column(Float)
    fats: Mapped[Optional[float]] = mapped_column(Float)

    source: Mapped[Optional[str]] = mapped_column(String(20), default="gemini") # gemini | manual
    logged_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, nullable=False)

    user = relationship("User", back_populates="food_logs")
    saved_food = relationship("SavedFood", back_populates="logs")

class WaterLog(Base):
    """
    Water intake event. Supports litres or number of bottles
    """
    __tablename__ = "water_logs"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)

    amount_liters: Mapped[float] = mapped_column(Float, nullable=False) # in liters
    bottles = Column(Float, nullable=True) # optional number of bottles (calculated from amount_liters and user's water_bottle_size)
    water_bottle_size = Column(Float, nullable=True) # in liters

    logged_at = Column(DateTime, default=datetime.utcnow, nullable=False)

    user = relationship("User", back_populates="water_logs")