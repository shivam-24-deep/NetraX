"""Trains and selects the phishing URL classifier.

Selection criterion (per spec): mean cross-validated F1 as the primary
signal, with ROC-AUC reported and used as a tie-breaker — URL detection
needs both a balanced precision/recall (F1) and good ranking quality
(ROC-AUC) since the risk-fusion layer uses the raw probability, not just
the thresholded class.

Uses the primary 11,055-row Training Dataset.arff (see DATASET_REPORT.md for
why .old.arff, the 2,456-row earlier version, is not used). 5,206 of the
11,055 rows (47%) are exact duplicates — these are dropped BEFORE the
train/test split to avoid identical rows leaking across the split.
"""

from __future__ import annotations

import numpy as np
from sklearn.base import clone
from sklearn.ensemble import HistGradientBoostingClassifier, RandomForestClassifier
from sklearn.linear_model import LogisticRegression
from sklearn.model_selection import StratifiedKFold, cross_val_predict, cross_validate, train_test_split
from sklearn.pipeline import Pipeline
from sklearn.preprocessing import StandardScaler
from xgboost import XGBClassifier

from . import data_loader, evaluation, model_registry

RANDOM_SEED = 42


def _build_candidates() -> dict[str, Pipeline]:
    return {
        "LogisticRegression": Pipeline([
            ("scaler", StandardScaler()),
            ("clf", LogisticRegression(max_iter=1000, class_weight="balanced", random_state=RANDOM_SEED)),
        ]),
        "RandomForest": Pipeline([
            ("clf", RandomForestClassifier(n_estimators=300, class_weight="balanced", random_state=RANDOM_SEED, n_jobs=-1)),
        ]),
        "HistGradientBoosting": Pipeline([
            ("clf", HistGradientBoostingClassifier(random_state=RANDOM_SEED)),
        ]),
        "XGBoost": Pipeline([
            ("clf", XGBClassifier(
                n_estimators=300, max_depth=6, learning_rate=0.1,
                eval_metric="logloss", random_state=RANDOM_SEED, n_jobs=-1,
            )),
        ]),
    }


def run() -> dict:
    df = data_loader.load_url(use_legacy=False)
    raw_rows = len(df)

    before_dedup = len(df)
    df = df.drop_duplicates().reset_index(drop=True)
    duplicates_removed = before_dedup - len(df)

    df["target"] = (df["Result"] == -1).astype(int)  # 1 = phishing, 0 = legitimate
    feature_cols = [c for c in df.columns if c not in ("Result", "target")]

    X = df[feature_cols]
    y = df["target"]

    X_train, X_test, y_train, y_test = train_test_split(
        X, y, test_size=0.2, random_state=RANDOM_SEED, stratify=y
    )

    candidates = _build_candidates()
    cv = StratifiedKFold(n_splits=5, shuffle=True, random_state=RANDOM_SEED)

    comparison: dict[str, dict] = {}
    for name, pipeline in candidates.items():
        scores = cross_validate(
            pipeline, X_train, y_train, cv=cv,
            scoring=["accuracy", "precision", "recall", "f1", "roc_auc"],
            n_jobs=-1,
        )
        comparison[name] = {
            "accuracy": float(np.mean(scores["test_accuracy"])),
            "precision": float(np.mean(scores["test_precision"])),
            "recall": float(np.mean(scores["test_recall"])),
            "f1": float(np.mean(scores["test_f1"])),
            "roc_auc": float(np.mean(scores["test_roc_auc"])),
        }

    best_name = max(comparison, key=lambda n: (comparison[n]["f1"], comparison[n]["roc_auc"]))
    best_pipeline = clone(candidates[best_name])

    oof_proba = cross_val_predict(clone(candidates[best_name]), X_train, y_train, cv=cv, method="predict_proba", n_jobs=-1)[:, 1]
    threshold_info = evaluation.tune_threshold(y_train.to_numpy(), oof_proba, objective="f1")
    selected_threshold = threshold_info["selected"]["threshold"]

    best_pipeline.fit(X_train, y_train)

    test_proba = best_pipeline.predict_proba(X_test)[:, 1]
    test_pred_default = (test_proba >= 0.5).astype(int)
    test_pred_tuned = (test_proba >= selected_threshold).astype(int)

    metrics_default = evaluation.compute_metrics(y_test, test_pred_default, test_proba)
    metrics_tuned = evaluation.compute_metrics(y_test, test_pred_tuned, test_proba)

    evaluation.plot_class_distribution(
        {"legitimate": int((df["target"] == 0).sum()), "phishing": int((df["target"] == 1).sum())},
        "Phishing URL Dataset — Class Distribution", "url_class_distribution.png", xlabel="Label",
    )
    evaluation.plot_confusion_matrix(y_test, test_pred_tuned, ["legitimate", "phishing"], "URL Model — Confusion Matrix (Test Set)", "url_confusion_matrix.png")
    evaluation.plot_roc_curve(y_test, test_proba, "URL Model — ROC Curve (Test Set)", "url_roc_curve.png")
    evaluation.plot_pr_curve(y_test, test_proba, "URL Model — Precision-Recall Curve (Test Set)", "url_pr_curve.png")
    evaluation.plot_model_comparison(comparison, "f1", "URL Candidate Models — Mean CV F1", "url_model_comparison.png")

    try:
        clf = best_pipeline.named_steps["clf"]
        if hasattr(clf, "feature_importances_"):
            importances = clf.feature_importances_
        elif hasattr(clf, "coef_"):
            importances = np.abs(clf.coef_[0])
        else:
            # HistGradientBoostingClassifier exposes neither — fall back to
            # model-agnostic permutation importance on the test set.
            from sklearn.inspection import permutation_importance

            perm = permutation_importance(best_pipeline, X_test, y_test, n_repeats=10, random_state=RANDOM_SEED, n_jobs=-1)
            importances = perm.importances_mean
        evaluation.plot_feature_importance(feature_cols, list(importances), "URL Model — Feature Importance", "url_feature_importance.png")
        top_features = evaluation.top_feature_importances(feature_cols, list(importances))
    except Exception:
        top_features = None

    artifact_path = model_registry.save_pipeline(best_pipeline, "url_pipeline.joblib")

    metadata = {
        "model_name": "url_phishing_classifier",
        "dataset": "UCI Phishing Websites Data Set",
        "dataset_file": "ml/data/Training Dataset.arff",
        "raw_rows": raw_rows,
        "duplicates_removed": duplicates_removed,
        "rows_used": len(df),
        "train_rows": len(X_train),
        "test_rows": len(X_test),
        "target": "Result (legitimate=0, phishing=1)",
        "features": feature_cols,
        "imputation_defaults": {c: float(X_train[c].mode().iloc[0]) for c in feature_cols},
        "algorithm": best_name,
        "selection_criterion": "highest mean 5-fold CV F1 on training set, tie-break on ROC-AUC",
        "candidates_compared": comparison,
        "default_threshold": 0.5,
        "selected_threshold": selected_threshold,
        "metrics_at_default_threshold": metrics_default,
        "metrics_at_selected_threshold": metrics_tuned,
        "feature_importance": top_features,
        "artifact_path": str(artifact_path.relative_to(artifact_path.parents[2])),
        "notes": "ml/data/.old.arff (2,456-row earlier dataset version) exists but was not used — see DATASET_REPORT.md.",
    }
    model_registry.record_model_metadata(metadata)

    return metadata


if __name__ == "__main__":
    result = run()
    print(f"Best URL model: {result['algorithm']}")
    print(f"Test F1 (tuned threshold): {result['metrics_at_selected_threshold']['f1']:.4f}")
