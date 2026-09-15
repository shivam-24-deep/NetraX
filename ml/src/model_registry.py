"""Saves trained pipelines and maintains ml/models/model_metadata.json."""

from __future__ import annotations

import json
import platform
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

import joblib
import numpy
import pandas
import scipy
import sklearn

MODELS_DIR = Path(__file__).resolve().parents[1] / "models"
METADATA_PATH = MODELS_DIR / "model_metadata.json"

RANDOM_SEED = 42


def save_pipeline(pipeline, filename: str) -> Path:
    MODELS_DIR.mkdir(parents=True, exist_ok=True)
    path = MODELS_DIR / filename
    joblib.dump(pipeline, path)
    return path


def load_pipeline(filename: str):
    path = MODELS_DIR / filename
    if not path.exists():
        raise FileNotFoundError(f"Model artifact not found: {path}. Run ml/train.py first.")
    return joblib.load(path)


def library_versions() -> dict[str, str]:
    return {
        "python": platform.python_version(),
        "numpy": numpy.__version__,
        "pandas": pandas.__version__,
        "scipy": scipy.__version__,
        "scikit_learn": sklearn.__version__,
        "joblib": joblib.__version__,
    }


def record_model_metadata(entry: dict[str, Any]) -> None:
    """Merge one model's metadata entry into model_metadata.json, keyed by model_name."""
    MODELS_DIR.mkdir(parents=True, exist_ok=True)
    existing: dict[str, Any] = {}
    if METADATA_PATH.exists():
        existing = json.loads(METADATA_PATH.read_text(encoding="utf-8"))

    entry = dict(entry)
    entry.setdefault("training_date", datetime.now(timezone.utc).isoformat())
    entry.setdefault("random_seed", RANDOM_SEED)
    entry.setdefault("library_versions", library_versions())

    existing[entry["model_name"]] = entry
    METADATA_PATH.write_text(json.dumps(existing, indent=2), encoding="utf-8")


def load_metadata() -> dict[str, Any]:
    if not METADATA_PATH.exists():
        return {}
    return json.loads(METADATA_PATH.read_text(encoding="utf-8"))
