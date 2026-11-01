#!/usr/bin/env python3
"""
Seed script: reads the Kaggle 64K Recipes CSV and loads it into SQLite.
Usage: python scripts/seed_db.py
Place your downloaded CSV at: backend/data/recipes.csv
"""

import sys
import os
import json
import ast
from typing import Optional

# Allow imports from parent directory
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

import pandas as pd
from sqlmodel import Session
from database import engine, create_db_and_tables
from models import Recipe

CSV_PATH = os.path.join(os.path.dirname(os.path.dirname(__file__)), "data", "recipes.csv")

BATCH_SIZE = 1000


def safe_parse_list(value) -> str:
    """Safely converts various list representations to a JSON string."""
    if pd.isna(value) or value is None:
        return "[]"
    if isinstance(value, list):
        return json.dumps(value)
    val_str = str(value).strip()
    if not val_str or val_str == "nan":
        return "[]"
    # Try JSON first
    try:
        parsed = json.loads(val_str)
        return json.dumps(parsed if isinstance(parsed, list) else [str(parsed)])
    except (json.JSONDecodeError, ValueError):
        pass
    # Try Python literal eval
    try:
        parsed = ast.literal_eval(val_str)
        return json.dumps(list(parsed) if isinstance(parsed, (list, tuple)) else [str(parsed)])
    except Exception:
        pass
    # Comma-split fallback
    parts = [p.strip().strip("'\"") for p in val_str.split(",") if p.strip()]
    return json.dumps(parts)


def safe_int(value) -> Optional[int]:
    try:
        v = float(value)
        return int(v) if v == v else None  # NaN check
    except (TypeError, ValueError):
        return None


def safe_float(value) -> Optional[float]:
    try:
        v = float(value)
        return v if v == v else None
    except (TypeError, ValueError):
        return None


def safe_str(value) -> Optional[str]:
    if pd.isna(value) or value is None:
        return None
    s = str(value).strip()
    return s if s and s.lower() != "nan" else None


def find_column(df, candidates):
    """Find the first matching column name (case-insensitive) from a list of candidates."""
    cols_lower = {c.lower(): c for c in df.columns}
    for c in candidates:
        if c.lower() in cols_lower:
            return cols_lower[c.lower()]
    return None


def seed():
    if not os.path.exists(CSV_PATH):
        print(f"\n❌  CSV not found at: {CSV_PATH}")
        print("   Please download the dataset from Kaggle and place it at that path.")
        print("   See README.md for instructions.\n")
        sys.exit(1)

    print(f"📖  Reading CSV: {CSV_PATH}")
    df = pd.read_csv(CSV_PATH, low_memory=False)
    print(f"✅  Loaded {len(df):,} rows, {len(df.columns)} columns")
    print(f"    Columns: {list(df.columns)}\n")

    # Map CSV columns flexibly — handles both generic and the Kaggle extended dataset columns
    col_title        = find_column(df, ["recipe_title", "title", "name", "recipe_name"])
    col_category     = find_column(df, ["category", "subcategory", "type"])
    col_ingredients  = find_column(df, ["ingredients_raw", "ingredients", "ingredient_list"])
    col_directions   = find_column(df, ["directions_raw", "directions", "instructions", "steps"])
    col_cuisine      = find_column(df, ["cuisine_list", "cuisine", "cuisine_type"])
    col_course       = find_column(df, ["course_list", "course", "meal_type", "course_type"])
    col_taste        = find_column(df, ["tastes", "primary_taste", "taste", "taste_profile", "flavor"])
    col_dietary      = find_column(df, ["dietary_profile", "dietary_tags", "dietary", "diet_tags", "diet"])
    col_prep         = find_column(df, ["est_prep_time_min", "prep_time", "preparation_time", "prep_minutes"])
    col_cook         = find_column(df, ["est_cook_time_min", "cook_time", "cooking_time", "cook_minutes"])
    col_difficulty   = find_column(df, ["difficulty", "difficulty_level"])
    col_health       = find_column(df, ["healthiness_score", "healthiness", "health_score"])
    col_main_ing     = find_column(df, ["main_ingredient", "primary_ingredient"])

    if not col_title or not col_ingredients:
        print("❌  Could not find required columns (title, ingredients) in the CSV.")
        print(f"    Found columns: {list(df.columns)}")
        sys.exit(1)

    create_db_and_tables()
    print("🗄️   Database tables created.\n")

    total = len(df)
    inserted = 0
    skipped = 0

    with Session(engine) as session:
        batch = []
        for idx, row in df.iterrows():
            title = safe_str(row.get(col_title, ""))
            if not title:
                skipped += 1
                continue

            recipe = Recipe(
                title=title,
                category=safe_str(row.get(col_category)) if col_category else None,
                ingredients=safe_parse_list(row.get(col_ingredients)),
                directions=safe_parse_list(row.get(col_directions)) if col_directions else "[]",
                cuisine=safe_str(row.get(col_cuisine)) if col_cuisine else None,
                course=safe_str(row.get(col_course)) if col_course else None,
                taste=safe_str(row.get(col_taste)) if col_taste else None,
                dietary_tags=safe_parse_list(row.get(col_dietary)) if col_dietary else "[]",
                prep_time=safe_int(row.get(col_prep)) if col_prep else None,
                cook_time=safe_int(row.get(col_cook)) if col_cook else None,
                difficulty=safe_str(row.get(col_difficulty)) if col_difficulty else None,
                healthiness=safe_float(row.get(col_health)) if col_health else None,
                main_ingredient=safe_str(row.get(col_main_ing)) if col_main_ing else None,
            )
            batch.append(recipe)

            if len(batch) >= BATCH_SIZE:
                session.bulk_save_objects(batch)
                session.commit()
                inserted += len(batch)
                batch = []
                pct = (idx + 1) / total * 100
                print(f"  ⏳  {inserted:,} / {total:,} inserted ({pct:.1f}%)...", end="\r")

        if batch:
            session.bulk_save_objects(batch)
            session.commit()
            inserted += len(batch)

    print(f"\n✅  Done! Inserted {inserted:,} recipes. Skipped {skipped} rows.\n")
    print("🚀  You can now start the server: uvicorn main:app --reload\n")


if __name__ == "__main__":
    seed()
