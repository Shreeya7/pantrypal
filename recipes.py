from __future__ import annotations
from fastapi import APIRouter, Depends, Query, HTTPException
from sqlmodel import Session, select, or_, col
from typing import Optional
import json
import re

from database import get_session
from models import Recipe

router = APIRouter(prefix="/api/recipes", tags=["recipes"])


def parse_ingredients(raw: str) -> list[str]:
    """Parse ingredients JSON string into a list of lowercased strings."""
    try:
        items = json.loads(raw)
        return [str(i).lower().strip() for i in items if i]
    except Exception:
        return []


@router.get("")
def list_recipes(
    search: Optional[str] = Query(None),
    cuisine: Optional[str] = Query(None),
    course: Optional[str] = Query(None),
    diet: Optional[str] = Query(None),
    difficulty: Optional[str] = Query(None),
    vegan: Optional[bool] = Query(None),
    vegetarian: Optional[bool] = Query(None),
    gluten_free: Optional[bool] = Query(None),
    limit: int = Query(24, ge=1, le=100),
    offset: int = Query(0, ge=0),
    session: Session = Depends(get_session),
):
    """List/search recipes with optional filters. Returns paginated results."""
    statement = select(Recipe)

    if search:
        term = f"%{search}%"
        statement = statement.where(
            or_(
                col(Recipe.title).ilike(term),
                col(Recipe.ingredients).ilike(term),
                col(Recipe.cuisine).ilike(term),
                col(Recipe.main_ingredient).ilike(term),
            )
        )
    if cuisine:
        statement = statement.where(col(Recipe.cuisine).ilike(f"%{cuisine}%"))
    if course:
        statement = statement.where(col(Recipe.course).ilike(f"%{course}%"))
    if diet:
        statement = statement.where(col(Recipe.dietary_tags).ilike(f"%{diet}%"))
    if difficulty:
        statement = statement.where(col(Recipe.difficulty).ilike(f"%{difficulty}%"))
    if vegan:
        statement = statement.where(col(Recipe.dietary_tags).ilike("%vegan%"))
    if vegetarian:
        statement = statement.where(col(Recipe.dietary_tags).ilike("%vegetarian%"))
    if gluten_free:
        statement = statement.where(col(Recipe.dietary_tags).ilike("%gluten%"))

    total_stmt = statement
    count_results = session.exec(total_stmt).all()
    total = len(count_results)

    results = session.exec(statement.offset(offset).limit(limit)).all()

    return {
        "total": total,
        "offset": offset,
        "limit": limit,
        "results": [recipe_summary(r) for r in results],
    }


@router.get("/random")
def random_recipe(session: Session = Depends(get_session)):
    """Return a single random recipe."""
    from sqlalchemy import func
    result = session.exec(select(Recipe).order_by(func.random()).limit(1)).first()
    if not result:
        raise HTTPException(status_code=404, detail="No recipes found")
    return recipe_detail(result)


@router.post("/match")
def match_recipes(
    body: dict,
    limit: int = Query(20, ge=1, le=50),
    session: Session = Depends(get_session),
):
    """
    Smart ingredient-based matching.
    Body: { "ingredients": ["egg", "flour", "milk"] }
    Returns recipes ranked by how many of your ingredients they use.
    """
    user_ingredients = [i.lower().strip() for i in body.get("ingredients", []) if i]
    if not user_ingredients:
        raise HTTPException(status_code=422, detail="Provide at least one ingredient")

    # Find all recipes that contain AT LEAST ONE of the user's ingredients
    conditions = [col(Recipe.ingredients).ilike(f"%{ing}%") for ing in user_ingredients]
    statement = select(Recipe).where(or_(*conditions))
    candidates = session.exec(statement).all()

    # Score each by overlap
    scored = []
    for recipe in candidates:
        recipe_ings = parse_ingredients(recipe.ingredients)
        matched = [ing for ing in user_ingredients if any(ing in r for r in recipe_ings)]
        missing = [r for r in recipe_ings if not any(u in r for u in user_ingredients)]
        match_pct = round(len(matched) / max(len(recipe_ings), 1) * 100)
        scored.append({
            **recipe_summary(recipe),
            "match_score": match_pct,
            "matched_ingredients": matched,
            "missing_ingredients": missing[:8],  # cap for UI
        })

    scored.sort(key=lambda x: x["match_score"], reverse=True)
    return scored[:limit]


@router.get("/{recipe_id}")
def get_recipe(recipe_id: int, session: Session = Depends(get_session)):
    """Get full detail for a single recipe by ID."""
    recipe = session.get(Recipe, recipe_id)
    if not recipe:
        raise HTTPException(status_code=404, detail="Recipe not found")
    return recipe_detail(recipe)


# ─── Serialization helpers ───────────────────────────────────────────────────

def recipe_summary(r: Recipe) -> dict:
    cuisine_list = safe_json_list(r.cuisine)
    course_list  = safe_json_list(r.course)
    taste_list   = safe_json_list(r.taste)
    return {
        "id": r.id,
        "title": r.title,
        "cuisine": cuisine_list[0].replace("_", " ").title() if cuisine_list else r.cuisine,
        "cuisines": cuisine_list,
        "course": course_list[0].replace("_", " ").title() if course_list else r.course,
        "courses": course_list,
        "taste": taste_list[0] if taste_list else r.taste,
        "tastes": taste_list,
        "difficulty": r.difficulty,
        "prep_time": r.prep_time,
        "cook_time": r.cook_time,
        "healthiness": r.healthiness,
        "dietary_tags": safe_json_list(r.dietary_tags),
        "main_ingredient": r.main_ingredient,
        "ingredient_count": len(parse_ingredients(r.ingredients)),
    }


def recipe_detail(r: Recipe) -> dict:
    return {
        **recipe_summary(r),
        "category": r.category,
        "ingredients": parse_ingredients(r.ingredients),
        "directions": safe_json_list(r.directions),
    }


def safe_json_list(raw: Optional[str]) -> list:
    if not raw:
        return []
    try:
        return json.loads(raw)
    except Exception:
        return []
