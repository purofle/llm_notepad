from typing import Literal

from pydantic import BaseModel


class StudyChatEvent(BaseModel):
    type: Literal["delta", "done", "error"]
    delta: str = ""
    error: str | None = None
