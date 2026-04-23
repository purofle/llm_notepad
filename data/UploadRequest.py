from pydantic import BaseModel


class UploadRequest(BaseModel):
    dataUrl: str
