"""Shared evaluation, threshold-tuning, and plotting utilities.

Used identically by train_sms.py, train_url.py, and train_transaction.py so
that every model is scored the same way and figures look consistent.
"""

from __future__ import annotations

from pathlib import Path
from typing import Any

import matplotlib

matplotlib.use("Agg")
import matplotlib.pyplot as plt
import numpy as np
from sklearn.metrics import (
    ConfusionMatrixDisplay,
    PrecisionRecallDisplay,
    RocCurveDisplay,
    accuracy_score,
    average_precision_score,
    confusion_matrix,
    f1_score,
    precision_recall_curve,
    precision_score,
    recall_score,
    roc_auc_score,
)

FIGURES_DIR = Path(__file__).resolve().parents[2] / "docs" / "ml" / "figures"
FIGURES_DIR.mkdir(parents=True, exist_ok=True)


def compute_metrics(y_true, y_pred, y_proba=None) -> dict[str, Any]:
    """Standard classification metrics. y_proba is the positive-class probability."""
    metrics: dict[str, Any] = {
        "accuracy": float(accuracy_score(y_true, y_pred)),
        "precision": float(precision_score(y_true, y_pred, zero_division=0)),
        "recall": float(recall_score(y_true, y_pred, zero_division=0)),
        "f1": float(f1_score(y_true, y_pred, zero_division=0)),
    }
    if y_proba is not None and len(np.unique(y_true)) > 1:
        metrics["roc_auc"] = float(roc_auc_score(y_true, y_proba))
        metrics["pr_auc"] = float(average_precision_score(y_true, y_proba))
    else:
        metrics["roc_auc"] = None
        metrics["pr_auc"] = None
    cm = confusion_matrix(y_true, y_pred)
    metrics["confusion_matrix"] = cm.tolist()
    return metrics


def tune_threshold(y_true, y_proba, objective: str = "f1") -> dict[str, Any]:
    """Scan thresholds on a VALIDATION set (never the test set) and pick the
    one that maximizes the given objective. Returns threshold + metrics there.
    """
    thresholds = np.linspace(0.01, 0.99, 99)
    best = {"threshold": 0.5, "score": -1.0}
    results = []
    for t in thresholds:
        y_pred = (y_proba >= t).astype(int)
        p = precision_score(y_true, y_pred, zero_division=0)
        r = recall_score(y_true, y_pred, zero_division=0)
        f1 = f1_score(y_true, y_pred, zero_division=0)
        score = {"f1": f1, "precision": p, "recall": r}[objective]
        results.append({"threshold": float(t), "precision": p, "recall": r, "f1": f1})
        if score > best["score"]:
            best = {"threshold": float(t), "score": float(score), "precision": p, "recall": r, "f1": f1}
    return {"default_threshold": 0.5, "selected": best, "objective": objective}


def plot_confusion_matrix(y_true, y_pred, labels: list[str], title: str, filename: str):
    fig, ax = plt.subplots(figsize=(5, 4.5))
    cm = confusion_matrix(y_true, y_pred)
    disp = ConfusionMatrixDisplay(confusion_matrix=cm, display_labels=labels)
    disp.plot(ax=ax, cmap="Blues", colorbar=False, values_format="d")
    ax.set_title(title)
    fig.tight_layout()
    fig.savefig(FIGURES_DIR / filename, dpi=150)
    plt.close(fig)


def plot_roc_curve(y_true, y_proba, title: str, filename: str):
    if len(np.unique(y_true)) < 2:
        return
    fig, ax = plt.subplots(figsize=(5, 4.5))
    RocCurveDisplay.from_predictions(y_true, y_proba, ax=ax)
    ax.plot([0, 1], [0, 1], linestyle="--", color="gray", linewidth=1, label="Chance")
    ax.set_title(title)
    ax.legend(loc="lower right", fontsize=8)
    fig.tight_layout()
    fig.savefig(FIGURES_DIR / filename, dpi=150)
    plt.close(fig)


def plot_pr_curve(y_true, y_proba, title: str, filename: str):
    if len(np.unique(y_true)) < 2:
        return
    fig, ax = plt.subplots(figsize=(5, 4.5))
    PrecisionRecallDisplay.from_predictions(y_true, y_proba, ax=ax)
    baseline = float(np.mean(y_true))
    ax.axhline(baseline, linestyle="--", color="gray", linewidth=1, label=f"Baseline ({baseline:.3f})")
    ax.set_title(title)
    ax.legend(loc="upper right", fontsize=8)
    fig.tight_layout()
    fig.savefig(FIGURES_DIR / filename, dpi=150)
    plt.close(fig)


def plot_class_distribution(counts: dict[str, int], title: str, filename: str, xlabel: str = "Class"):
    fig, ax = plt.subplots(figsize=(5, 4))
    labels = list(counts.keys())
    values = list(counts.values())
    bars = ax.bar(labels, values, color=["#3b82f6", "#ef4444"][: len(labels)])
    for bar, v in zip(bars, values):
        ax.text(bar.get_x() + bar.get_width() / 2, bar.get_height(), f"{v:,}", ha="center", va="bottom", fontsize=9)
    ax.set_title(title)
    ax.set_xlabel(xlabel)
    ax.set_ylabel("Count")
    fig.tight_layout()
    fig.savefig(FIGURES_DIR / filename, dpi=150)
    plt.close(fig)


def plot_model_comparison(results: dict[str, dict[str, float]], metric: str, title: str, filename: str):
    fig, ax = plt.subplots(figsize=(6, 4.5))
    names = list(results.keys())
    values = [results[n][metric] for n in names]
    bars = ax.barh(names, values, color="#6366f1")
    for bar, v in zip(bars, values):
        ax.text(bar.get_width(), bar.get_y() + bar.get_height() / 2, f" {v:.3f}", va="center", fontsize=9)
    ax.set_xlabel(metric)
    ax.set_xlim(0, 1.05)
    ax.set_title(title)
    fig.tight_layout()
    fig.savefig(FIGURES_DIR / filename, dpi=150)
    plt.close(fig)


def top_feature_importances(names: list[str], importances: list[float], top_n: int = 10) -> list[dict]:
    """Real (name, importance) pairs, sorted descending — for embedding in
    model_metadata.json so the UI never has to fabricate these numbers."""
    order = np.argsort(importances)[::-1][:top_n]
    return [{"feature": str(names[i]), "importance": float(importances[i])} for i in order]


def plot_feature_importance(names: list[str], importances: list[float], title: str, filename: str, top_n: int = 15):
    order = np.argsort(importances)[::-1][:top_n]
    names_sorted = [names[i] for i in order][::-1]
    values_sorted = [importances[i] for i in order][::-1]
    fig, ax = plt.subplots(figsize=(7, 5.5))
    ax.barh(names_sorted, values_sorted, color="#10b981")
    ax.set_xlabel("Importance")
    ax.set_title(title)
    fig.tight_layout()
    fig.savefig(FIGURES_DIR / filename, dpi=150)
    plt.close(fig)
