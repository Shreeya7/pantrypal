from sqlmodel import SQLModel, Field, create_engine, Session
from typing import Optional
import os

DATABASE_URL = os.getenv("DATABASE_URL", "sqlite:///./pantrypal.db")

engine = create_engine(
    DATABASE_URL,
    connect_args={"check_same_thread": False} if "sqlite" in DATABASE_URL else {},
    echo=False,
)


def create_db_and_tables():
    SQLModel.metadata.create_all(engine)


def get_session():
    with Session(engine) as session:
        yield session
