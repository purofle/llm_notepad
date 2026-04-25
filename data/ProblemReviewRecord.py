from datetime import datetime, timezone
from uuid import UUID, uuid4

from sqlmodel import Field, SQLModel

from data.ReviewRating import ReviewRating


class ProblemReviewRecord(SQLModel, table=True):
    id: UUID = Field(default_factory=uuid4, primary_key=True)
    problem_id: UUID = Field(foreign_key="problemrecord.id", index=True)
    rating: ReviewRating = Field(nullable=False)
    reviewed_at: datetime = Field(
        default_factory=lambda: datetime.now(timezone.utc),
        nullable=False,
    )
    ease_factor_before: float
    ease_factor_after: float
    interval_days_before: int
    interval_days_after: int
    due_at_before: datetime
    due_at_after: datetime
