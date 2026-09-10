from pydantic import BaseModel
from datetime import datetime
from decimal import Decimal


class TransactionCreate(BaseModel):
    description: str
    amount: Decimal
    category: str = "uncategorized"


class TransactionOut(BaseModel):
    id: int
    description: str
    amount: Decimal
    category: str
    created_at: datetime

    class Config:
        from_attributes = True
