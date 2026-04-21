from pydantic import BaseModel
from typing import List


class Problem(BaseModel):
    content: str
    type: str
    subject: str
    tags: List[str]
    answer: str