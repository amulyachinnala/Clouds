import json
from datetime import datetime, date as date_cls
from typing import Optional, Tuple, Dict

from fastapi import HTTPException
from sqlalchemy.orm import Session

from .models import Month, TaskTemplate, TaskInstance, ShopItem, Purchase, Settings

def get_or_create_month(db: Session, user_id: int, income: float, ratio: float) -> Month:
    today = datetime.utcnow().date()
    row = (
        db.query(Month)
        .filter(Month.user_id == user_id, Month.year == today.year, Month.month == today.month)
        .first()
    )
    needs = round(income * 0.5, 2)
    savings = round(income * 0.3, 2)
    psp = round(income * 0.2, 2)
    if row:
        row.income = income
        row.ratio = ratio
        row.needs_planned = needs
        row.savings_planned = savings
        row.psp_total = psp
    else:
        row = Month(
            user_id=user_id,
            year=today.year,
            month=today.month,
            income=income,
            ratio=ratio,
            needs_planned=needs,
            savings_planned=savings,
            psp_total=psp,
            cash_spent=0.0,
            exp_earned=0.0,
            exp_redeemed=0.0,
            savings_actual=0.0,
        )
        db.add(row)
    db.commit()
    db.refresh(row)
    return row


def compute_month_state(month: Month) -> Dict[str, float]:
    ratio = month.ratio if month.ratio > 0 else 1.0
    exp_cap = round(month.psp_total / ratio, 2)
    exp_available = round(month.exp_earned - month.exp_redeemed, 2)
    unlocked_cash = round(min(month.exp_earned * ratio, month.psp_total), 2)
    cash_available = round(max(unlocked_cash - month.cash_spent, 0.0), 2)  # clamp >= 0
    locked_cash = round(max(month.psp_total - unlocked_cash, 0.0), 2)  # clamp >= 0
    remaining_psp = locked_cash
    projected_rollover = round(month.savings_planned + remaining_psp, 2)
    return {
        "year": month.year,
        "month": month.month,
        "income": month.income,
        "ratio": ratio,
        "needs_planned": month.needs_planned,
        "savings_planned": month.savings_planned,
        "psp_total": month.psp_total,
        "cash_spent": month.cash_spent,
        "exp_earned": month.exp_earned,
        "exp_redeemed": month.exp_redeemed,
        "exp_cap": exp_cap,
        "exp_available": exp_available,
        "unlocked_cash": unlocked_cash,
        "cash_available": cash_available,
        "locked_cash": locked_cash,
        "projected_rollover_to_savings": projected_rollover,
        "pie": {
            "planned": {
                "Needs": round(max(month.needs_planned, 0.0), 2),
                "Savings": round(max(month.savings_planned, 0.0), 2),
                "Spend Pool": round(max(month.psp_total, 0.0), 2),
            },
            "spend_status": {
                "Spent": round(max(month.cash_spent, 0.0), 2),
                "Unlocked Remaining": cash_available,
                "Locked Spend": locked_cash,
            },
        },
    }


def _schedule_matches(template: TaskTemplate, target_date: date_cls) -> bool:
    meta = {}
    if template.schedule_meta:
        try:
            meta = json.loads(template.schedule_meta)
        except json.JSONDecodeError:
            meta = {}
    if template.schedule_type == "daily":
        return True
    if template.schedule_type == "one_time":
        return meta.get("date") == target_date.strftime("%Y-%m-%d")
    if template.schedule_type == "weekly":
        weekdays = meta.get("weekdays", [])
        return target_date.strftime("%A").lower() in [d.lower() for d in weekdays]
    if template.schedule_type == "monthly":
        day = meta.get("day")
        return day == target_date.day
    return False


def generate_task_instances(db: Session, user_id: int, target_date: date_cls) -> int:
    templates = (
        db.query(TaskTemplate)
        .filter(TaskTemplate.user_id == user_id, TaskTemplate.active == True)  # noqa: E712
        .all()
    )
    created = 0
    for template in templates:
        if not _schedule_matches(template, target_date):
            continue
        existing = (
            db.query(TaskInstance)
            .filter(
                TaskInstance.user_id == user_id,
                TaskInstance.template_id == template.id,
                TaskInstance.date == target_date.strftime("%Y-%m-%d"),
            )
            .first()
        )
        if existing:
            continue
        instance = TaskInstance(
            user_id=user_id,
            template_id=template.id,
            date=target_date.strftime("%Y-%m-%d"),
            status="pending",
        )
        db.add(instance)
        created += 1
    db.commit()
    return created


def _current_month(db: Session, user_id: int) -> Month:
    today = datetime.utcnow().date()
    month = (
        db.query(Month)
        .filter(Month.user_id == user_id, Month.year == today.year, Month.month == today.month)
        .first()
    )
    if not month:
        raise HTTPException(status_code=400, detail="Start the month first with /month/start.")
    return month


def complete_task_instance(db: Session, user_id: int, instance_id: int, note: str) -> Tuple[TaskInstance, float]:
    if len(note.strip()) < 8:
        raise HTTPException(status_code=400, detail="Completion note must be at least 8 characters.")
    instance = (
        db.query(TaskInstance)
        .filter(TaskInstance.user_id == user_id, TaskInstance.id == instance_id)
        .first()
    )
    if not instance:
        raise HTTPException(status_code=404, detail="Task instance not found.")
    if instance.status != "pending":
        raise HTTPException(status_code=400, detail="Task instance is not pending.")
    month = _current_month(db, user_id)
    state = compute_month_state(month)
    template = instance.template
    cap_remaining = max(state["exp_cap"] - month.exp_earned, 0.0)
    awarded = float(min(template.exp_value, cap_remaining))
    instance.status = "completed"
    instance.completion_note = note.strip()
    instance.completed_at = datetime.utcnow()
    if awarded > 0:
        month.exp_earned = round(month.exp_earned + awarded, 2)
    db.commit()
    db.refresh(instance)
    return instance, awarded


def skip_task_instance(db: Session, user_id: int, instance_id: int) -> TaskInstance:
    instance = (
        db.query(TaskInstance)
        .filter(TaskInstance.user_id == user_id, TaskInstance.id == instance_id)
        .first()
    )
    if not instance:
        raise HTTPException(status_code=404, detail="Task instance not found.")
    if instance.status != "pending":
        raise HTTPException(status_code=400, detail="Task instance is not pending.")
    instance.status = "skipped"
    db.commit()
    db.refresh(instance)
    return instance


def can_purchase(db: Session, user_id: int, item_id: int) -> Tuple[bool, str]:
    item = (
        db.query(ShopItem)
        .filter(ShopItem.user_id == user_id, ShopItem.id == item_id, ShopItem.active == True)  # noqa: E712
        .first()
    )
    if not item:
        return False, "Item not found."
    month = _current_month(db, user_id)
    state = compute_month_state(month)
    if item.exp_cost > state["exp_available"]:
        return False, "Not enough EXP available."
    if item.cash_price > state["cash_available"]:
        return False, "Not enough unlocked cash available."
    return True, "OK"


def purchase_item(db: Session, user_id: int, item_id: int) -> Purchase:
    item = (
        db.query(ShopItem)
        .filter(ShopItem.user_id == user_id, ShopItem.id == item_id, ShopItem.active == True)  # noqa: E712
        .first()
    )
    if not item:
        raise HTTPException(status_code=404, detail="Item not found.")
    month = _current_month(db, user_id)
    state = compute_month_state(month)
    if item.exp_cost > state["exp_available"]:
        raise HTTPException(status_code=400, detail="Not enough EXP available.")
    if item.cash_price > state["cash_available"]:
        raise HTTPException(status_code=400, detail="Not enough unlocked cash available.")
    purchase = Purchase(
        user_id=user_id,
        month_id=month.id,
        item_id=item.id,
        exp_spent=float(item.exp_cost),
        cash_spent=float(item.cash_price),
    )
    month.exp_redeemed = round(month.exp_redeemed + item.exp_cost, 2)
    month.cash_spent = round(month.cash_spent + item.cash_price, 2)
    db.add(purchase)
    db.commit()
    db.refresh(purchase)
    return purchase


def default_exp_for_difficulty(settings: Settings, difficulty: str) -> int:
    mapping = {
        "easy": settings.easy_exp,
        "med": settings.med_exp,
        "medium": settings.med_exp,
        "hard": settings.hard_exp,
    }
    return int(mapping.get(difficulty, settings.easy_exp))


def build_chat_context(
    db: Session,
    user_id: int,
    date_str: Optional[str] = None,
    top_n_items: int = 5,
) -> Dict:
    target_date = (
        datetime.strptime(date_str, "%Y-%m-%d").date()
        if date_str
        else datetime.utcnow().date()
    )
    month = _current_month(db, user_id)
    month_state = compute_month_state(month)

    instances = (
        db.query(TaskInstance)
        .join(TaskTemplate, TaskInstance.template_id == TaskTemplate.id)
        .filter(TaskInstance.user_id == user_id, TaskInstance.date == target_date.strftime("%Y-%m-%d"))
        .all()
    )
    pending_today = 0
    completed_today = 0
    next_tasks = []
    for inst in instances:
        if inst.status == "pending":
            pending_today += 1
            if len(next_tasks) < 3:
                next_tasks.append(
                    {
                        "title": inst.template.title,
                        "exp_value": inst.template.exp_value,
                        "instance_id": inst.id,
                    }
                )
        elif inst.status == "completed":
            completed_today += 1

    items = (
        db.query(ShopItem)
        .filter(ShopItem.user_id == user_id, ShopItem.active == True)  # noqa: E712
        .limit(top_n_items)
        .all()
    )
    suggested_items = [
        {
            "id": item.id,
            "name": item.name,
            "tier": item.tier,
            "exp_cost": item.exp_cost,
            "cash_price": item.cash_price,
            "category": item.category,
        }
        for item in items
    ]

    settings = db.query(Settings).filter(Settings.user_id == user_id).first()
    settings_payload = None
    if settings:
        settings_payload = {
            "easy_exp": settings.easy_exp,
            "med_exp": settings.med_exp,
            "hard_exp": settings.hard_exp,
            "tier_low": settings.tier_low,
            "tier_mid": settings.tier_mid,
            "tier_high": settings.tier_high,
        }

    return {
        "month_state": month_state,
        "task_summary": {
            "date": target_date.strftime("%Y-%m-%d"),
            "pending_today": pending_today,
            "completed_today": completed_today,
            "next_tasks": next_tasks,
        },
        "shop_summary": {"suggested_items": suggested_items},
        "settings": settings_payload,
        "rules": {
            "advisory_only": True,
            "cannot_spend_more_than_cash_available": True,
            "cannot_spend_more_exp_than_exp_available": True,
        },
    }
