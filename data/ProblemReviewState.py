from datetime import datetime, timezone
from uuid import UUID

from sqlmodel import Field, SQLModel


class ProblemReviewState(SQLModel, table=True):
    problem_id: UUID = Field(foreign_key="problemrecord.id", primary_key=True)
    ease_factor: float = Field(default=2.5, nullable=False)
    repetition: int = Field(default=0, nullable=False)
    interval_days: int = Field(default=0, nullable=False)
    lapse_count: int = Field(default=0, nullable=False)
    due_at: datetime = Field(nullable=False)
    last_reviewed_at: datetime | None = Field(default=None, nullable=True)
    created_at: datetime = Field(
        default_factory=lambda: datetime.now(timezone.utc),
        nullable=False,
    )
    updated_at: datetime = Field(
        default_factory=lambda: datetime.now(timezone.utc),
        nullable=False,
    )
