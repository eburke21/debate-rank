from fastapi import APIRouter

router = APIRouter(tags=["health"])


@router.get("/api/health")
async def health_check():
    return {"status": "healthy", "version": "0.1.0"}
