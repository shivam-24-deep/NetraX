"""Local inference API over the three trained models.

Run from ml/ with the venv active:
    ml/.venv/Scripts/python.exe -m uvicorn api.server:app --port 8000

This is deliberately a thin layer: it returns RAW model evidence
(fraud_probability, risk_level, indicators) and lets the existing
TypeScript agent (frontend/src/lib/mock/engine.ts) do evidence fusion and
explanation generation exactly as it already does for rule-based tools —
this endpoint adds one more evidence source, it does not replace the
agent's existing architecture or the frontend's response-shape contract.

If this server is not running, the frontend falls back to its existing
rule-based-only evidence — see frontend/src/lib/mock/ml-client.ts.
"""

from __future__ import annotations

import hmac
import os
import sys
from pathlib import Path
from typing import Literal

from fastapi import Depends, FastAPI, Header, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from src import inference, model_registry  # noqa: E402

app = FastAPI(title="NetraX ML Inference API", version="1.0")

# CORS: by default the Vite dev server (and its ngrok tunnel host pattern).
# Deployed, set CORS_ORIGINS to a comma-separated list — though in production
# only the Node API calls this service, server-to-server, so browsers normally
# never need CORS access here.
_cors_env = os.environ.get("CORS_ORIGINS", "").strip()
app.add_middleware(
    CORSMiddleware,
    allow_origins=[o.strip() for o in _cors_env.split(",") if o.strip()]
    or ["http://localhost:5173", "http://127.0.0.1:5173"],
    allow_origin_regex=None if _cors_env else r"https://.*\.ngrok-free\.app",
    allow_methods=["GET", "POST"],
    allow_headers=["*"],
)


def require_api_key(x_api_key: str | None = Header(default=None)) -> None:
    """If ML_API_KEY is set (deployed), /analyze and /models need a matching X-API-Key.

    Unset = open, as for local development. /health is always public so the
    host's health check works.
    """
    expected = os.environ.get("ML_API_KEY", "")
    if not expected:
        return
    if not x_api_key or not hmac.compare_digest(x_api_key, expected):
        raise HTTPException(status_code=401, detail="Invalid or missing API key")


class AnalyzeRequest(BaseModel):
    type: Literal["sms", "url", "email", "transaction"]
    content: str | None = None
    transaction_features: dict[str, float] | None = None


class Indicator(BaseModel):
    label: str
    severity: Literal["LOW", "MEDIUM", "HIGH"]


class AnalyzeResponse(BaseModel):
    type: str
    fraud_probability: float
    risk_level: Literal["LOW", "MEDIUM", "HIGH"]
    model: str
    model_version: str
    indicators: list[Indicator]
    confidence: str


def _severity_from_probability(p: float) -> str:
    return inference.risk_level(p)


@app.get("/health")
def health() -> dict:
    return {"status": "ok"}


@app.get("/models", dependencies=[Depends(require_api_key)])
def models() -> dict:
    """Real, measured model metadata — used by the Model Performance page."""
    return model_registry.load_metadata()


@app.post("/analyze", response_model=AnalyzeResponse, dependencies=[Depends(require_api_key)])
def analyze(req: AnalyzeRequest) -> AnalyzeResponse:
    try:
        if req.type == "sms":
            if not req.content or not req.content.strip():
                raise HTTPException(status_code=400, detail="content is required for type=sms")
            result = inference.predict_sms(req.content)
            indicators = [Indicator(
                label=f"SMS model flags {result['fraud_probability']*100:.0f}% fraud probability",
                severity=_severity_from_probability(result["fraud_probability"]),
            )]
            return AnalyzeResponse(type=req.type, indicators=indicators, **{k: v for k, v in result.items() if k != "type"})

        if req.type == "email":
            if not req.content or not req.content.strip():
                raise HTTPException(status_code=400, detail="content is required for type=email")
            result = inference.predict_email(req.content)
            indicators = [Indicator(
                label=f"Email content model flags {result['fraud_probability']*100:.0f}% spam/phishing probability",
                severity=_severity_from_probability(result["fraud_probability"]),
            )]
            return AnalyzeResponse(type=req.type, indicators=indicators, **{k: v for k, v in result.items() if k != "type"})

        if req.type == "url":
            if not req.content or not req.content.strip():
                raise HTTPException(status_code=400, detail="content is required for type=url")
            result = inference.predict_url(req.content)
            coverage_pct = result["feature_coverage"] * 100
            indicators = [Indicator(
                label=(
                    f"URL model flags {result['fraud_probability']*100:.0f}% phishing probability "
                    f"(partial evidence — {coverage_pct:.0f}% of model features computed from the URL itself)"
                ),
                severity=_severity_from_probability(result["fraud_probability"]),
            )]
            payload = {k: v for k, v in result.items() if k not in ("type", "features_used_from_url", "feature_coverage")}
            return AnalyzeResponse(type=req.type, indicators=indicators, **payload)

        if req.type == "transaction":
            if not req.transaction_features:
                raise HTTPException(
                    status_code=400,
                    detail=(
                        "type=transaction requires transaction_features in the dataset's native format "
                        "(Time, V1..V28, Amount) — free-text amount/merchant/location/time/device fields "
                        "cannot be converted to this model's PCA-derived features. See "
                        "docs/ml/TRAINING_REPORT.md Limitations."
                    ),
                )
            result = inference.predict_transaction(req.transaction_features)
            indicators = [Indicator(
                label=f"Transaction model flags {result['fraud_probability']*100:.0f}% fraud probability",
                severity=_severity_from_probability(result["fraud_probability"]),
            )]
            return AnalyzeResponse(type=req.type, indicators=indicators, **{k: v for k, v in result.items() if k != "type"})

        raise HTTPException(status_code=400, detail=f"Unsupported type: {req.type}")

    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except FileNotFoundError as e:
        raise HTTPException(status_code=503, detail=f"Model not available: {e}")
