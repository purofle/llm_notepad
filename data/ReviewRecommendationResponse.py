from datetime import datetime

from pydantic import BaseModel


class ReviewRecommendationProblem(BaseModel):
    id: str
    content: str
    type: str
    subject: str
    tags: list[str]
    answer: str
    response_id: str
    created_at: datetime
    due_at: datetime


class ReviewRecommendationResponse(BaseModel):
    problem: ReviewRecommendationProblem | None
    due_count: int
    total_count: int
    next_due_at: datetime | None
