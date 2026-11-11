import logging
import os

from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from backend.app.detection.rules import analyze_content
from backend.app.schemas.analysis import AnalysisRequest, AnalysisResponse

logging.basicConfig(level=os.getenv("LOG_LEVEL", "INFO"))
logger = logging.getLogger("fraudshield.api")

MAX_REQUEST_BYTES = 16_384
origins = [
    origin.strip()
    for origin in os.getenv(
        "FRAUDSHIELD_CORS_ORIGINS",
        "http://localhost:5173,http://127.0.0.1:5173",
    ).split(",")
    if origin.strip()
]

app = FastAPI(
    title="FraudShield local analysis API",
    description="Evidence-based, deterministic scam-indicator checks. No external AI or URL fetching.",
    version="0.1.0",
)
app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=False,
    allow_methods=["GET", "POST"],
    allow_headers=["Content-Type"],
)


@app.middleware("http")
async def limit_request_size(request: Request, call_next):
    content_length = request.headers.get("content-length")
    if content_length:
        try:
            size = int(content_length)
        except ValueError:
            return JSONResponse(status_code=400, content={"detail": "Invalid content length"})
        if size > MAX_REQUEST_BYTES:
            return JSONResponse(status_code=413, content={"detail": "Request is too large"})
    return await call_next(request)


@app.exception_handler(RequestValidationError)
async def validation_error_handler(
    request: Request, exc: RequestValidationError
) -> JSONResponse:
    errors = [
        {
            "location": [str(part) for part in error.get("loc", ())],
            "message": error.get("msg", "Invalid request"),
            "type": error.get("type", "validation_error"),
        }
        for error in exc.errors()
    ]
    return JSONResponse(status_code=422, content={"detail": errors})


@app.get("/api/health")
async def health_check() -> dict[str, str]:
    return {"status": "ok", "analysis": "local-rules"}


@app.post("/api/analyze", response_model=AnalysisResponse)
async def analyze(request: AnalysisRequest) -> AnalysisResponse:
    logger.info("Analysis requested (type=%s, characters=%d)", request.scan_type, len(request.content))
    return analyze_content(request.content, request.scan_type, request.language)
