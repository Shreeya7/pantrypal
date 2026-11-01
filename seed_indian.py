#!/usr/bin/env python3
"""
Seed script for the Indian Recipes Dataset (Cleaned Version).
Place your downloaded CSV at: backend/data/indian_recipes.csv

Columns expected:
  TranslatedRecipeName, TranslatedIngredients, PrepTimeInMins,
  CookTimeInMins, TotalTimeInMins, Servings, Cuisine, Course,
  Diet, TranslatedInstructions, URL, Cleaned-Ingredients,
  image-url, Ingredient-count

Usage: python scripts/seed_indian.py
"""

from __future__ import annotations
import sys, os, json, ast
from typing import Optional

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

import pandas as pd
from sqlmodel import Session
from database import engine, create_db_and_tables
from models import Recipe

CSV_PATH = os.path.join(os.path.dirname(os.path.dirname(__file__)), "data", "indian_recipes.csv")
BATCH_SIZE = 500


def safe_list_str(value) -> str:
    if pd.isna(value) or not value:
        return "[]"
    s = str(value).strip()
    # Comma-separated string → JSON list
    parts = [p.strip().strip("'\"") for p in s.split(",") if p.strip()]
    return json.dumps(parts)


def safe_int(value) -> Optional[int]:
    try:
        v = float(value)
        return int(v) if v == v else None
    except (TypeError, ValueError):
        return None


def safe_str(value) -> Optional[str]:
    if pd.isna(value) or value is None:
        return None
    s = str(value).strip()
    return s if s and s.lower() != "nan" else None


def directions_to_list(text) -> str:
    """Split instruction text into steps."""
    if pd.isna(text) or not text:
        return "[]"
    t = str(text).strip()
    # Split on numbered steps or newlines
    import re
    steps = re.split(r'\n+|\r\n+|(?<=\.)\s+(?=[A-Z])', t)
    steps = [s.strip() for s in steps if len(s.strip()) > 10]
    return json.dumps(steps) if steps else json.dumps([t])


def diet_to_tags(diet_str) -> str:
    if pd.isna(diet_str) or not diet_str:
        return "[]"
    d = str(diet_str).lower()
    tags = []
    if "vegan" in d:
        tags.append("vegan")
    if "vegetarian" in d:
        tags.append("vegetarian")
    if "non vegetarian" in d or "non-vegetarian" in d:
        tags.append("non-vegetarian")
    if "eggetarian" in d:
        tags.append("eggetarian")
    return json.dumps(tags) if tags else json.dumps([diet_str])


def seed():
    if not os.path.exists(CSV_PATH):
        print(f"\n❌  CSV not found at: {CSV_PATH}")
        print("   Download from: https://www.kaggle.com/datasets/sooryaprakash12/cleaned-indian-recipes-dataset")
        print("   Rename the CSV to 'indian_recipes.csv' and place it at the path above.\n")
        sys.exit(1)

    print(f"📖  Reading CSV: {CSV_PATH}")
    df = pd.read_csv(CSV_PATH, low_memory=False)
    print(f"✅  Loaded {len(df):,} rows, {len(df.columns)} columns")
    print(f"    Columns: {list(df.columns)}\n")

    # Find column names flexibly
    cols = {c.lower().replace("-", "").replace("_", "").replace(" ", ""): c for c in df.columns}

    def col(candidates):
        for c in candidates:
            key = c.lower().replace("-", "").replace("_", "").replace(" ", "")
            if key in cols:
                return cols[key]
        return None

    col_title   = col(["translatedrecipename", "recipename", "title", "name"])
    col_ings    = col(["cleanedingredients", "translatedingedients", "translatedingredients", "ingredients"])
    col_dirs    = col(["translatedinstructions", "instructions", "directions"])
    col_prep    = col(["preptimeinmins", "preptime"])
    col_cook    = col(["cooktimeinmins", "cooktime"])
    col_cuisine = col(["cuisine"])
    col_course  = col(["course"])
    col_diet    = col(["diet"])
    col_image   = col(["imageurl", "image-url", "imgurl"])

    if not col_title or not col_ings:
        print(f"❌  Could not find required columns. Found: {list(df.columns)}")
        sys.exit(1)

    create_db_and_tables()

    inserted = 0
    skipped = 0
    total = len(df)

    with Session(engine) as session:
        batch = []
        for idx, row in df.iterrows():
            title = safe_str(row.get(col_title, ""))
            if not title:
                skipped += 1
                continue

            ings_raw = safe_str(row.get(col_ings, "")) or ""

            recipe = Recipe(
                title=title,
                category="Indian",
                ingredients=safe_list_str(ings_raw),
                directions=directions_to_list(row.get(col_dirs)) if col_dirs else "[]",
                cuisine="Indian",
                course=safe_str(row.get(col_course)) if col_course else None,
                taste=None,
                dietary_tags=diet_to_tags(row.get(col_diet)) if col_diet else "[]",
                prep_time=safe_int(row.get(col_prep)) if col_prep else None,
                cook_time=safe_int(row.get(col_cook)) if col_cook else None,
                difficulty=None,
                healthiness=None,
                main_ingredient=None,
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

    print(f"\n✅  Done! Inserted {inserted:,} Indian recipes. Skipped {skipped} rows.\n")
    print("🚀  Restart the server to use the new recipes: uvicorn main:app --reload\n")


if __name__ == "__main__":
    seed()
