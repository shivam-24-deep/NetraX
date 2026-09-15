# Data Quality Report

Generated: 2026-09-06T17:23:54.462424+00:00

Computed by `scripts/validation/profile_datasets.py` directly from the raw files in `data/raw/` — every number below is measured, not estimated. See `reports/data_quality.json` for the machine-readable version this report is rendered from.

## Apache SpamAssassin Public Corpus

- **Total messages**: 10745
- **Class distribution**: ham=6951, spam=3794 (ratio 1.83:1 ham:spam)
- **Empty files**: 0
- **Messages failing basic header check**: 1
- **Unique message hashes**: 9165 (duplicates: 1580)
- **Cross-release-date duplicates**: 1556
- **Label conflicts (same content, both spam & ham)**: 0
- **Leakage risk**: 1556 messages appear byte-identical across more than one release date. If a naive split assigns e.g. 20021010_easy_ham to train and 20030228_easy_ham to test without deduplication, some of these duplicates would leak between splits. Recommendation: deduplicate by content hash BEFORE splitting, not after.
- **Label conflict note**: No label conflicts found: no message content is labeled both spam and ham.

| Release | Label | Messages |
|---|---|---|
| easy_ham_2002 | ham | 2551 |
| hard_ham_2002 | ham | 250 |
| spam_2002 | spam | 501 |
| easy_ham_2003 | ham | 2500 |
| easy_ham_2_2003 | ham | 1400 |
| hard_ham_2003 | ham | 250 |
| spam_2003 | spam | 500 |
| spam_2_2003 | spam | 1397 |
| spam_2_2005 | spam | 1396 |

## UCI Phishing Websites Dataset

- **Instances**: 11055
- **Features**: 30 (+ 1 class attribute: `Result`)
- **Malformed rows**: 0
- **Rows with missing values**: 0
- **Exact duplicate rows**: 5206
- **Class distribution**: {'-1': 4898, '1': 6157}
- **Class imbalance ratio**: 1.26
- **Leakage risk**: 5206 exact-duplicate feature-vector rows found. If present on both sides of a train/test split, these leak information. Recommendation: deduplicate before splitting.
- **Already handled**: `ml/src/train_url.py` already calls `drop_duplicates()` before splitting and documents this exact 47% duplicate rate in its module docstring — this profiling run independently confirms that existing handling is correct and necessary, it is not a newly discovered gap.

## URLhaus Snapshot

- **Source file**: `urlhaus_csv_recent_20260906.csv`
- **Total records**: 14425 (malformed: 0)
- **Duplicate URLs**: 0
- **Date range covered**: 2026-08-07 01:13:07 to 2026-09-06 16:42:25
- **Threat type distribution**: {'malware_download': 14425}
- **URL status distribution**: {'online': 1609, 'offline': 12816}
- This is a single-class threat-intelligence feed — every record is a confirmed malicious URL. There is no benign/negative class here, so class-imbalance metrics don't apply. It is used for live lookups (Phase 6 ThreatIntelProvider), not as a labeled training set.

## CMU Enron Email Dataset

**Not profiled**: download still in progress (50331648 bytes so far). Re-run this script after scripts/data/download_datasets.py --dataset enron completes.

## PhishTank

**Not profiled**: PhishTank requires credentials that are not configured — see .env.example and docs/DATA_SOURCES.md

## MaxMind GeoLite2

**Not profiled**: MaxMind GeoLite2 requires credentials that are not configured — see .env.example and docs/DATA_SOURCES.md

## Overall data quality summary

- No severe data leakage was found that would silently invalidate a model: the SpamAssassin and UCI Phishing checks above are the ones that matter for the classifiers this project trains, and any duplicate/conflict counts found are reported explicitly above rather than hidden.
- Any non-zero duplicate/label-conflict counts reported above must be resolved (deduplicated, or conflicting labels dropped) in the preprocessing step (Phase 3) before these datasets are split into train/validation/test.
- Enron is intentionally excluded from classifier training data per Rule 6 — it is profiled here only for corpus integrity, not label quality.
- PhishTank and MaxMind GeoLite2 remain unprofiled because no data has been downloaded — both require credentials this environment doesn't have. This is surfaced explicitly rather than silently skipped.
