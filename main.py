import json
import os
from datetime import datetime

from dotenv import load_dotenv
from fastapi import FastAPI, Depends, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session

from .db import Base, engine, get_db
from .models import User, Settings, TaskTemplate, TaskInstance, ShopItem, Month
from .schemas import (
    AuthIn,
    TokenOut,
    MonthStartIn,
    MonthStateOut,
    TaskTemplateIn,
    TaskTemplateOut,
    TaskInstanceOut,
    CompleteTaskIn,
    ShopItemIn,
    ShopItemOut,
    PurchaseOut,
    ChatMessageIn,
    ChatSpendAdviceIn,
    ChatOut,
)
from .auth import hash_password, verify_password, create_access_token, get_current_user
from .logic import (
    get_or_create_month,
    compute_month_state,
    generate_task_instances,
    complete_task_instance,
    skip_task_instance,
    can_purchase,
    purchase_item,
    default_exp_for_difficulty,
    build_chat_context,
)
from .gemini import gemini_chat


load_dotenv()

Base.metadata.create_all(bind=engine)

app = FastAPI(title="Hackathon Backend", debug=True)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://localhost:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/health")
def health():
    return {"status": "ok"}


@app.post("/auth/signup", response_model=TokenOut)
def signup(payload: AuthIn, db: Session = Depends(get_db)):
    existing = db.query(User).filter(User.email == payload.email).first()
    if existing:
        raise HTTPException(status_code=400, detail="Email already registered.")
    user = User(email=payload.email, password_hash=hash_password(payload.password))
    db.add(user)
    db.commit()
    db.refresh(user)
    settings = Settings(user_id=user.id)
    db.add(settings)
    db.commit()
    token = create_access_token({"sub": str(user.id), "email": user.email})
    return TokenOut(access_token=token)


@app.post("/auth/login", response_model=TokenOut)
def login(payload: AuthIn, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.email == payload.email).first()
    if not user or not verify_password(payload.password, user.password_hash):
        raise HTTPException(status_code=401, detail="Invalid email or password.")
    token = create_access_token({"sub": str(user.id), "email": user.email})
    return TokenOut(access_token=token)


@app.post("/month/start", response_model=MonthStateOut)
def month_start(
    payload: MonthStartIn,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    month = get_or_create_month(db, user.id, payload.income, payload.ratio)
    return MonthStateOut(**compute_month_state(month))


@app.get("/month/state", response_model=MonthStateOut)
def month_state(user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    today = datetime.utcnow().date()
    month = (
        db.query(Month)
        .filter_by(user_id=user.id, year=today.year, month=today.month)
        .first()
    )
    if not month:
        raise HTTPException(status_code=400, detail="Start the month first with /month/start.")
    return MonthStateOut(**compute_month_state(month))


@app.post("/tasks/template", response_model=TaskTemplateOut)
def create_template(
    payload: TaskTemplateIn,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    settings = db.query(Settings).filter(Settings.user_id == user.id).first()
    exp_value = payload.exp_value
    if exp_value is None:
        exp_value = default_exp_for_difficulty(settings, payload.difficulty)
    schedule_meta = json.dumps(payload.schedule_meta) if payload.schedule_meta else None
    template = TaskTemplate(
        user_id=user.id,
        title=payload.title,
        category=payload.category,
        difficulty=payload.difficulty,
        exp_value=int(exp_value),
        schedule_type=payload.schedule_type,
        schedule_meta=schedule_meta,
        active=payload.active,
    )
    db.add(template)
    db.commit()
    db.refresh(template)
    data = TaskTemplateOut.from_orm(template)
    if template.schedule_meta:
        data.schedule_meta = json.loads(template.schedule_meta)
    return data


@app.post("/tasks/generate")
def generate_tasks(
    date: str = Query(..., description="YYYY-MM-DD"),
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    try:
        target_date = datetime.strptime(date, "%Y-%m-%d").date()
    except ValueError as exc:
        raise HTTPException(status_code=400, detail="Invalid date format. Use YYYY-MM-DD.") from exc
    created = generate_task_instances(db, user.id, target_date)
    return {"date": date, "created": created}


@app.get("/tasks/instances", response_model=list[TaskInstanceOut])
def list_instances(
    date: str = Query(..., description="YYYY-MM-DD"),
    status: str | None = None,
    difficulty: str | None = None,
    category: str | None = None,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    try:
        datetime.strptime(date, "%Y-%m-%d")
    except ValueError as exc:
        raise HTTPException(status_code=400, detail="Invalid date format. Use YYYY-MM-DD.") from exc
    query = (
        db.query(TaskInstance, TaskTemplate)
        .join(TaskTemplate, TaskInstance.template_id == TaskTemplate.id)
        .filter(TaskInstance.user_id == user.id, TaskInstance.date == date)
    )
    if status:
        query = query.filter(TaskInstance.status == status)
    if difficulty:
        query = query.filter(TaskTemplate.difficulty == difficulty)
    if category:
        query = query.filter(TaskTemplate.category == category)
    results = []
    for instance, template in query.all():
        results.append(
            TaskInstanceOut(
                id=instance.id,
                template_id=instance.template_id,
                date=instance.date,
                status=instance.status,
                completion_note=instance.completion_note,
                completed_at=instance.completed_at,
                title=template.title,
                category=template.category,
                difficulty=template.difficulty,
                exp_value=template.exp_value,
            )
        )
    return results


@app.post("/tasks/instances/{instance_id}/complete")
def complete_instance(
    instance_id: int,
    payload: CompleteTaskIn,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    instance, awarded = complete_task_instance(db, user.id, instance_id, payload.note)
    return {
        "id": instance.id,
        "status": instance.status,
        "awarded_exp": awarded,
    }


@app.post("/tasks/instances/{instance_id}/skip")
def skip_instance(
    instance_id: int,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    instance = skip_task_instance(db, user.id, instance_id)
    return {"id": instance.id, "status": instance.status}


@app.post("/shop/item", response_model=ShopItemOut)
def create_shop_item(
    payload: ShopItemIn,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    exp_cost = payload.exp_cost if payload.exp_cost is not None else payload.tier
    item = ShopItem(
        user_id=user.id,
        name=payload.name,
        tier=payload.tier,
        exp_cost=int(exp_cost),
        cash_price=payload.cash_price,
        category=payload.category,
        active=payload.active,
    )
    db.add(item)
    db.commit()
    db.refresh(item)
    return ShopItemOut.from_orm(item)


@app.get("/shop/items", response_model=list[ShopItemOut])
def list_shop_items(
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    items = db.query(ShopItem).filter(ShopItem.user_id == user.id).all()
    return [ShopItemOut.from_orm(item) for item in items]


@app.post("/shop/purchase/{item_id}")
def purchase(
    item_id: int,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    ok, reason = can_purchase(db, user.id, item_id)
    if not ok:
        raise HTTPException(status_code=400, detail=reason)
    purchase_row = purchase_item(db, user.id, item_id)
    month_state = compute_month_state(
        db.query(Month).filter_by(id=purchase_row.month_id).first()
    )
    return {
        "purchase": PurchaseOut.from_orm(purchase_row),
        "month_state": month_state,
    }


@app.post("/chat/message", response_model=ChatOut)
async def chat_message(
    payload: ChatMessageIn,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    # Inject budget context here so the model can advise without enforcing logic.
    context_json = build_chat_context(db, user.id)
    # Gemini is advisory only; all enforcement stays in backend logic.
    prompt = (
        "You are the in-app Spending Coach for a gamified budgeting app.\n"
        "You MUST use only APP_CONTEXT below.\n"
        "If information is missing, ask ONE clarifying question.\n"
        "Do NOT guess numbers.\n"
        "Do NOT output JSON, code, or mention endpoints/DB/tokens/variables.\n"
        "You are advisory-only: never approve purchases or change balances.\n"
        "Keep replies under 4 sentences.\n"
        "You MUST reference at least one number from APP_CONTEXT in your answer.\n\n"
        f"APP_CONTEXT:\n{json.dumps(context_json, indent=2)}\n\n"
        f"USER_MESSAGE:\n{payload.message}"
    )
    response = await gemini_chat(prompt)
    return ChatOut(response=response)


@app.post("/chat/spend_advice", response_model=ChatOut)
async def chat_spend_advice(
    payload: ChatSpendAdviceIn,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    item = (
        db.query(ShopItem)
        .filter(ShopItem.user_id == user.id, ShopItem.id == payload.item_id)
        .first()
    )
    if not item:
        raise HTTPException(status_code=404, detail="Item not found.")
    context_json = build_chat_context(db, user.id)
    context_json["selected_item"] = {
        "id": item.id,
        "name": item.name,
        "tier": item.tier,
        "exp_cost": item.exp_cost,
        "cash_price": item.cash_price,
        "category": item.category,
    }
    prompt = (
        "You are the in-app Spending Coach for a gamified budgeting app.\n"
        "You MUST use only APP_CONTEXT below.\n"
        "If information is missing, ask ONE clarifying question.\n"
        "Do NOT guess numbers.\n"
        "Do NOT output JSON, code, or mention endpoints/DB/tokens/variables.\n"
        "You are advisory-only: never approve purchases or change balances.\n"
        "Keep replies under 4 sentences.\n"
        "You MUST reference at least one number from APP_CONTEXT in your answer.\n\n"
        f"APP_CONTEXT:\n{json.dumps(context_json, indent=2)}\n\n"
        "USER_MESSAGE:\nIs it wise to buy the selected item now? Provide brief advice."
    )
    response = await gemini_chat(prompt)
    return ChatOut(response=response)


@app.get("/chat/context")
def chat_context(
    date: str | None = None,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    if os.getenv("DEBUG_CHAT_CONTEXT") != "1":
        raise HTTPException(status_code=404, detail="Not found.")
    if date:
        try:
            datetime.strptime(date, "%Y-%m-%d")
        except ValueError as exc:
            raise HTTPException(status_code=400, detail="Invalid date format. Use YYYY-MM-DD.") from exc
    return build_chat_context(db, user.id, date_str=date)
