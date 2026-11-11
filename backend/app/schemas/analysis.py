from typing import Literal

from pydantic import BaseModel, ConfigDict, Field

ScanType = Literal["message", "url", "job", "payment"]
ScanLanguage = Literal["en", "hi", "ta"]
RiskLevel = Literal[
    "High risk",
    "Caution",
    "No obvious indicators",
    "Inconclusive",
]


class AnalysisRequest(BaseModel):
    model_config = ConfigDict(extra="forbid", str_strip_whitespace=True)

    content: str = Field(min_length=1, max_length=5000)
    scan_type: ScanType
    language: ScanLanguage = "en"


class AnalysisResponse(BaseModel):
    level: RiskLevel
    summary: str
    indicators: list[str]
    next_steps: list[str]
