from __future__ import annotations
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlmodel import Session, select
from datetime import date, timedelta
from typing import Optional

from database import get_session
from models import FridgeItem

router = APIRouter(prefix="/api/inventory", tags=["inventory"])


@router.get("")
def list_items(session: Session = Depends(get_session)):
    items = session.exec(select(FridgeItem).order_by(FridgeItem.expires_at)).all()
    return [item_dict(i) for i in items]


@router.get("/expiring")
def expiring_items(
    days: int = Query(3, ge=1, le=30),
    session: Session = Depends(get_session),
):
    """Items expiring within `days` days (default 3)."""
    cutoff = date.today() + timedelta(days=days)
    items = session.exec(
        select(FridgeItem)
        .where(FridgeItem.expires_at != None)
        .where(FridgeItem.expires_at <= cutoff)
        .order_by(FridgeItem.expires_at)
    ).all()
    return [item_dict(i) for i in items]


@router.post("", status_code=201)
def add_item(body: dict, session: Session = Depends(get_session)):
    item = FridgeItem(
        name=body.get("name", "").strip(),
        quantity=body.get("quantity"),
        category=body.get("category"),
        purchased_at=_parse_date(body.get("purchased_at")),
        expires_at=_parse_date(body.get("expires_at")),
    )
    if not item.name:
        raise HTTPException(status_code=422, detail="name is required")
    session.add(item)
    session.commit()
    session.refresh(item)
    return item_dict(item)


@router.put("/{item_id}")
def update_item(item_id: int, body: dict, session: Session = Depends(get_session)):
    item = session.get(FridgeItem, item_id)
    if not item:
        raise HTTPException(status_code=404, detail="Item not found")
    for field in ("name", "quantity", "category"):
        if field in body:
            setattr(item, field, body[field])
    if "purchased_at" in body:
        item.purchased_at = _parse_date(body["purchased_at"])
    if "expires_at" in body:
        item.expires_at = _parse_date(body["expires_at"])
    session.add(item)
    session.commit()
    session.refresh(item)
    return item_dict(item)


@router.delete("/{item_id}", status_code=204)
def delete_item(item_id: int, session: Session = Depends(get_session)):
    item = session.get(FridgeItem, item_id)
    if not item:
        raise HTTPException(status_code=404, detail="Item not found")
    session.delete(item)
    session.commit()


def item_dict(i: FridgeItem) -> dict:
    today = date.today()
    days_left = None
    urgency = "ok"
    if i.expires_at:
        days_left = (i.expires_at - today).days
        if days_left < 0:
            urgency = "expired"
        elif days_left <= 3:
            urgency = "critical"
        elif days_left <= 7:
            urgency = "warning"

    return {
        "id": i.id,
        "name": i.name,
        "quantity": i.quantity,
        "category": i.category,
        "purchased_at": i.purchased_at.isoformat() if i.purchased_at else None,
        "expires_at": i.expires_at.isoformat() if i.expires_at else None,
        "days_left": days_left,
        "urgency": urgency,
    }


def _parse_date(val) -> Optional[date]:
    if not val:
        return None
    try:
        return date.fromisoformat(str(val))
    except ValueError:
        return None
