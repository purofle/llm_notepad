from uuid import UUID

from pydantic import BaseModel

from data.ReviewRating import ReviewRating


class ReviewFeedbackRequest(BaseModel):
    problem_id: UUID
    rating: ReviewRating
