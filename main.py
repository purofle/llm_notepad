import os
import re
from collections.abc import AsyncIterator
from contextlib import asynccontextmanager
from datetime import datetime, timedelta, timezone
from typing import Annotated
from uuid import UUID

from sqlalchemy import desc
from fastapi import Depends, FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from openai import AsyncOpenAI
from sqlmodel import Session, select

from data.DeleteProblemResponse import DeleteProblemResponse
from data.Problem import Problem
from data.ProblemRecord import ProblemRecord
from data.ProblemReviewRecord import ProblemReviewRecord
from data.ProblemReviewState import ProblemReviewState
from data.ReviewFeedbackRequest import ReviewFeedbackRequest
from data.ReviewRating import ReviewRating
from data.ReviewRecommendationResponse import (
    ReviewRecommendationProblem,
    ReviewRecommendationResponse,
)
from data.UploadRequest import UploadRequest
from db import create_db_and_tables, get_session

DATA_URL_PATTERN = re.compile(
    r"^data:(image/(png|jpeg|jpg|webp|gif));base64,[A-Za-z0-9+/=\s]+$",
    re.IGNORECASE,
)
MODEL_NAME = os.getenv("OPENAI_MODEL_NAME", "kimi-k2.5")
OPENAI_API_KEY = os.getenv("OPENAI_API_KEY")
OPENAI_BASE_URL = os.getenv("OPENAI_BASE_URL", "https://api.moonshot.cn/v1")
openai_client = AsyncOpenAI(api_key=OPENAI_API_KEY, base_url=OPENAI_BASE_URL)
SessionDep = Annotated[Session, Depends(get_session)]


@asynccontextmanager
async def lifespan(_: FastAPI) -> AsyncIterator[None]:
    create_db_and_tables()
    yield


app = FastAPI(lifespan=lifespan)

# noinspection PyTypeChecker
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)


def build_system_prompt(session: Session) -> str:
    subjects = session.exec(select(ProblemRecord.subject)).all()
    unique_subjects = [subject for subject in dict.fromkeys(subjects) if subject]

    base_prompt = (
        "你是一个题目识别工具。用户会提供一道题目的图片，请识别并提取题目信息。"
        "content 为题目文本内容，数学符号使用 LaTeX"
        "type 为题目类型，仅允许“主观题”或“客观题”;"
        "tags 为题目知识点标签列表；"
        "subject 为题目所属学科，数学类学科应当写到细分学科，例如：线性代数、离散数学、高等数学，其他类只需要包括学科名。"
        "answer 为题目答案，依旧使用 LaTeX 表示，不应使用 markdown。无需分点，只需要提供简单的带过程回答；"
    )

    if not unique_subjects:
        return base_prompt

    return (
        f"{base_prompt}"
        f"目前数据库里已有的学科名有：{', '.join(unique_subjects)}。"
        "如果新题目明显属于这些已有学科之一，优先沿用已有写法，避免同一学科出现多个近义名称。"
    )


def utc_now() -> datetime:
    return datetime.now(timezone.utc)


def as_utc(dt: datetime) -> datetime:
    if dt.tzinfo is None:
        return dt.replace(tzinfo=timezone.utc)

    return dt.astimezone(timezone.utc)


def ensure_review_states(session: Session) -> tuple[list[ProblemRecord], dict[UUID, ProblemReviewState]]:
    problems = list(session.exec(select(ProblemRecord).order_by(ProblemRecord.created_at)).all())
    states = list(session.exec(select(ProblemReviewState)).all())
    state_by_problem_id = {state.problem_id: state for state in states}

    missing_states = [
        ProblemReviewState(problem_id=problem.id, due_at=as_utc(problem.created_at))
        for problem in problems
        if problem.id not in state_by_problem_id
    ]

    if missing_states:
        session.add_all(missing_states)
        session.commit()
        states = list(session.exec(select(ProblemReviewState)).all())
        state_by_problem_id = {state.problem_id: state for state in states}

    return problems, state_by_problem_id


def build_recommendation_response(session: Session) -> ReviewRecommendationResponse:
    problems, state_by_problem_id = ensure_review_states(session)
    now = utc_now()
    due_items: list[tuple[ProblemRecord, ProblemReviewState]] = []
    future_due_ats: list[datetime] = []

    for problem in problems:
        state = state_by_problem_id[problem.id]
        due_at = as_utc(state.due_at)

        if due_at <= now:
            due_items.append((problem, state))
        else:
            future_due_ats.append(due_at)

    due_items.sort(key=lambda item: (as_utc(item[1].due_at), as_utc(item[0].created_at)))

    if due_items:
        problem, state = due_items[0]
        recommendation_problem = ReviewRecommendationProblem(
            id=str(problem.id),
            content=problem.content,
            type=problem.type,
            subject=problem.subject,
            tags=problem.tags,
            answer=problem.answer,
            response_id=problem.response_id,
            created_at=as_utc(problem.created_at),
            due_at=as_utc(state.due_at),
        )
        next_due_at = as_utc(state.due_at)
    else:
        recommendation_problem = None
        next_due_at = min(future_due_ats) if future_due_ats else None

    return ReviewRecommendationResponse(
        problem=recommendation_problem,
        due_count=len(due_items),
        total_count=len(problems),
        next_due_at=next_due_at,
    )


def apply_review_feedback(
    state: ProblemReviewState,
    rating: ReviewRating,
    now: datetime,
) -> tuple[float, int, datetime]:
    ease_factor = state.ease_factor
    repetition = state.repetition
    interval_days = state.interval_days

    if rating == ReviewRating.FORGOT:
        return max(1.3, ease_factor - 0.2), 0, now + timedelta(minutes=10)

    if rating == ReviewRating.HARD:
        next_repetition = repetition + 1
        next_interval_days = 1 if repetition == 0 else max(1, round(interval_days * 1.2))
        return (
            max(1.3, ease_factor - 0.15),
            next_repetition,
            now + timedelta(days=next_interval_days),
        )

    if rating == ReviewRating.GOOD:
        next_repetition = repetition + 1
        if next_repetition == 1:
            next_interval_days = 1
        elif next_repetition == 2:
            next_interval_days = 6
        else:
            next_interval_days = max(1, round(interval_days * ease_factor))
        return ease_factor, next_repetition, now + timedelta(days=next_interval_days)

    next_repetition = repetition + 1
    next_ease_factor = ease_factor + 0.15
    if next_repetition == 1:
        next_interval_days = 4
    elif next_repetition == 2:
        next_interval_days = 8
    else:
        next_interval_days = max(1, round(interval_days * next_ease_factor * 1.3))
    return next_ease_factor, next_repetition, now + timedelta(days=next_interval_days)


@app.post("/uploads")
async def upload_image(
    payload: UploadRequest,
    session: SessionDep,
) -> dict[str, object]:
    if not DATA_URL_PATTERN.match(payload.dataUrl.strip()):
        raise HTTPException(status_code=400, detail="dataUrl invalid or unsupported format")
    try:
        # noinspection PyTypeChecker
        response = await openai_client.chat.completions.parse(
            model=MODEL_NAME,
            messages=[
                {
                    "role": "system",
                    "content": build_system_prompt(session),
                },
                {
                    "role": "user",
                    "content": [
                        {"type": "image_url", "image_url": {"url": payload.dataUrl}},
                    ],
                },
            ],
            extra_body={"thinking": {"type": "disabled"}},
            response_format=Problem,
        )
    except Exception as exc:
        raise HTTPException(status_code=502, detail=f"OpenAI request failed: {exc}") from exc

    message = response.choices[0].message
    parsed_problem: Problem = message.parsed

    if parsed_problem is None:
        raise HTTPException(status_code=502, detail="Failed to parse problem from OpenAI response")

    saved_problem = ProblemRecord(
        content=parsed_problem.content,
        type=parsed_problem.type,
        subject=parsed_problem.subject,
        tags=parsed_problem.tags,
        answer=parsed_problem.answer,
        response_id=response.id,
    )
    session.add(saved_problem)
    session.flush()
    session.add(
        ProblemReviewState(
            problem_id=saved_problem.id,
            due_at=as_utc(saved_problem.created_at),
        )
    )
    session.commit()
    session.refresh(saved_problem)

    return {
        "result": parsed_problem.model_dump_json(indent=2),
        "problem": parsed_problem.model_dump(),
        "response_id": response.id,
        "problem_id": str(saved_problem.id),
    }


# noinspection PyTypeChecker
@app.get("/problems")
def list_problems(session: SessionDep) -> list[ProblemRecord]:
    statement = select(ProblemRecord).order_by(desc(ProblemRecord.created_at))
    return list(session.exec(statement).all())


@app.get("/review/recommendation", response_model=ReviewRecommendationResponse)
def get_review_recommendation(session: SessionDep) -> ReviewRecommendationResponse:
    return build_recommendation_response(session)


@app.post("/review-records", response_model=ReviewRecommendationResponse)
def create_review_record(
    payload: ReviewFeedbackRequest,
    session: SessionDep,
) -> ReviewRecommendationResponse:
    problem = session.get(ProblemRecord, payload.problem_id)

    if problem is None:
        raise HTTPException(status_code=404, detail="Problem not found")

    ensure_review_states(session)
    state = session.get(ProblemReviewState, payload.problem_id)

    if state is None:
        raise HTTPException(status_code=500, detail="Review state missing")

    now = utc_now()
    state_due_at = as_utc(state.due_at)
    if state_due_at > now:
        raise HTTPException(status_code=409, detail="Problem is not due yet")

    previous_ease_factor = state.ease_factor
    previous_interval_days = state.interval_days
    previous_due_at = state_due_at

    next_ease_factor, next_repetition, next_due_at = apply_review_feedback(
        state,
        payload.rating,
        now,
    )
    next_interval_days = max(0, (next_due_at - now).days)

    if payload.rating == ReviewRating.FORGOT:
        state.lapse_count += 1

    state.ease_factor = next_ease_factor
    state.repetition = next_repetition
    state.interval_days = next_interval_days
    state.due_at = next_due_at
    state.last_reviewed_at = now
    state.updated_at = now

    session.add(
        ProblemReviewRecord(
            problem_id=payload.problem_id,
            rating=payload.rating,
            reviewed_at=now,
            ease_factor_before=previous_ease_factor,
            ease_factor_after=state.ease_factor,
            interval_days_before=previous_interval_days,
            interval_days_after=state.interval_days,
            due_at_before=previous_due_at,
            due_at_after=state.due_at,
        )
    )
    session.add(state)
    session.commit()

    return build_recommendation_response(session)


@app.delete("/problems/{problem_id}", response_model=DeleteProblemResponse)
def delete_problem(problem_id: UUID, session: SessionDep) -> DeleteProblemResponse:
    problem = session.get(ProblemRecord, problem_id)

    if problem is None:
        raise HTTPException(status_code=404, detail="Problem not found")

    review_state = session.get(ProblemReviewState, problem_id)
    if review_state is not None:
        session.delete(review_state)

    review_records = list(
        session.exec(
            select(ProblemReviewRecord).where(ProblemReviewRecord.problem_id == problem_id)
        ).all()
    )
    for review_record in review_records:
        session.delete(review_record)

    session.delete(problem)
    session.commit()

    return DeleteProblemResponse(
        problem_id=str(problem_id),
        message="Problem deleted",
    )
