import os
import re
from collections.abc import AsyncIterator
from contextlib import asynccontextmanager
from typing import Annotated

from sqlalchemy import desc
from fastapi import Depends, FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from openai import AsyncOpenAI
from sqlmodel import Session, select

from data.Problem import Problem
from data.ProblemRecord import ProblemRecord
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
