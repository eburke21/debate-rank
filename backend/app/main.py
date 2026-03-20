from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from starlette.responses import JSONResponse

from app.api.arguments import router as arguments_router
from app.api.health import router as health_router
from app.api.topics import router as topics_router
from app.config import settings
from app.middleware.rate_limit import RateLimitMiddleware

app = FastAPI(title="DebateRank", version="0.1.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origin_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
app.add_middleware(RateLimitMiddleware)

app.include_router(health_router)
app.include_router(topics_router)
app.include_router(arguments_router)


@app.exception_handler(RequestValidationError)
async def validation_exception_handler(request: Request, exc: RequestValidationError):
    """Transform Pydantic validation errors into the standard error envelope."""
    fields = {}
    for error in exc.errors():
        loc = error.get("loc", ())
        # Skip the first element ("body", "query", etc.) to get the field name
        field_name = ".".join(str(part) for part in loc[1:]) if len(loc) > 1 else str(loc[0])
        fields[field_name] = error.get("msg", "Invalid value")

    return JSONResponse(
        status_code=422,
        content={
            "error": {
                "code": "VALIDATION_ERROR",
                "message": "Request validation failed.",
                "fields": fields,
            }
        },
    )
