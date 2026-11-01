from fastapi import APIRouter, Depends, HTTPException
from sqlmodel import Session, select
from sqlalchemy import func
import json
import random

from database import get_session
from models import FridgeItem, Recipe
from routes.recipes import recipe_summary, parse_ingredients
from sqlmodel import col, or_

router = APIRouter(prefix="/api/roulette", tags=["roulette"])


@router.get("")
def spin_roulette(session: Session = Depends(get_session)):
    """
    Pick 3-5 random fridge items, find matching recipes,
    and return the spin result for the UI.
    """
    all_items = session.exec(select(FridgeItem)).all()
    if not all_items:
        raise HTTPException(
            status_code=400,
            detail="Add some items to your fridge first!"
        )

    count = min(len(all_items), random.randint(3, 5))
    chosen = random.sample(all_items, count)
    chosen_names = [item.name.lower() for item in chosen]

    # Find matching recipes
    conditions = [col(Recipe.ingredients).ilike(f"%{name}%") for name in chosen_names]
    candidates = session.exec(select(Recipe).where(or_(*conditions)).limit(200)).all()

    scored = []
    for recipe in candidates:
        recipe_ings = parse_ingredients(recipe.ingredients)
        matched = [n for n in chosen_names if any(n in r for r in recipe_ings)]
        if matched:
            scored.append({
                **recipe_summary(recipe),
                "match_score": round(len(matched) / max(len(recipe_ings), 1) * 100),
                "matched_ingredients": matched,
            })

    scored.sort(key=lambda x: x["match_score"], reverse=True)

    return {
        "chosen_ingredients": [{"id": i.id, "name": i.name} for i in chosen],
        "recipes": scored[:6],
    }
