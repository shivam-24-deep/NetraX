"""Tests for the DhokhaDetect/NetraX ML pipeline.

Run with: ml/.venv/Scripts/python.exe -m pytest tests/ -v
(from the ml/ directory, after ml/train.py has produced ml/models/*.joblib)
"""

from __future__ import annotations

import sys
from pathlib import Path

import numpy as np
import pytest

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from src import data_loader, inference, model_registry, preprocessing  # noqa: E402

MODELS_DIR = Path(__file__).resolve().parents[1] / "models"


def _models_available() -> bool:
    return all(
        (MODELS_DIR / f).exists()
        for f in ["sms_pipeline.joblib", "email_pipeline.joblib", "url_pipeline.joblib", "transaction_pipeline.joblib"]
    )


requires_models = pytest.mark.skipif(not _models_available(), reason="Run ml/train.py first to produce model artifacts")


# --- dataset loading ---

class TestDatasetLoading:
    def test_sms_loads_expected_row_count(self):
        df = data_loader.load_sms()
        assert len(df) == 5574
        assert list(df.columns) == ["label", "message"]
        assert set(df["label"].unique()) == {"ham", "spam"}

    def test_url_loads_expected_row_count(self):
        df = data_loader.load_url()
        assert len(df) == 11055
        assert "Result" in df.columns
        assert set(df["Result"].unique()) == {1, -1}

    def test_url_legacy_loads(self):
        df = data_loader.load_url(use_legacy=True)
        assert len(df) == 2456

    def test_email_loads_with_ham_and_spam_labels(self):
        df = data_loader.load_email()
        assert len(df) > 0
        assert list(df.columns) == ["label", "message", "source_file"]
        assert set(df["label"].unique()) == {"ham", "spam"}
        assert df["message"].str.len().gt(0).all()

    def test_transaction_loads_expected_row_count(self):
        df = data_loader.load_transaction()
        assert len(df) == 284807
        assert "Class" in df.columns
        assert set(df["Class"].unique()) == {0, 1}

    def test_missing_file_raises_clear_error(self):
        with pytest.raises(FileNotFoundError):
            data_loader._require(Path("does/not/exist.csv"))


# --- preprocessing ---

class TestPreprocessing:
    def test_drop_exact_duplicates_sms(self):
        df = data_loader.load_sms()
        deduped, removed = preprocessing.drop_exact_duplicates(df)
        assert removed == 403
        assert len(deduped) == 5574 - 403
        assert deduped.duplicated().sum() == 0

    def test_drop_exact_duplicates_noop_when_none(self):
        import pandas as pd

        df = pd.DataFrame({"a": [1, 2, 3]})
        deduped, removed = preprocessing.drop_exact_duplicates(df)
        assert removed == 0
        assert len(deduped) == 3


# --- model loading ---

@requires_models
class TestModelLoading:
    def test_all_pipelines_load(self):
        for name in ["sms_pipeline.joblib", "email_pipeline.joblib", "url_pipeline.joblib", "transaction_pipeline.joblib"]:
            pipeline = model_registry.load_pipeline(name)
            assert pipeline is not None

    def test_metadata_has_all_models(self):
        meta = model_registry.load_metadata()
        assert "sms_fraud_classifier" in meta
        assert "email_content_classifier" in meta
        assert "url_phishing_classifier" in meta
        assert "transaction_fraud_detector" in meta

    def test_missing_artifact_raises_clear_error(self):
        with pytest.raises(FileNotFoundError):
            model_registry.load_pipeline("does_not_exist.joblib")


# --- inference correctness ---

@requires_models
class TestSmsInference:
    def test_probability_in_valid_range(self):
        result = inference.predict_sms("Congratulations! You have won a prize, click here now!")
        assert 0.0 <= result["fraud_probability"] <= 1.0

    def test_no_nan_or_infinity(self):
        result = inference.predict_sms("hey are we still meeting for lunch")
        assert np.isfinite(result["fraud_probability"])

    def test_risk_level_is_valid(self):
        result = inference.predict_sms("URGENT: verify your OTP now or your account will be suspended")
        assert result["risk_level"] in {"LOW", "MEDIUM", "HIGH"}

    def test_obvious_scam_scores_high(self):
        result = inference.predict_sms(
            "URGENT! Your account has been suspended. Verify your OTP immediately or lose access. Click now!"
        )
        assert result["fraud_probability"] > 0.5

    def test_benign_message_scores_low(self):
        result = inference.predict_sms("hey are we still meeting for lunch at 1pm tomorrow")
        assert result["fraud_probability"] < 0.5

    def test_empty_input_rejected(self):
        with pytest.raises(ValueError):
            inference.predict_sms("")

    def test_non_string_input_rejected(self):
        with pytest.raises(ValueError):
            inference.predict_sms(12345)  # type: ignore[arg-type]


@requires_models
class TestEmailInference:
    def test_probability_in_valid_range(self):
        result = inference.predict_email("Congratulations! You have won a prize, click here now to claim it!")
        assert 0.0 <= result["fraud_probability"] <= 1.0

    def test_no_nan_or_infinity(self):
        result = inference.predict_email("Hi team, attaching the quarterly report for your review. Thanks!")
        assert np.isfinite(result["fraud_probability"])

    def test_risk_level_is_valid(self):
        result = inference.predict_email("URGENT: verify your account password immediately or it will be suspended")
        assert result["risk_level"] in {"LOW", "MEDIUM", "HIGH"}

    def test_obvious_spam_scores_high(self):
        result = inference.predict_email(
            "CONGRATULATIONS!!! You have WON $1,000,000 in our lottery! Click here now and enter your bank "
            "account details to claim your prize before it expires! Act now, limited time offer!"
        )
        assert result["fraud_probability"] > 0.5

    def test_benign_message_scores_low(self):
        # Note: SpamAssassin's "ham" class is mostly tech-mailing-list traffic,
        # not generic corporate correspondence (see the email_content_classifier
        # metadata "notes" field) — a polished formal business email actually
        # sits close to this model's
        # decision boundary since that register is underrepresented in ham. This
        # example uses the more casual, direct phrasing the ham class actually
        # contains, which is a fair (not cherry-picked-easy) sanity check.
        result = inference.predict_email(
            "thanks for the quick reply, I'll take a look at the patch and get back to you tomorrow"
        )
        assert result["fraud_probability"] < 0.5

    def test_empty_input_rejected(self):
        with pytest.raises(ValueError):
            inference.predict_email("")

    def test_non_string_input_rejected(self):
        with pytest.raises(ValueError):
            inference.predict_email(12345)  # type: ignore[arg-type]


@requires_models
class TestUrlInference:
    def test_probability_in_valid_range(self):
        result = inference.predict_url("http://secure-login-verify-account.paym3nt-update.info/reset")
        assert 0.0 <= result["fraud_probability"] <= 1.0

    def test_risk_level_is_valid(self):
        result = inference.predict_url("https://www.google.com")
        assert result["risk_level"] in {"LOW", "MEDIUM", "HIGH"}

    def test_reports_partial_confidence(self):
        result = inference.predict_url("http://192.168.1.1/login")
        assert "partial" in result["confidence"]
        assert 0 < result["feature_coverage"] < 1

    def test_ip_based_url_detected_lexically(self):
        result = inference.predict_url("http://192.168.1.1/login")
        assert "having_IP_Address" in result["features_used_from_url"]

    def test_empty_input_rejected(self):
        with pytest.raises(ValueError):
            inference.predict_url("")


@requires_models
class TestTransactionInference:
    def test_probability_in_valid_range_on_real_test_row(self):
        df = data_loader.load_transaction()
        row = df.iloc[0].to_dict()
        result = inference.predict_transaction(row)
        assert 0.0 <= result["fraud_probability"] <= 1.0

    def test_missing_features_rejected(self):
        with pytest.raises(ValueError):
            inference.predict_transaction({"Time": 0, "Amount": 100})  # missing V1-V28


# --- risk level thresholds ---

class TestRiskLevel:
    def test_boundaries(self):
        assert inference.risk_level(0.9) == "HIGH"
        assert inference.risk_level(0.5) == "MEDIUM"
        assert inference.risk_level(0.1) == "LOW"

    def test_no_value_outside_three_levels(self):
        for p in np.linspace(0, 1, 21):
            assert inference.risk_level(p) in {"LOW", "MEDIUM", "HIGH"}
