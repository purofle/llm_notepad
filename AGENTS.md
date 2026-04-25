# AGENTS.md

这是一个叫做赛博错题本的项目，旨在通过人工智能技术帮助学生更好地理解和解决各个科目的问题，项目使用 FastAPI 作为后端，使用 NextJS 作为前端框架。

## 前端
前端位于 `/frontend` 目录下，使用 app router 进行页面管理，使用 Tailwind CSS 进行样式设计。

前端编译测试时因为

## 后端
后端目前实现了以下接口：

- `POST /uploads`：接收前端上传的图片，使用 kimi-k2.5 模型识别题目并将结果写入数据库。
- `GET /problems`：从数据库返回题目列表，按创建时间倒序排列。

当添加后端接口时，**必须** 在test_main.http 中添加相应的测试用例。
后端接口的 Request Body 和 Response Body 的格式 **必须** 使用使用 Pydantic BaseModel 定义的模型，目前放置在 `data` 目录下。
API **应该** 使用 Restful 风格设计，尽可能使用标准的 HTTP 方法和状态码。

## 前后端联调
前端错题列表页应优先从后端 `/problems` 接口获取数据，不应再把它作为仅保存在浏览器本地的数据源。
