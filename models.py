from __future__ import annotations
from sqlmodel import SQLModel, Field
from typing import Optional
from datetime import date


class Recipe(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    title: str = Field(index=True)
    category: Optional[str] = None
    ingredients: str  # JSON array stored as text
    directions: str  # JSON array stored as text
    cuisine: Optional[str] = None
    course: Optional[str] = None
    taste: Optional[str] = None
    dietary_tags: Optional[str] = None  # JSON array stored as text
    prep_time: Optional[int] = None  # minutes
    cook_time: Optional[int] = None  # minutes
    difficulty: Optional[str] = None
    healthiness: Optional[float] = None
    main_ingredient: Optional[str] = None


class FridgeItem(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    name: str = Field(index=True)
    quantity: Optional[str] = None
    category: Optional[str] = None
    purchased_at: Optional[date] = None
    expires_at: Optional[date] = None
