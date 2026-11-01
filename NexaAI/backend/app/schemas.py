from datetime import datetime
from pydantic import BaseModel, ConfigDict, Field


class MessageOut(BaseModel):
    id: int
    role: str
    content: str
    created_at: datetime
    model_config = ConfigDict(from_attributes=True)


class ChatOut(BaseModel):
    id: int
    title: str
    created_at: datetime
    model_config = ConfigDict(from_attributes=True)


class ChatDetail(ChatOut):
    messages: list[MessageOut]
    model_config = ConfigDict(from_attributes=True)


class ChatCreate(BaseModel):
    title: str = Field(default="New chat", max_length=160)


class ChatRequest(BaseModel):
    message: str = Field(min_length=1, max_length=12000)
