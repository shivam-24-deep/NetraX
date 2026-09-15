"""Trains and selects the transaction fraud detector.

The dataset is extremely imbalanced (492 fraud / 284,807 rows = 0.17%), so
accuracy is not used for model selection at all (see spec: a model that
always predicts "legitimate" scores 99.83% accuracy while catching zero
fraud). Selection criterion: PR-AUC (average precision) as the primary
signal — the right metric for rare-positive-class ranking quality — with
recall and F1 reported alongside since a missed fraud is costlier than a
false alarm for this use case.

Class imbalance is handled via class_weight="balanced" (Logistic Regression,
Random Forest) rather than SMOTE, to avoid adding a new dependency
(imbalanced-learn) for what class-weighting already addresses reasonably
well; HistGradientBoostingClassifier and IsolationForest are evaluated
without explicit reweighting since PR-AUC/ROC-AUC only depend on score
*ranking*, not the (unweighted) default 0.5 threshold.
"""

from __future__ import annotations

import numpy as np
from sklearn.base import clone
from sklearn.ensemble import HistGradientBoostingClassifier, IsolationForest, RandomForestClassifier
from sklearn.linear_model import LogisticRegression
from sklearn.metrics import average_precision_score, roc_auc_score
from sklearn.model_selection import StratifiedKFold, cross_val_predict, cross_validate, train_test_split
from sklearn.pipeline import Pipeline
from sklearn.preprocessing import StandardScaler

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
    }


def _isolation_forest_baseline(X_train, y_train, X_test, y_test) -> dict:
    """Unsupervised anomaly-detection comparison — not eligible for selection
    as the production model, purely a documented baseline (per spec)."""
    contamination = max(float(y_train.mean()), 1e-4)
    model = IsolationForest(
        n_estimators=300, contamination=contamination, random_state=RANDOM_SEED, n_jobs=-1
    )
    model.fit(X_train)  # unsupervised — y is not used
    anomaly_score = -model.score_samples(X_test)  # higher = more anomalous
    pred = (model.predict(X_test) == -1).astype(int)  # -1 = anomaly in IsolationForest's convention
    return {
        "roc_auc": float(roc_auc_score(y_test, anomaly_score)),
        "pr_auc": float(average_precision_score(y_test, anomaly_score)),
        "precision_at_default_contamination": float((pred & (y_test.to_numpy() == 1)).sum() / max(pred.sum(), 1)),
        "recall_at_default_contamination": float((pred & (y_test.to_numpy() == 1)).sum() / max(y_test.sum(), 1)),
        "contamination_used": contamination,
    }


def run() -> dict:
    df = data_loader.load_transaction()
    raw_rows = len(df)

    before_dedup = len(df)
    df = df.drop_duplicates().reset_index(drop=True)
    duplicates_removed = before_dedup - len(df)

    feature_cols = [c for c in df.columns if c != "Class"]
    X = df[feature_cols]
    y = df["Class"]

    X_train, X_test, y_train, y_test = train_test_split(
        X, y, test_size=0.2, random_state=RANDOM_SEED, stratify=y
    )

    candidates = _build_candidates()
    cv = StratifiedKFold(n_splits=5, shuffle=True, random_state=RANDOM_SEED)

    comparison: dict[str, dict] = {}
    for name, pipeline in candidates.items():
        scores = cross_validate(
            pipeline, X_train, y_train, cv=cv,
            scoring=["accuracy", "precision", "recall", "f1", "roc_auc", "average_precision"],
            n_jobs=-1,
        )
        comparison[name] = {
            "accuracy": float(np.mean(scores["test_accuracy"])),
            "precision": float(np.mean(scores["test_precision"])),
            "recall": float(np.mean(scores["test_recall"])),
            "f1": float(np.mean(scores["test_f1"])),
            "roc_auc": float(np.mean(scores["test_roc_auc"])),
            "pr_auc": float(np.mean(scores["test_average_precision"])),
        }

    isolation_forest_baseline = _isolation_forest_baseline(X_train, y_train, X_test, y_test)

    best_name = max(comparison, key=lambda n: (comparison[n]["pr_auc"], comparison[n]["f1"]))
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
        {"legitimate": int((y == 0).sum()), "fraud": int((y == 1).sum())},
        "Transaction Dataset — Class Distribution (log scale)", "transaction_class_distribution.png", xlabel="Class",
    )
    evaluation.plot_confusion_matrix(y_test, test_pred_tuned, ["legitimate", "fraud"], "Transaction Model — Confusion Matrix (Test Set)", "transaction_confusion_matrix.png")
    evaluation.plot_roc_curve(y_test, test_proba, "Transaction Model — ROC Curve (Test Set)", "transaction_roc_curve.png")
    evaluation.plot_pr_curve(y_test, test_proba, "Transaction Model — Precision-Recall Curve (Test Set)", "transaction_pr_curve.png")
    evaluation.plot_model_comparison(comparison, "pr_auc", "Transaction Candidate Models — Mean CV PR-AUC", "transaction_model_comparison.png")

    try:
        clf = best_pipeline.named_steps["clf"]
        if hasattr(clf, "feature_importances_"):
            importances = clf.feature_importances_
        elif hasattr(clf, "coef_"):
            importances = np.abs(clf.coef_[0])
        else:
            importances = None
        if importances is not None:
            evaluation.plot_feature_importance(feature_cols, list(importances), "Transaction Model — Feature Importance", "transaction_feature_importance.png")
            top_features = evaluation.top_feature_importances(feature_cols, list(importances))
        else:
            top_features = None
    except Exception:
        top_features = None

    artifact_path = model_registry.save_pipeline(best_pipeline, "transaction_pipeline.joblib")

    metadata = {
        "model_name": "transaction_fraud_detector",
        "dataset": "Credit Card Fraud Detection (Kaggle / ULB)",
        "dataset_file": "ml/data/creditcard.csv",
        "raw_rows": raw_rows,
        "duplicates_removed": duplicates_removed,
        "rows_used": len(df),
        "train_rows": len(X_train),
        "test_rows": len(X_test),
        "target": "Class (legitimate=0, fraud=1)",
        "features": feature_cols,
        "class_imbalance": {"fraud_rate_pct": float(y.mean() * 100), "fraud_count": int(y.sum()), "legitimate_count": int((y == 0).sum())},
        "imbalance_handling": "class_weight='balanced' (LogisticRegression, RandomForest); PR-AUC used for model selection instead of accuracy",
        "algorithm": best_name,
        "selection_criterion": "highest mean 5-fold CV PR-AUC (average precision) on training set, tie-break on F1 — NOT accuracy, which is meaningless at 0.17% positive rate",
        "candidates_compared": comparison,
        "isolation_forest_anomaly_baseline": isolation_forest_baseline,
        "default_threshold": 0.5,
        "selected_threshold": selected_threshold,
        "metrics_at_default_threshold": metrics_default,
        "metrics_at_selected_threshold": metrics_tuned,
        "feature_importance": top_features,
        "artifact_path": str(artifact_path.relative_to(artifact_path.parents[2])),
    }
    model_registry.record_model_metadata(metadata)

    return metadata


if __name__ == "__main__":
    result = run()
    print(f"Best transaction model: {result['algorithm']}")
    print(f"Test PR-AUC: {result['metrics_at_selected_threshold']['pr_auc']:.4f}")
    print(f"Test F1 (tuned threshold): {result['metrics_at_selected_threshold']['f1']:.4f}")
