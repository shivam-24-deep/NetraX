"""Loads the three raw datasets exactly as they exist on disk.

No filenames or column names are assumed beyond what was verified by direct
inspection of ml/data/ (see docs/ml/DATASET_REPORT.md). If a file is missing,
this raises a clear error rather than silently fabricating data.
"""

from __future__ import annotations

import email
import re
import tarfile
from pathlib import Path

import pandas as pd
from scipy.io import arff

DATA_DIR = Path(__file__).resolve().parents[1] / "data"
REPO_ROOT = Path(__file__).resolve().parents[2]

SMS_FILE = DATA_DIR / "SMSSpamCollection"
URL_FILE = DATA_DIR / "Training Dataset.arff"
URL_LEGACY_FILE = DATA_DIR / ".old.arff"
TRANSACTION_FILE = DATA_DIR / "creditcard.csv"

# SpamAssassin lives under data/raw/ (Phase 1's acquisition layout, gitignored —
# see data/README.md) rather than ml/data/, unlike the small committed SMS/URL
# files, to avoid duplicating ~13MB already downloaded there.
SPAMASSASSIN_DIR = REPO_ROOT / "data" / "raw" / "spamassassin"
SPAMASSASSIN_FILES = {
    "20021010_easy_ham.tar.bz2": "ham",
    "20021010_hard_ham.tar.bz2": "ham",
    "20021010_spam.tar.bz2": "spam",
    "20030228_easy_ham.tar.bz2": "ham",
    "20030228_easy_ham_2.tar.bz2": "ham",
    "20030228_hard_ham.tar.bz2": "ham",
    "20030228_spam.tar.bz2": "spam",
    "20030228_spam_2.tar.bz2": "spam",
    "20050311_spam_2.tar.bz2": "spam",
}


def _require(path: Path) -> Path:
    if not path.exists():
        raise FileNotFoundError(
            f"Expected dataset file not found: {path}. "
            "See docs/ml/DATASET_REPORT.md for the required ml/data/ layout."
        )
    return path


def load_sms() -> pd.DataFrame:
    """UCI SMS Spam Collection: tab-separated, no header -> [label, message].

    quoting=csv.QUOTE_NONE is required: many messages contain unbalanced `"`
    characters, and pandas' default quoting silently merges pairs of rows
    around them (verified: default quoting drops 5574 -> 5572 rows).
    """
    import csv

    _require(SMS_FILE)
    df = pd.read_csv(
        SMS_FILE, sep="\t", header=None, names=["label", "message"],
        encoding="utf-8", quoting=csv.QUOTE_NONE,
    )
    return df


def _load_arff(path: Path) -> pd.DataFrame:
    data, _meta = arff.loadarff(path)
    df = pd.DataFrame(data)
    for col in df.columns:
        if df[col].dtype == object:
            df[col] = df[col].str.decode("utf-8")
    # ARFF nominal values load as strings; the phishing dataset's features are
    # all numeric-coded categories (-1/0/1), so cast for modeling.
    for col in df.columns:
        df[col] = pd.to_numeric(df[col])
    return df


def load_url(use_legacy: bool = False) -> pd.DataFrame:
    """UCI Phishing Websites dataset (30 features + Result target).

    use_legacy=True loads .old.arff (2,456-row earlier version) instead of the
    primary Training Dataset.arff (11,055 rows). Default is the primary file.
    """
    path = URL_LEGACY_FILE if use_legacy else URL_FILE
    _require(path)
    return _load_arff(path)


def load_transaction() -> pd.DataFrame:
    """Kaggle/ULB Credit Card Fraud dataset: Time, V1-V28, Amount, Class."""
    _require(TRANSACTION_FILE)
    return pd.read_csv(TRANSACTION_FILE)


_HTML_TAG = re.compile(r"<[^>]+>")
_WHITESPACE_RUN = re.compile(r"\s+")


def _html_to_text(html: str) -> str:
    """Minimal fallback for HTML-only messages with no text/plain part.
    Not the same code as the TS parser's html-to-text.ts (different runtime),
    but the same intent: strip tags, don't try to render layout."""
    no_scripts = re.sub(r"(?is)<(script|style)[^>]*>.*?</\1>", " ", html)
    text = _HTML_TAG.sub(" ", no_scripts)
    text = text.replace("&nbsp;", " ").replace("&amp;", "&").replace("&lt;", "<").replace("&gt;", ">")
    return _WHITESPACE_RUN.sub(" ", text).strip()


def _extract_body_text(raw: bytes) -> str:
    """Extracts plain-text body content from a raw RFC 5322 message, preferring
    text/plain parts and falling back to a stripped text/html part. Returns ""
    (never raises) for a message with no extractable text — the caller drops
    empty rows rather than this function guessing content."""
    try:
        msg = email.message_from_bytes(raw)
    except Exception:
        return ""

    plain_parts: list[str] = []
    html_parts: list[str] = []
    for part in msg.walk():
        if part.get_content_maintype() == "multipart":
            continue
        content_type = part.get_content_type()
        if content_type not in ("text/plain", "text/html"):
            continue
        try:
            payload = part.get_payload(decode=True)
            if payload is None:
                continue
            charset = part.get_content_charset() or "utf-8"
            text = payload.decode(charset, errors="replace")
        except (LookupError, UnicodeDecodeError):
            text = payload.decode("utf-8", errors="replace") if payload else ""
        if content_type == "text/plain":
            plain_parts.append(text)
        else:
            html_parts.append(text)

    if plain_parts:
        return "\n".join(plain_parts).strip()
    if html_parts:
        return "\n".join(_html_to_text(h) for h in html_parts).strip()
    return ""


def load_email() -> pd.DataFrame:
    """Apache SpamAssassin public corpus: real spam + ham with body text
    extracted from raw MIME. See docs/DATA_SOURCES.md for licensing/caveats
    (headers predate widespread SPF/DKIM/DMARC — a language/content dataset,
    not a header-authentication dataset)."""
    if not SPAMASSASSIN_DIR.exists():
        raise FileNotFoundError(
            f"Expected SpamAssassin corpus not found at {SPAMASSASSIN_DIR}. "
            "Run: python scripts/data/download_datasets.py --dataset spamassassin"
        )

    rows: list[dict[str, str]] = []
    for filename, label in SPAMASSASSIN_FILES.items():
        path = SPAMASSASSIN_DIR / filename
        if not path.exists():
            raise FileNotFoundError(f"Expected SpamAssassin archive not found: {path}")
        with tarfile.open(path) as tar:
            for member in tar.getmembers():
                if not member.isfile() or member.name.endswith("cmds"):
                    continue
                f = tar.extractfile(member)
                if f is None:
                    continue
                raw = f.read()
                text = _extract_body_text(raw)
                if text:
                    rows.append({"label": label, "message": text, "source_file": f"{filename}:{member.name}"})

    return pd.DataFrame(rows)


def dataset_paths_exist() -> dict[str, bool]:
    return {
        "sms": SMS_FILE.exists(),
        "url_primary": URL_FILE.exists(),
        "url_legacy": URL_LEGACY_FILE.exists(),
        "transaction": TRANSACTION_FILE.exists(),
        "email_spamassassin": SPAMASSASSIN_DIR.exists() and all((SPAMASSASSIN_DIR / f).exists() for f in SPAMASSASSIN_FILES),
    }
