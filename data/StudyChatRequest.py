from typing import Literal
from uuid import UUID

from pydantic import BaseModel, Field


class StudyChatMessage(BaseModel):
    role: Literal["user", "assistant"]
    content: str = Field(min_length=1)


class StudyChatRequest(BaseModel):
    problem_id: UUID
    messages: list[StudyChatMessage]
