# Training Report

Generated from a real run of `ml/train.py` (random_seed=42). Every metric
below is copied from `ml/models/model_metadata.json`, not estimated.

## 1. Project Overview

NetraX (built under the working title "DhokhaDetect AI") is an SIH fraud-
investigation platform. This report covers the ML layer: three independently
trained, specialized classifiers — SMS, phishing URL, and transaction fraud
— feeding a shared risk-fusion layer, as opposed to one combined model
(the three problems have different features and different data shapes, so
combining them would either force irrelevant features onto each case type
or throw away most of each dataset's signal).

## 2. Dataset Overview

See `docs/ml/DATASET_REPORT.md` for full field-by-field detail. Summary:

| Dataset | Rows (raw) | Duplicates removed | Rows used | Class balance |
|---|---|---|---|---|
| SMS Spam Collection | 5,574 | 403 | 5,171 | 86.6% ham / 13.4% spam |
| Phishing Websites | 11,055 | 5,206 | 5,849 | 55.7% legit / 44.3% phishing |
| Credit Card Fraud | 284,807 | 1,081 | 283,726 | 99.83% legit / 0.17% fraud |

Figures: `sms_class_distribution.png`, `url_class_distribution.png`, `transaction_class_distribution.png`.

## 3. Data Cleaning

- **SMS**: fixed a real data-corruption bug where pandas' default CSV quoting silently merged row pairs around unbalanced `"` characters in message text (5,574 → 5,572 rows) — see `data_loader.load_sms()`. No text was lowercased/stemmed/stopword-filtered before vectorization; fraud-signal words ("otp", "bank", "verify", "account", "click") were deliberately preserved.
- **URL**: no feature invention — used exactly the 30 features present in `Training Dataset.arff`, corroborated against the authors' own `Phishing Websites Features.docx`.
- **Transaction**: no anomalies removed for "looking unusual" — `V1`-`V28`/`Amount`/`Time` used as-is; only exact duplicate rows dropped.
- All three: exact duplicates dropped **before** the train/test split (leakage prevention).

## 4. Feature Engineering

- **SMS**: TF-IDF, unigrams + bigrams, `max_features=5000`, `min_df=2`, no stopword removal.
- **URL**: none needed — dataset ships pre-engineered categorical features (see the authors' rule definitions in the docx).
- **Transaction**: none added — `V1`-`V28` are the dataset publishers' own PCA-anonymized features; `Amount`/`Time` used directly. `StandardScaler` applied for the Logistic Regression candidate only (tree models don't need it).

## 5. Train/Test Strategy

80/20 stratified split, `random_state=42`, for all three datasets. Model
comparison used 5-fold stratified cross-validation **on the training set
only**; threshold tuning used out-of-fold training predictions
(`cross_val_predict`). The test set was evaluated exactly once, at the end,
for each dataset.

## 6. Models Compared

- **SMS**: Logistic Regression, Linear SVM, Multinomial Naive Bayes, Random Forest.
- **URL**: Logistic Regression, Random Forest, HistGradientBoosting, XGBoost.
- **Transaction**: Logistic Regression, Random Forest, HistGradientBoosting, plus Isolation Forest as an unsupervised comparison baseline.

Full comparison tables with all metrics: `docs/ml/MODEL_SELECTION.md`.
Figures: `*_model_comparison.png` for each dataset.

## 7. Best Model (per dataset)

| Dataset | Selected model | Selection criterion |
|---|---|---|
| SMS | Linear SVM | highest mean CV F1, tie-break recall |
| URL | HistGradientBoosting | highest mean CV F1, tie-break ROC-AUC |
| Transaction | Random Forest | highest mean CV PR-AUC, tie-break F1 |

Full reasoning, including why the runner-ups were *not* selected (e.g. Naive Bayes' 73% recall on SMS, HistGradientBoosting's 0.48 PR-AUC on transactions): `docs/ml/MODEL_SELECTION.md`.

## 8. Final Test Metrics (selected threshold)

| Model | Accuracy | Precision | Recall | F1 | ROC-AUC | PR-AUC |
|---|---|---|---|---|---|---|
| SMS (Linear SVM) | 0.9845 | 0.9675 | 0.9084 | 0.9370 | 0.9900 | 0.9686 |
| URL (HistGradientBoosting) | 0.9530 | 0.9598 | 0.9487 | 0.9542 | 0.9928 | 0.9936 |
| Transaction (Random Forest) | 0.9995 | 0.9467 | 0.7474 | 0.8353 | 0.9491 | 0.8094 |

Metrics at the untuned default (0.5) threshold are also recorded in
`model_metadata.json` for comparison (`metrics_at_default_threshold`).

## 9. Confusion Matrices

Test-set confusion matrices (rows = actual, cols = predicted), at each model's tuned threshold:

**SMS** (threshold 0.43) — `sms_confusion_matrix.png`
```
              pred ham   pred spam
actual ham       900          4
actual spam       12        119
```

**URL** (threshold 0.45) — `url_confusion_matrix.png`
```
              pred legit  pred phishing
actual legit      542          24
actual phishing    31         573
```

**Transaction** (threshold 0.26) — `transaction_confusion_matrix.png`
```
              pred legit   pred fraud
actual legit    56,647          4
actual fraud        24         71
```

## 10. Precision/Recall

Discussed per-model in §8 and in `MODEL_SELECTION.md`. Headline: the
transaction model deliberately favors precision (94.7%) over recall (74.7%)
at its tuned threshold — of the 95 real frauds in the test set, 71 were
caught and 24 missed, while only 4 legitimate transactions were
false-flagged. This is a real, measured trade-off, not a claim that 3 in 4
frauds will always be caught in production.

## 11. ROC-AUC

SMS 0.990, URL 0.993, Transaction 0.949 — all measured on the untouched test
set. Curves: `sms_roc_curve.png`, `url_roc_curve.png`, `transaction_roc_curve.png`.

## 12. PR-AUC

SMS 0.969, URL 0.994, Transaction 0.809 — PR-AUC is the more informative
curve for the transaction model specifically, given its extreme class
imbalance (a ROC-AUC of 0.949 sounds strong, but PR-AUC 0.809 gives a truer
picture of performance on the rare positive class). Curves:
`sms_pr_curve.png`, `url_pr_curve.png`, `transaction_pr_curve.png`.

## 13. Feature Importance

- **SMS** (`sms_feature_importance.png`): top TF-IDF terms by |SVM coefficient| — dominated by classic scam vocabulary (reward/urgency/contact-request terms), consistent with the message-analyzer's own rule-based indicators built elsewhere in the app.
- **URL** (`url_feature_importance.png`): computed via permutation importance on the test set (HistGradientBoostingClassifier exposes neither `feature_importances_` nor `coef_`) — `SSLfinal_State`, `URL_of_Anchor`, and `web_traffic` rank highest, matching the original dataset authors' own emphasis on SSL-certificate state and link-anchor behavior as strong phishing signals.
- **Transaction** (`transaction_feature_importance.png`): Random Forest `feature_importances_` — a handful of the anonymized `V*` PCA components dominate, as expected; `Amount` and `Time` contribute comparatively little on their own.

Feature importance reflects the trained model's reliance on a feature, **not causal proof** that the feature causes fraud.

## 14. Limitations

- **Test-set metrics, not real-world guarantees.** These numbers describe performance on one held-out split of these specific public datasets. No claim of "perfect", "100% accurate", or "guaranteed fraud detection" is made anywhere in this pipeline or its integration — see `ml/src/inference.py` and the risk-fusion layer for how model output is explicitly kept separate from the final agent risk assessment.
- **URL model input gap.** The trained model expects 30 engineered features (SSL certificate state, domain age, DNS record existence, web-traffic rank, Google index status, PageRank, etc.). Most require live WHOIS/DNS/third-party ranking lookups this offline pipeline doesn't perform — and some (Alexa rank, Google PageRank) are services that no longer exist in a freely queryable form at all. `predict_url()` computes only the ~7 features derivable from the URL string itself and imputes the rest from training-set modes, and reports `confidence: "partial"` with a `feature_coverage` fraction accordingly. This is real inference from the real trained model, just on incomplete evidence — never fabricated.
- **Transaction model input gap (more fundamental).** `V1`-`V28` are PCA components of a private, never-published original feature set — they cannot be derived from a human-readable transaction description (amount/merchant/location/time/device). The trained model can only be validly run on data already in the dataset's native format (e.g. held-out rows from the same dataset), not on free-text fields a user types into the Investigate UI. The existing rule-based Behavioral Analyzer continues to handle free-text transaction input; the trained model is demonstrated on native-format examples (e.g. in the Model Performance page / automated tests).
- **Duplicate rates.** The URL dataset is 47% exact duplicates before cleaning — a known characteristic of its coarse categorical feature space, not a data-quality error, but worth knowing if extending the dataset.
- **HistGradientBoosting on transactions underperformed** (PR-AUC 0.477) — sklearn 1.4's `HistGradientBoostingClassifier` has no `class_weight` parameter and its automatic early-stopping likely triggers before the minority class is well-separated. Reported honestly rather than tuned away.
- **No SMOTE.** Class imbalance on the transaction dataset is handled via `class_weight="balanced"`, not oversampling, to avoid adding the `imbalanced-learn` dependency for what class-weighting already addresses reasonably.

## 15. Future Improvements

- Add sample-weighted or threshold-adjusted variants of HistGradientBoosting for the transaction dataset to see if it can be made competitive with Random Forest.
- If real WHOIS/DNS/SSL lookups become available server-side, extend `predict_url()`'s feature extraction beyond the current lexical-only subset for meaningfully higher real-world coverage.
- Retrain periodically as `ml/train.py` is fully reproducible (`random_seed=42`, pinned `requirements-ml.txt`) — re-run whenever the underlying datasets are refreshed.
- Consider model calibration curves (reliability diagrams) alongside ROC/PR if the fusion layer starts relying on precise probability values rather than thresholded risk levels.
