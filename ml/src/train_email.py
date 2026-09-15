"""Trains and selects the email spam/phishing content classifier.

Same selection criterion as train_sms.py (mean CV F1, tie-break on recall)
and the same reasoning: missing a real threat is worse than one extra
false-positive flag for an analyst to dismiss.

Dataset: Apache SpamAssassin public corpus (see docs/DATA_SOURCES.md).
Per Rule 6, the Enron corpus is NEVER used here — it has no malicious/benign
ground-truth labels, only SpamAssassin's explicit ham/spam labels are used.

This model scores email BODY content/language — it is a content-language
signal that complements, not replaces, the deterministic header-forensics
engine (Phase 4) and URL analysis (Phase 5), which examine header
authenticity and link structure respectively. See Rule 7: training data,
ML signals, and rule-based forensics stay separate and are combined only in
the risk engine (Phase 11).
"""

from __future__ import annotations

import numpy as np
from sklearn.base import clone
from sklearn.calibration import CalibratedClassifierCV
from sklearn.ensemble import RandomForestClassifier
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.linear_model import LogisticRegression
from sklearn.model_selection import StratifiedKFold, cross_val_predict, cross_validate, train_test_split
from sklearn.naive_bayes import MultinomialNB
from sklearn.pipeline import Pipeline
from sklearn.svm import LinearSVC

from . import data_loader, evaluation, model_registry

RANDOM_SEED = 42


def _build_candidates() -> dict[str, Pipeline]:
    # stop_words=None for the same reason as train_sms.py: phishing signal
    # words ("verify", "urgent", "account", "click", "password") are exactly
    # the kind of common words a stop-word list would otherwise discard.
    vectorizer = lambda: TfidfVectorizer(max_features=8000, ngram_range=(1, 2), min_df=2, stop_words=None)
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
    df = data_loader.load_email()
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
        {"ham": int((df["target"] == 0).sum()), "spam": int((df["target"] == 1).sum())},
        "Email Dataset — Class Distribution", "email_class_distribution.png", xlabel="Label",
    )
    evaluation.plot_confusion_matrix(y_test, test_pred_tuned, ["ham", "spam"], "Email Model — Confusion Matrix (Test Set)", "email_confusion_matrix.png")
    evaluation.plot_roc_curve(y_test, test_proba, "Email Model — ROC Curve (Test Set)", "email_roc_curve.png")
    evaluation.plot_pr_curve(y_test, test_proba, "Email Model — Precision-Recall Curve (Test Set)", "email_pr_curve.png")
    evaluation.plot_model_comparison(comparison, "f1", "Email Candidate Models — Mean CV F1", "email_model_comparison.png")

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
            evaluation.plot_feature_importance(list(feature_names), list(importances), "Email Model — Top TF-IDF Terms by Importance", "email_feature_importance.png")
            top_features = evaluation.top_feature_importances(list(feature_names), list(importances))
        else:
            top_features = None
    except Exception:
        top_features = None

    artifact_path = model_registry.save_pipeline(best_pipeline, "email_pipeline.joblib")

    metadata = {
        "model_name": "email_content_classifier",
        "dataset": "Apache SpamAssassin Public Corpus",
        "dataset_file": "data/raw/spamassassin/*.tar.bz2",
        "raw_rows": raw_rows,
        "duplicates_removed": duplicates_removed,
        "rows_used": len(df),
        "train_rows": len(X_train),
        "test_rows": len(X_test),
        "target": "label (ham=0, spam=1)",
        "features": "TF-IDF (unigrams+bigrams, max 8000 features) over extracted email body text",
        "algorithm": best_name,
        "selection_criterion": "highest mean 5-fold CV F1 on training set, tie-break on recall",
        "candidates_compared": comparison,
        "default_threshold": 0.5,
        "selected_threshold": selected_threshold,
        "metrics_at_default_threshold": metrics_default,
        "metrics_at_selected_threshold": metrics_tuned,
        "feature_importance": top_features,
        "artifact_path": str(artifact_path.relative_to(artifact_path.parents[2])),
        "notes": (
            "Trained on SpamAssassin's explicit spam/ham labels only. Enron is deliberately "
            "excluded per Rule 6 (not malicious/benign ground truth). This model scores body "
            "content/language and is one input to the risk engine alongside (not a replacement "
            "for) the deterministic header-forensics and URL-analysis findings — see Rule 7. "
            "KNOWN LIMITATION: the 'ham' class is mostly tech-mailing-list traffic (e.g. Linux "
            "user group threads) from 2002-2005, not generic modern corporate correspondence — "
            "a polished formal business email can score closer to the decision boundary than "
            "casual/direct phrasing does, since that register is underrepresented in training data."
        ),
    }
    model_registry.record_model_metadata(metadata)

    return metadata


if __name__ == "__main__":
    result = run()
    print(f"Best email model: {result['algorithm']}")
    print(f"Test F1 (tuned threshold): {result['metrics_at_selected_threshold']['f1']:.4f}")
