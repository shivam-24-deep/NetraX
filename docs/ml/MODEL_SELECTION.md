# Model Selection

Every number below comes from `ml/models/model_metadata.json`, produced by
`ml/train.py` (random_seed=42, single run, no repeated tuning against the
test set). Re-running `ml/train.py` reproduces these values.

## Methodology

For each dataset:
1. Exact-duplicate rows dropped **before** splitting (leakage prevention — see `DATASET_REPORT.md`).
2. 80/20 stratified train/test split, `random_state=42`. The test set is touched exactly once, at the very end.
3. Candidate models compared via 5-fold stratified cross-validation **on the training set only**.
4. The best candidate is selected by a documented criterion (below), refit on the full training set.
5. Its decision threshold is tuned on **out-of-fold training predictions** (`cross_val_predict`) — the test set is never used for threshold selection.
6. Final metrics are computed **once** on the untouched test set, at both the default (0.5) and tuned threshold.

---

## SMS Fraud/Spam Classifier

**Selection criterion**: highest mean 5-fold CV F1 on the training set, tie-broken by recall (missing a scam is worse than a false alarm for a security product).

| Model | Accuracy | Precision | Recall | F1 | ROC-AUC |
|---|---|---|---|---|---|
| Logistic Regression | 0.9836 | 0.9284 | 0.9425 | 0.9354 | 0.9913 |
| **Linear SVM (selected)** | **0.9872** | **0.9719** | **0.9252** | **0.9479** | **0.9918** |
| Multinomial Naive Bayes | 0.9657 | 1.0000 | 0.7279 | 0.8412 | 0.9813 |
| Random Forest | 0.9729 | 0.9975 | 0.7873 | 0.8797 | 0.9896 |

**Winner: Linear SVM** (via `CalibratedClassifierCV` for probability outputs). It had the best CV F1 by a clear margin. Naive Bayes and Random Forest both hit ~99–100% precision but at the cost of recall in the 73–79% range — for a fraud detector that misses roughly 1 in 4 scams, that trade-off is worse than SVM's more balanced 92.5% recall / 97.2% precision.

Threshold tuned to **0.43** (vs. default 0.5) on out-of-fold training predictions, maximizing F1.

---

## Phishing URL Classifier

**Selection criterion**: highest mean 5-fold CV F1, tie-broken by ROC-AUC (the risk-fusion layer uses the raw probability, so ranking quality matters, not just the thresholded class).

| Model | Accuracy | Precision | Recall | F1 | ROC-AUC |
|---|---|---|---|---|---|
| Logistic Regression | 0.9207 | 0.9314 | 0.9139 | 0.9225 | 0.9753 |
| Random Forest | 0.9491 | 0.9573 | 0.9437 | 0.9504 | 0.9883 |
| **HistGradientBoosting (selected)** | **0.9506** | **0.9525** | **0.9520** | **0.9522** | **0.9920** |
| XGBoost | 0.9474 | 0.9503 | 0.9478 | 0.9490 | 0.9915 |

**Winner: HistGradientBoosting.** All four candidates are close (F1 within ~3 points of each other) since the 30 engineered features are already highly predictive by design — but HGB had the best F1 *and* the best ROC-AUC, so there's no real trade-off to explain here, just a consistent win across both criteria.

Threshold tuned to **0.45**. Note: `ml/data/.old.arff` (the smaller, earlier dataset version) was not used for training — see `DATASET_REPORT.md`.

---

## Transaction Fraud Detector

**Selection criterion**: highest mean 5-fold CV **PR-AUC** (average precision), tie-broken by F1 — explicitly **not** accuracy, which is meaningless at a 0.17% fraud rate (predicting "always legitimate" scores 99.83% accuracy while catching zero fraud).

| Model | Accuracy | Precision | Recall | F1 | ROC-AUC | **PR-AUC** |
|---|---|---|---|---|---|---|
| Logistic Regression (class_weight=balanced) | 0.9758 | 0.0605 | 0.9179 | 0.1135 | 0.9814 | 0.7538 |
| **Random Forest (class_weight=balanced, selected)** | **0.9995** | **0.9390** | **0.7513** | **0.8322** | **0.9575** | **0.8376** |
| HistGradientBoosting (unweighted) | 0.9982 | 0.4616 | 0.5342 | 0.4928 | 0.6403 | 0.4766 |
| *Isolation Forest (unsupervised anomaly baseline)* | — | 0.198†| 0.189† | — | 0.9348 | 0.1114 |

†Precision/recall at IsolationForest's `contamination` parameter set to the true fraud rate — reported as a comparison baseline only, not eligible for production selection (unsupervised, no probability calibration).

**Winner: Random Forest.** This is the clearest trade-off of the three models:
- **Logistic Regression** with class balancing achieves high recall (91.8%) but catastrophic precision (6.1%) — it would flag ~15 legitimate transactions as fraud for every real fraud caught. Unusable as-is.
- **HistGradientBoosting** underperformed badly (PR-AUC 0.477, ROC-AUC 0.640). Unlike LogisticRegression/RandomForest, scikit-learn 1.4's `HistGradientBoostingClassifier` has no `class_weight` parameter, and its default early-stopping (triggered automatically above 10,000 samples, monitored on log-loss) likely stops before it learns to separate the extreme minority class well. This is reported honestly as a real result, not tuned around — it's exactly the kind of finding Phase 4 model comparison is meant to catch.
- **Random Forest** with `class_weight="balanced"` gives the best PR-AUC (0.838) with a much more usable precision/recall balance (93.9% / 75.1% before threshold tuning).
- **Isolation Forest**, the unsupervised anomaly-detection baseline, reaches a respectable ROC-AUC (0.935) purely from unlabeled structure, but its PR-AUC (0.111) is far below the supervised models — expected, since it has no access to the fraud labels at all. Included per spec as a documented comparison point, not a candidate for the production model.

Threshold tuned to **0.26** (well below 0.5) on out-of-fold training predictions — appropriate for a rare-positive-class problem where the raw probabilities skew low.

**Imbalance handling used**: `class_weight="balanced"` (Logistic Regression, Random Forest), not SMOTE. This was a deliberate choice to avoid adding the `imbalanced-learn` dependency when class-weighting already gives a workable precision/recall trade-off — see `ml/requirements-ml.txt` for the full (unchanged) dependency list.

---

## Summary

| Dataset | Winner | Primary metric | Test-set value |
|---|---|---|---|
| SMS | Linear SVM | F1 | 0.937 |
| URL | HistGradientBoosting | F1 | 0.954 |
| Transaction | Random Forest | PR-AUC | 0.809 |

These are measured results on a single held-out test set each — not a claim that any model is "perfect" or will generalize identically to real-world traffic. See `TRAINING_REPORT.md` §14 (Limitations) for what these numbers do and don't mean in production.
