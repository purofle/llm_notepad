import os
import re
import json
from typing import Any

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from openai import AsyncOpenAI
from pydantic import BaseModel

from data.Problem import Problem

DATA_URL_PATTERN = re.compile(
    r"^data:(image/(png|jpeg|jpg|webp|gif));base64,[A-Za-z0-9+/=\s]+$",
    re.IGNORECASE,
)
MODEL_NAME = os.getenv("OPENAI_MODEL_NAME", "kimi-k2.5")
OPENAI_API_KEY = os.getenv("OPENAI_API_KEY")
OPENAI_BASE_URL = os.getenv("OPENAI_BASE_URL", "https://api.moonshot.cn/v1")
openai_client = AsyncOpenAI(api_key=OPENAI_API_KEY, base_url=OPENAI_BASE_URL)
tags = []

class UploadRequest(BaseModel):
    dataUrl: str


app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.post("/uploads")
async def upload_image(payload: UploadRequest) -> dict[str, Any]:
    if not DATA_URL_PATTERN.match(payload.dataUrl.strip()):
        raise HTTPException(status_code=400, detail="dataUrl invalid or unsupported format")
    try:
        # noinspection PyTypeChecker
        response = await openai_client.chat.completions.parse(
            model=MODEL_NAME,
            messages=[
                {
                    "role": "system",
                    "content":
                        "你是一个题目识别工具。用户会提供一道题目的图片，请识别并提取题目信息。"
                        "content 为题目文本内容，数学符号使用 LaTeX"
                        "type 为题目类型，仅允许“主观题”或“客观题”;"
                        "tags 为题目知识点标签列表；"
                        "subject 为题目所属学科；"
                        "answer 为题目答案，依旧使用 LaTeX 表示，无需分点，只需要提供简单的带过程回答；"
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
    parsed_problem = message.parsed

    if parsed_problem is None:
        raise HTTPException(status_code=502, detail="Failed to parse problem from OpenAI response")

    return {
        "result": parsed_problem.model_dump_json(indent=2),
        "problem": parsed_problem.model_dump(),
        "response_id": response.id,
    }
