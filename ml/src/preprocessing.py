"""Shared preprocessing helpers used by all three training scripts.

Dataset-specific preprocessing (TF-IDF for SMS, categorical passthrough for
URL, scaling for transaction) lives inline in each train_*.py, since the
three problems genuinely need different representations (per the
architecture decision: three specialized models, not one shared model).
This module only holds the logic that is identical across all three.
"""

from __future__ import annotations

import pandas as pd


def drop_exact_duplicates(df: pd.DataFrame, subset: list[str] | None = None) -> tuple[pd.DataFrame, int]:
    """Drops exact duplicate rows. Must be called BEFORE the train/test split
    to prevent identical rows from leaking across the split boundary.

    Returns (deduplicated_df, rows_removed).
    """
    before = len(df)
    deduped = df.drop_duplicates(subset=subset).reset_index(drop=True)
    removed = before - len(deduped)
    return deduped, removed
