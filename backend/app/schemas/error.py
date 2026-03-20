from pydantic import BaseModel


class ErrorDetail(BaseModel):
    code: str
    message: str
    fields: dict[str, str] | None = None
    retry_after: int | None = None


class ErrorResponse(BaseModel):
    error: ErrorDetail
