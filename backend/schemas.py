from datetime import datetime
from typing import Optional, List
from pydantic import BaseModel, Field


class TokenOut(BaseModel):
    access_token: str
    token_type: str = "bearer"


class AuthIn(BaseModel):
    email: str
    password: str


class MonthStartIn(BaseModel):
    income: float = Field(gt=0)
    ratio: float = Field(default=1.0, gt=0)


class MonthStateOut(BaseModel):
    year: int
    month: int
    income: float
    ratio: float
    needs_planned: float
    savings_planned: float
    psp_total: float
    cash_spent: float
    exp_earned: float
    exp_redeemed: float
    exp_cap: float
    exp_available: float
    unlocked_cash: float
    cash_available: float
    locked_cash: float
    projected_rollover_to_savings: float
    pie: dict


class TaskTemplateIn(BaseModel):
    title: str
    category: Optional[str] = None
    difficulty: str
    exp_value: Optional[int] = None
    schedule_type: str
    schedule_meta: Optional[dict] = None
    active: bool = True


class TaskTemplateOut(BaseModel):
    id: int
    title: str
    category: Optional[str] = None
    difficulty: str
    exp_value: int
    schedule_type: str
    schedule_meta: Optional[dict] = None
    active: bool

    class Config:
        from_attributes = True


class TaskInstanceOut(BaseModel):
    id: int
    template_id: int
    date: str
    status: str
    completion_note: Optional[str] = None
    completed_at: Optional[datetime] = None
    title: str
    category: Optional[str] = None
    difficulty: str
    exp_value: int


class CompleteTaskIn(BaseModel):
    note: str


class ShopItemIn(BaseModel):
    name: str
    tier: int
    exp_cost: Optional[int] = None
    cash_price: float = Field(gt=0)
    category: Optional[str] = None
    active: bool = True


class ShopItemOut(BaseModel):
    id: int
    name: str
    tier: int
    exp_cost: int
    cash_price: float
    category: Optional[str] = None
    active: bool

    class Config:
        from_attributes = True


class PurchaseOut(BaseModel):
    id: int
    item_id: int
    exp_spent: float
    cash_spent: float
    purchased_at: datetime

    class Config:
        from_attributes = True


class ChatMessageIn(BaseModel):
    message: str


class ChatSpendAdviceIn(BaseModel):
    item_id: int


class ChatOut(BaseModel):
    response: str
