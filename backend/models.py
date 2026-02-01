from datetime import datetime
from sqlalchemy import (
    Column,
    Integer,
    String,
    Float,
    Boolean,
    DateTime,
    ForeignKey,
    Text,
    UniqueConstraint,
)
from sqlalchemy.orm import relationship

from .db import Base


class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    email = Column(String, unique=True, index=True, nullable=False)
    password_hash = Column(String, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)

    settings = relationship("Settings", back_populates="user", uselist=False)


class Settings(Base):
    __tablename__ = "settings"

    user_id = Column(Integer, ForeignKey("users.id"), primary_key=True)
    easy_exp = Column(Integer, default=5, nullable=False)
    med_exp = Column(Integer, default=10, nullable=False)
    hard_exp = Column(Integer, default=20, nullable=False)
    tier_low = Column(Integer, default=100, nullable=False)
    tier_mid = Column(Integer, default=150, nullable=False)
    tier_high = Column(Integer, default=200, nullable=False)

    user = relationship("User", back_populates="settings")


class Month(Base):
    __tablename__ = "months"
    __table_args__ = (UniqueConstraint("user_id", "year", "month", name="uniq_user_month"),)

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    year = Column(Integer, nullable=False)
    month = Column(Integer, nullable=False)
    income = Column(Float, nullable=False)
    ratio = Column(Float, nullable=False, default=1.0)
    needs_planned = Column(Float, nullable=False, default=0.0)
    savings_planned = Column(Float, nullable=False, default=0.0)
    psp_total = Column(Float, nullable=False, default=0.0)
    cash_spent = Column(Float, nullable=False, default=0.0)
    exp_earned = Column(Float, nullable=False, default=0.0)
    exp_redeemed = Column(Float, nullable=False, default=0.0)
    savings_actual = Column(Float, nullable=False, default=0.0)


class TaskTemplate(Base):
    __tablename__ = "task_templates"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    title = Column(String, nullable=False)
    category = Column(String, nullable=True)
    difficulty = Column(String, nullable=False)
    exp_value = Column(Integer, nullable=False)
    schedule_type = Column(String, nullable=False)
    schedule_meta = Column(Text, nullable=True)
    active = Column(Boolean, default=True, nullable=False)


class TaskInstance(Base):
    __tablename__ = "task_instances"
    __table_args__ = (
        UniqueConstraint("user_id", "template_id", "date", name="uniq_user_template_date"),
    )

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    template_id = Column(Integer, ForeignKey("task_templates.id"), nullable=False)
    date = Column(String, nullable=False)
    status = Column(String, nullable=False, default="pending")
    completion_note = Column(Text, nullable=True)
    completed_at = Column(DateTime, nullable=True)

    template = relationship("TaskTemplate")


class ShopItem(Base):
    __tablename__ = "shop_items"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    name = Column(String, nullable=False)
    tier = Column(Integer, nullable=False)
    exp_cost = Column(Integer, nullable=False)
    cash_price = Column(Float, nullable=False)
    category = Column(String, nullable=True)
    active = Column(Boolean, default=True, nullable=False)


class Purchase(Base):
    __tablename__ = "purchases"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    month_id = Column(Integer, ForeignKey("months.id"), nullable=False)
    item_id = Column(Integer, ForeignKey("shop_items.id"), nullable=False)
    exp_spent = Column(Float, nullable=False)
    cash_spent = Column(Float, nullable=False)
    purchased_at = Column(DateTime, default=datetime.utcnow, nullable=False)

    item = relationship("ShopItem")
