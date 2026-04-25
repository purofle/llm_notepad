from pydantic import BaseModel


class DeleteProblemResponse(BaseModel):
    problem_id: str
    message: str
