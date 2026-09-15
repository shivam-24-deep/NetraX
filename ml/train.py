#!/usr/bin/env python
"""Single entry point: trains all three DhokhaDetect/NetraX fraud models.

Run from the ml/ directory with the ml venv active:
    ml/.venv/Scripts/python.exe train.py

Discovers and validates the three datasets, trains + compares candidate
models for each, selects the best per dataset, evaluates once on the held-out
test set, saves pipelines + metadata to ml/models/, and writes figures to
docs/ml/figures/. Prints a concise summary at the end.
"""

from __future__ import annotations

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))

from src import data_loader, train_email, train_sms, train_transaction, train_url  # noqa: E402


def _check_datasets() -> None:
    status = data_loader.dataset_paths_exist()
    missing = [k for k, v in status.items() if not v and k != "url_legacy"]
    if missing:
        raise SystemExit(
            f"Missing required dataset file(s): {missing}. "
            "See docs/ml/DATASET_REPORT.md for the expected ml/data/ layout."
        )
    print("Dataset check:")
    for k, v in status.items():
        print(f"  {k}: {'found' if v else 'not found (optional)'}")
    print()


def main() -> None:
    _check_datasets()

    print("=" * 60)
    print("Training SMS fraud/spam classifier...")
    print("=" * 60)
    sms_result = train_sms.run()
    print(f"  -> {sms_result['algorithm']} | F1={sms_result['metrics_at_selected_threshold']['f1']:.4f} | "
          f"ROC-AUC={sms_result['metrics_at_selected_threshold']['roc_auc']:.4f}\n")

    print("=" * 60)
    print("Training email content classifier...")
    print("=" * 60)
    email_result = train_email.run()
    print(f"  -> {email_result['algorithm']} | F1={email_result['metrics_at_selected_threshold']['f1']:.4f} | "
          f"ROC-AUC={email_result['metrics_at_selected_threshold']['roc_auc']:.4f}\n")

    print("=" * 60)
    print("Training phishing URL classifier...")
    print("=" * 60)
    url_result = train_url.run()
    print(f"  -> {url_result['algorithm']} | F1={url_result['metrics_at_selected_threshold']['f1']:.4f} | "
          f"ROC-AUC={url_result['metrics_at_selected_threshold']['roc_auc']:.4f}\n")

    print("=" * 60)
    print("Training transaction fraud detector...")
    print("=" * 60)
    tx_result = train_transaction.run()
    print(f"  -> {tx_result['algorithm']} | PR-AUC={tx_result['metrics_at_selected_threshold']['pr_auc']:.4f} | "
          f"Recall={tx_result['metrics_at_selected_threshold']['recall']:.4f}\n")

    print("=" * 60)
    print("TRAINING SUMMARY")
    print("=" * 60)
    for label, result, headline_metric in [
        ("SMS", sms_result, "f1"),
        ("Email", email_result, "f1"),
        ("URL", url_result, "f1"),
        ("Transaction", tx_result, "pr_auc"),
    ]:
        m = result["metrics_at_selected_threshold"]
        print(
            f"{label:12s} best={result['algorithm']:20s} "
            f"train={result['train_rows']:>7,} test={result['test_rows']:>6,} "
            f"threshold={result['selected_threshold']:.2f} "
            f"{headline_metric}={m[headline_metric]:.4f} "
            f"precision={m['precision']:.4f} recall={m['recall']:.4f}"
        )
    print()
    print("Artifacts saved to ml/models/ | Figures saved to docs/ml/figures/")
    print("Metrics reflect a single held-out test set — not a claim of certainty on unseen real-world data.")


if __name__ == "__main__":
    main()
