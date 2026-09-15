"""Trains and selects the SMS spam/fraud classifier.

Selection criterion (documented per spec): mean cross-validated F1 on the
training set, since SMS spam needs a balance of precision (don't cry wolf on
real messages) and recall (don't miss scams) — F1 captures that balance
directly. Ties are broken by higher recall (missing a scam is worse than a
false positive for a security product).
"""

from __future__ import annotations

import numpy as np
from sklearn.base import clone
from sklearn.ensemble import RandomForestClassifier
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.linear_model import LogisticRegression
from sklearn.model_selection import StratifiedKFold, cross_val_predict, cross_validate, train_test_split
from sklearn.naive_bayes import MultinomialNB
from sklearn.pipeline import Pipeline
from sklearn.svm import LinearSVC
from sklearn.calibration import CalibratedClassifierCV

from . import data_loader, evaluation, model_registry

RANDOM_SEED = 42


def _build_candidates() -> dict[str, Pipeline]:
    # stop_words intentionally left as None: fraud signal words like "otp",
    # "bank", "verify", "account", "click" must not be filtered out.
    vectorizer = lambda: TfidfVectorizer(max_features=5000, ngram_range=(1, 2), min_df=2, stop_words=None)
    return {
        "LogisticRegression": Pipeline([
            ("tfidf", vectorizer()),
            ("clf", LogisticRegression(max_iter=1000, class_weight="balanced", random_state=RANDOM_SEED)),
        ]),
        "LinearSVM": Pipeline([
            ("tfidf", vectorizer()),
            ("clf", CalibratedClassifierCV(LinearSVC(class_weight="balanced", random_state=RANDOM_SEED, dual="auto"), cv=3)),
        ]),
        "MultinomialNB": Pipeline([
            ("tfidf", vectorizer()),
            ("clf", MultinomialNB()),
        ]),
        "RandomForest": Pipeline([
            ("tfidf", vectorizer()),
            ("clf", RandomForestClassifier(n_estimators=300, class_weight="balanced", random_state=RANDOM_SEED, n_jobs=-1)),
        ]),
    }


def run() -> dict:
    df = data_loader.load_sms()
    raw_rows = len(df)

    before_dedup = len(df)
    df = df.drop_duplicates(subset=["label", "message"]).reset_index(drop=True)
    duplicates_removed = before_dedup - len(df)

    df["target"] = (df["label"] == "spam").astype(int)

    X = df["message"]
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

    best_name = max(comparison, key=lambda n: (comparison[n]["f1"], comparison[n]["recall"]))
    best_pipeline = clone(candidates[best_name])

    # Out-of-fold probabilities on the TRAINING set only, for threshold tuning
    # without ever touching the test set.
    oof_proba = cross_val_predict(clone(candidates[best_name]), X_train, y_train, cv=cv, method="predict_proba", n_jobs=-1)[:, 1]
    threshold_info = evaluation.tune_threshold(y_train.to_numpy(), oof_proba, objective="f1")
    selected_threshold = threshold_info["selected"]["threshold"]

    best_pipeline.fit(X_train, y_train)

    test_proba = best_pipeline.predict_proba(X_test)[:, 1]
    test_pred_default = (test_proba >= 0.5).astype(int)
    test_pred_tuned = (test_proba >= selected_threshold).astype(int)

    metrics_default = evaluation.compute_metrics(y_test, test_pred_default, test_proba)
    metrics_tuned = evaluation.compute_metrics(y_test, test_pred_tuned, test_proba)

    # Figures
    evaluation.plot_class_distribution(
        {"ham": int((df["target"] == 0).sum()), "spam": int((df["target"] == 1).sum())},
        "SMS Dataset — Class Distribution", "sms_class_distribution.png", xlabel="Label",
    )
    evaluation.plot_confusion_matrix(y_test, test_pred_tuned, ["ham", "spam"], "SMS Model — Confusion Matrix (Test Set)", "sms_confusion_matrix.png")
    evaluation.plot_roc_curve(y_test, test_proba, "SMS Model — ROC Curve (Test Set)", "sms_roc_curve.png")
    evaluation.plot_pr_curve(y_test, test_proba, "SMS Model — Precision-Recall Curve (Test Set)", "sms_pr_curve.png")
    evaluation.plot_model_comparison(comparison, "f1", "SMS Candidate Models — Mean CV F1", "sms_model_comparison.png")

    # Feature importance (top TF-IDF terms)
    try:
        vec: TfidfVectorizer = best_pipeline.named_steps["tfidf"]
        clf = best_pipeline.named_steps["clf"]
        feature_names = np.array(vec.get_feature_names_out())
        if hasattr(clf, "coef_"):
            importances = np.abs(clf.coef_[0])
        elif hasattr(clf, "feature_importances_"):
            importances = clf.feature_importances_
        elif hasattr(clf, "estimator") and hasattr(clf, "calibrated_classifiers_"):
            importances = np.abs(clf.calibrated_classifiers_[0].estimator.coef_[0])
        else:
            importances = None
        if importances is not None:
            evaluation.plot_feature_importance(list(feature_names), list(importances), "SMS Model — Top TF-IDF Terms by Importance", "sms_feature_importance.png")
            top_features = evaluation.top_feature_importances(list(feature_names), list(importances))
        else:
            top_features = None
    except Exception:
        top_features = None

    artifact_path = model_registry.save_pipeline(best_pipeline, "sms_pipeline.joblib")

    metadata = {
        "model_name": "sms_fraud_classifier",
        "dataset": "UCI SMS Spam Collection",
        "dataset_file": "ml/data/SMSSpamCollection",
        "raw_rows": raw_rows,
        "duplicates_removed": duplicates_removed,
        "rows_used": len(df),
        "train_rows": len(X_train),
        "test_rows": len(X_test),
        "target": "label (ham=0, spam=1)",
        "features": "TF-IDF (unigrams+bigrams, max 5000 features)",
        "algorithm": best_name,
        "selection_criterion": "highest mean 5-fold CV F1 on training set, tie-break on recall",
        "candidates_compared": comparison,
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
    print(f"Best SMS model: {result['algorithm']}")
    print(f"Test F1 (tuned threshold): {result['metrics_at_selected_threshold']['f1']:.4f}")
