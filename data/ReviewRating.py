from enum import Enum


class ReviewRating(str, Enum):
    FORGOT = "forgot"
    HARD = "hard"
    GOOD = "good"
    EASY = "easy"
