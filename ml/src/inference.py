"""Clean inference layer over the three trained pipelines.

IMPORTANT, HONEST LIMITATIONS (do not paper over these — see
docs/ml/TRAINING_REPORT.md "Limitations" for the full explanation):

- SMS: takes raw free text directly. Fully faithful — no gap between what
  was trained on and what a real user can submit.

- URL: the trained model expects 30 engineered features (SSL certificate
  state, domain age, DNS record existence, web-traffic rank, Google index
  status, PageRank, etc.) — most of which require live WHOIS/DNS/third-party
  ranking lookups that are not available in this offline pipeline (and some,
  like Alexa rank and Google PageRank, are services that no longer exist in
  a freely queryable form). `predict_url()` extracts only the subset of
  features that are computable from the URL string itself (IP-address host,
  length, shorteners, "@" symbol, "//" position, prefix/suffix dashes,
  subdomain count — matching ml/data/Phishing Websites Features.docx's
  lexical rules) and imputes the remaining features with each feature's
  training-set mode. This is real model inference, but on a partial feature
  vector — confidence is intentionally reported as lower than the test-set
  metrics for exactly that reason.

- Transaction: the model's V1-V28 features are PCA components of a private,
  never-published original feature set — they cannot be derived from a
  human-readable transaction description (amount/merchant/location/time/
  device). This model can only be run on data already in the dataset's
  native format. `predict_transaction()` therefore accepts a feature dict in
  that native format (Time, V1..V28, Amount) — it is NOT a function of the
  free-text transaction fields the Investigate UI collects. Those UI fields
  continue to go through the existing rule-based Behavioral Analyzer.
"""

from __future__ import annotations

import re
from functools import lru_cache
from typing import Any

import numpy as np
import pandas as pd

from . import model_registry

RISK_THRESHOLDS = {"HIGH": 0.7, "MEDIUM": 0.35}


def risk_level(probability: float) -> str:
    if probability >= RISK_THRESHOLDS["HIGH"]:
        return "HIGH"
    if probability >= RISK_THRESHOLDS["MEDIUM"]:
        return "MEDIUM"
    return "LOW"


@lru_cache(maxsize=1)
def _sms_pipeline():
    return model_registry.load_pipeline("sms_pipeline.joblib")


@lru_cache(maxsize=1)
def _email_pipeline():
    return model_registry.load_pipeline("email_pipeline.joblib")


@lru_cache(maxsize=1)
def _url_pipeline():
    return model_registry.load_pipeline("url_pipeline.joblib")


@lru_cache(maxsize=1)
def _transaction_pipeline():
    return model_registry.load_pipeline("transaction_pipeline.joblib")


def _validate_probability(p: float) -> float:
    if p is None or np.isnan(p) or np.isinf(p):
        raise ValueError(f"Model produced an invalid probability: {p!r}")
    if not (0.0 <= p <= 1.0):
        raise ValueError(f"Probability out of [0,1] range: {p!r}")
    return float(p)


def predict_sms(text: str) -> dict[str, Any]:
    if not isinstance(text, str) or not text.strip():
        raise ValueError("predict_sms requires a non-empty string")

    pipeline = _sms_pipeline()
    proba = _validate_probability(float(pipeline.predict_proba([text])[0, 1]))
    meta = model_registry.load_metadata().get("sms_fraud_classifier", {})

    return {
        "type": "sms",
        "fraud_probability": proba,
        "risk_level": risk_level(proba),
        "model": meta.get("algorithm", "unknown"),
        "model_version": "v1",
        "confidence": "full — model trained and evaluated directly on raw message text",
    }


def predict_email(text: str) -> dict[str, Any]:
    """Scores email BODY content/language via the SpamAssassin-trained model.
    This is a content signal only — it does not evaluate headers, URLs, or
    sender identity, which the deterministic forensics/URL-analysis engines
    (Phase 4/5, in the TypeScript layer) handle separately. See Rule 7."""
    if not isinstance(text, str) or not text.strip():
        raise ValueError("predict_email requires a non-empty string")

    pipeline = _email_pipeline()
    proba = _validate_probability(float(pipeline.predict_proba([text])[0, 1]))
    meta = model_registry.load_metadata().get("email_content_classifier", {})

    return {
        "type": "email",
        "fraud_probability": proba,
        "risk_level": risk_level(proba),
        "model": meta.get("algorithm", "unknown"),
        "model_version": "v1",
        "confidence": "full — model trained and evaluated directly on extracted email body text",
    }


# --- URL lexical feature extraction (the subset computable without network calls) ---

_SHORTENERS = {
    "bit.ly", "tinyurl.com", "t.co", "cutt.ly", "ow.ly", "is.gd", "shorturl.at",
    "goo.gl", "buff.ly", "adf.ly",
}


def _extract_url_lexical_features(url: str) -> dict[str, int]:
    features: dict[str, int] = {}

    try:
        from urllib.parse import urlparse

        parsed = urlparse(url if "://" in url else f"http://{url}")
        host = parsed.hostname or ""
    except Exception:
        host = ""

    is_ip = bool(re.match(r"^\d{1,3}(\.\d{1,3}){3}$", host))
    features["having_IP_Address"] = -1 if is_ip else 1

    length = len(url)
    features["URL_Length"] = 1 if length < 54 else (0 if length <= 75 else -1)

    features["Shortining_Service"] = -1 if any(s in host for s in _SHORTENERS) else 1

    features["having_At_Symbol"] = -1 if "@" in url else 1

    after_protocol = url.split("://", 1)[-1]
    features["double_slash_redirecting"] = -1 if "//" in after_protocol else 1

    features["Prefix_Suffix"] = -1 if "-" in host else 1

    dot_count = host.count(".")
    features["having_Sub_Domain"] = 1 if dot_count <= 1 else (0 if dot_count == 2 else -1)

    return features


def predict_url(url: str) -> dict[str, Any]:
    if not isinstance(url, str) or not url.strip():
        raise ValueError("predict_url requires a non-empty string")

    pipeline = _url_pipeline()
    meta = model_registry.load_metadata().get("url_phishing_classifier", {})
    feature_cols: list[str] = meta.get("features", [])
    if not feature_cols:
        raise RuntimeError("URL model metadata missing 'features' list — retrain first")

    lexical = _extract_url_lexical_features(url)
    imputation_defaults: dict[str, float] = meta.get("imputation_defaults", {})

    row = {}
    used_lexical = []
    for col in feature_cols:
        if col in lexical:
            row[col] = lexical[col]
            used_lexical.append(col)
        else:
            row[col] = imputation_defaults.get(col, 0)
    X = pd.DataFrame([row], columns=feature_cols)

    proba = _validate_probability(float(pipeline.predict_proba(X)[0, 1]))
    coverage = len(used_lexical) / len(feature_cols)

    return {
        "type": "url",
        "fraud_probability": proba,
        "risk_level": risk_level(proba),
        "model": meta.get("algorithm", "unknown"),
        "model_version": "v1",
        "confidence": (
            f"partial — {len(used_lexical)}/{len(feature_cols)} features computed from the URL string, "
            "the rest (SSL/domain-age/DNS/web-traffic/PageRank/Google-index) require external threat "
            "intelligence not available in this demo and are imputed from training-set typical values"
        ),
        "features_used_from_url": used_lexical,
        "feature_coverage": coverage,
    }


def predict_transaction(feature_row: dict[str, float]) -> dict[str, Any]:
    """feature_row must contain the dataset's native Time, V1..V28, Amount
    keys — see module docstring for why this can't come from free-text UI
    fields (amount/merchant/location/time/device)."""
    pipeline = _transaction_pipeline()
    meta = model_registry.load_metadata().get("transaction_fraud_detector", {})
    feature_cols: list[str] = meta.get("features", [])
    if not feature_cols:
        raise RuntimeError("Transaction model metadata missing 'features' list — retrain first")

    missing = [c for c in feature_cols if c not in feature_row]
    if missing:
        raise ValueError(f"predict_transaction is missing required native features: {missing}")

    X = pd.DataFrame([{c: feature_row[c] for c in feature_cols}], columns=feature_cols)
    proba = _validate_probability(float(pipeline.predict_proba(X)[0, 1]))

    return {
        "type": "transaction",
        "fraud_probability": proba,
        "risk_level": risk_level(proba),
        "model": meta.get("algorithm", "unknown"),
        "model_version": "v1",
        "confidence": "full — native V1-V28/Time/Amount feature vector, same format as training data",
    }
