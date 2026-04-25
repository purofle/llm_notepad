# AGENTS.md

这是一个叫做赛博错题本的项目，旨在通过人工智能技术帮助学生更好地理解和解决各个科目的问题，项目使用 FastAPI 作为后端，使用 NextJS 作为前端框架。

## 前端
前端位于 `/frontend` 目录下，使用 app router 进行页面管理，使用 Tailwind CSS 进行样式设计。

## 后端
后端目前实现了以下接口：

- `POST /uploads`：接收前端上传的图片 data URL，使用 kimi-k2.5 模型识别题目并将结果写入数据库，同时为新题目创建复习状态。
  - Request Body：`UploadRequest`
  - Response Body：包含 `result`、`problem`、`response_id`、`problem_id`
  - 失败时返回 `400`（图片 data URL 格式不支持或无效）或 `502`（模型调用或解析失败）。
- `GET /problems`：从数据库返回题目列表，按创建时间倒序排列。
  - Response Body：`ProblemRecord[]`
- `GET /problems/{problem_id}`：从数据库返回指定题目，供学习页直达刷新时加载题目上下文。
  - Response Body：`ProblemRecord`
  - 题目不存在时返回 `404`。
- `DELETE /problems/{problem_id}`：删除指定题目，并同步删除该题目的复习状态和复习记录。
  - Response Body：`DeleteProblemResponse`
  - 题目不存在时返回 `404`。
- `GET /review/recommendation`：返回当前最需要复习的题目推荐、待复习数量、题目总数以及下一次到期时间。
  - Response Body：`ReviewRecommendationResponse`
- `POST /review-records`：提交一次题目复习反馈，写入复习记录，更新间隔重复状态，并返回下一道复习推荐。
  - Request Body：`ReviewFeedbackRequest`
  - Response Body：`ReviewRecommendationResponse`
  - 题目不存在时返回 `404`；题目尚未到期时返回 `409`。
- `POST /study/chat`：提交指定题目的 Study Mode 对话历史，后端注入题目上下文和教学 system prompt，并以 SSE 流式返回 AI 回复增量。
  - Request Body：`StudyChatRequest`
  - Response Body：`text/event-stream`，每条 `data` 为 `StudyChatEvent`
  - `StudyChatRequest.messages` 仅允许 `user` 和 `assistant` 角色，前端不能传入 system prompt。
  - `StudyChatEvent.type` 固定为 `delta`、`done`、`error`；`delta` 携带增量文本，`error` 携带错误信息。
  - 题目不存在时返回 `404`；模型调用或流式解析失败时返回 `error` 事件。

当添加后端接口时，**必须** 在 `test_main.http` 中添加相应的测试用例。
后端接口的 Request Body 和 Response Body 的格式 **必须** 使用 Pydantic BaseModel 定义的模型，目前放置在 `data` 目录下。
API **应该** 使用 Restful 风格设计，尽可能使用标准的 HTTP 方法和状态码。
每次添加修改接口时，**必须** 更新 AGENTS.md 中的接口文档，确保文档与代码保持一致。

## 前后端联调
前端错题列表页应优先从后端 `/problems` 接口获取数据，不应再把它作为仅保存在浏览器本地的数据源。
