#!/usr/bin/env python3
"""
Reproducible dataset acquisition for FraudShield AI / NetraX (SIH26106).

Downloads every dataset from its OFFICIAL source only (see docs/DATA_SOURCES.md),
records source URL / download date / license notes / sha256 for each file, and
never fabricates a substitute when a source needs credentials it doesn't have.

Usage:
    python scripts/data/download_datasets.py                 # all datasets
    python scripts/data/download_datasets.py --dataset enron
    python scripts/data/download_datasets.py --dataset spamassassin
    python scripts/data/download_datasets.py --dataset urlhaus
    python scripts/data/download_datasets.py --dataset uci_phishing
    python scripts/data/download_datasets.py --dataset phishtank   # needs PHISHTANK_APP_KEY
    python scripts/data/download_datasets.py --dataset geolite     # needs MAXMIND_ACCOUNT_ID + MAXMIND_LICENSE_KEY

No third-party dependencies — stdlib only (urllib, hashlib, tarfile, json).
"""

from __future__ import annotations

import argparse
import hashlib
import json
import os
import shutil
import sys
import time
import urllib.error
import urllib.request
from datetime import datetime, timezone
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parents[2]
DATA_RAW = REPO_ROOT / "data" / "raw"
USER_AGENT = "FraudShieldAI-DatasetAcquisition/1.0 (SIH26106 research project)"


def load_dotenv(path: Path) -> dict[str, str]:
    """Minimal .env parser (no python-dotenv dependency). Env vars win over file values."""
    values: dict[str, str] = {}
    if path.exists():
        for line in path.read_text(encoding="utf-8", errors="ignore").splitlines():
            line = line.strip()
            if not line or line.startswith("#") or "=" not in line:
                continue
            key, _, val = line.partition("=")
            values[key.strip()] = val.strip().strip('"').strip("'")
    values.update({k: v for k, v in os.environ.items() if v})
    return values


ENV = load_dotenv(REPO_ROOT / "frontend" / ".env")
ENV.update({k: v for k, v in os.environ.items() if v})  # real env always wins


def sha256_of(path: Path) -> str:
    h = hashlib.sha256()
    with path.open("rb") as f:
        for chunk in iter(lambda: f.read(1024 * 1024), b""):
            h.update(chunk)
    return h.hexdigest()


def download(url: str, dest: Path, headers: dict[str, str] | None = None, timeout: int = 120) -> tuple[bool, str]:
    """Download url to dest. Returns (ok, message). Never raises on HTTP/network errors."""
    req_headers = {"User-Agent": USER_AGENT}
    if headers:
        req_headers.update(headers)
    req = urllib.request.Request(url, headers=req_headers)
    dest.parent.mkdir(parents=True, exist_ok=True)
    tmp = dest.with_suffix(dest.suffix + ".part")
    try:
        with urllib.request.urlopen(req, timeout=timeout) as resp, open(tmp, "wb") as out:
            total = resp.headers.get("Content-Length")
            total = int(total) if total else None
            downloaded = 0
            last_report = time.time()
            while True:
                chunk = resp.read(1024 * 256)
                if not chunk:
                    break
                out.write(chunk)
                downloaded += len(chunk)
                if time.time() - last_report > 5:
                    pct = f"{downloaded/total*100:.1f}%" if total else f"{downloaded/1e6:.1f}MB"
                    print(f"    ... {dest.name}: {pct}", flush=True)
                    last_report = time.time()
        tmp.replace(dest)
        return True, f"downloaded {downloaded} bytes"
    except urllib.error.HTTPError as e:
        tmp.unlink(missing_ok=True)
        return False, f"HTTP {e.code} {e.reason}"
    except (urllib.error.URLError, TimeoutError, OSError) as e:
        tmp.unlink(missing_ok=True)
        return False, f"network error: {e}"


def write_metadata(dataset_dir: Path, entry: dict) -> None:
    meta_path = dataset_dir / "metadata.json"
    existing = []
    if meta_path.exists():
        try:
            existing = json.loads(meta_path.read_text(encoding="utf-8"))
            if not isinstance(existing, list):
                existing = [existing]
        except json.JSONDecodeError:
            existing = []
    existing = [e for e in existing if e.get("file") != entry.get("file")]
    existing.append(entry)
    meta_path.write_text(json.dumps(existing, indent=2), encoding="utf-8")


def now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


# ---------------------------------------------------------------------------
# Enron
# ---------------------------------------------------------------------------

def fetch_enron() -> None:
    print("[enron] CMU Enron Email Dataset")
    url = "https://www.cs.cmu.edu/~enron/enron_mail_20150507.tar.gz"
    dest_dir = DATA_RAW / "enron"
    dest = dest_dir / "enron_mail_20150507.tar.gz"
    if dest.exists():
        print(f"    already present: {dest} ({dest.stat().st_size} bytes) — skipping re-download")
        return
    ok, msg = download(url, dest)
    if not ok:
        print(f"    FAILED: {msg}")
        write_metadata(dest_dir, {
            "file": dest.name, "source_url": url, "status": "download_failed",
            "error": msg, "attempted_at": now_iso(),
        })
        return
    checksum = sha256_of(dest)
    print(f"    ok: {msg}, sha256={checksum}")
    write_metadata(dest_dir, {
        "file": dest.name,
        "source_url": url,
        "download_date": now_iso(),
        "sha256": checksum,
        "size_bytes": dest.stat().st_size,
        "license": "Released into the public record via FERC/CALO project; widely used for research. "
                   "NOT a malicious-email ground truth — legitimate corporate correspondence only.",
        "status": "ok",
    })


# ---------------------------------------------------------------------------
# SpamAssassin
# ---------------------------------------------------------------------------

SPAMASSASSIN_FILES = [
    "20021010_easy_ham.tar.bz2",
    "20021010_hard_ham.tar.bz2",
    "20021010_spam.tar.bz2",
    "20030228_easy_ham.tar.bz2",
    "20030228_easy_ham_2.tar.bz2",
    "20030228_hard_ham.tar.bz2",
    "20030228_spam.tar.bz2",
    "20030228_spam_2.tar.bz2",
    "20050311_spam_2.tar.bz2",
]


def fetch_spamassassin() -> None:
    print("[spamassassin] Apache SpamAssassin public corpus")
    base = "https://spamassassin.apache.org/old/publiccorpus/"
    dest_dir = DATA_RAW / "spamassassin"
    for fname in SPAMASSASSIN_FILES:
        dest = dest_dir / fname
        url = base + fname
        if dest.exists():
            print(f"    already present: {fname} — skipping")
            continue
        ok, msg = download(url, dest)
        if not ok:
            print(f"    FAILED {fname}: {msg}")
            write_metadata(dest_dir, {
                "file": fname, "source_url": url, "status": "download_failed",
                "error": msg, "attempted_at": now_iso(),
            })
            continue
        checksum = sha256_of(dest)
        print(f"    ok: {fname} ({dest.stat().st_size} bytes)")
        write_metadata(dest_dir, {
            "file": fname,
            "source_url": url,
            "download_date": now_iso(),
            "sha256": checksum,
            "size_bytes": dest.stat().st_size,
            "license": "Apache SpamAssassin public corpus — free for research use per corpus README "
                       "(spam messages are real but sender-anonymized where noted upstream).",
            "status": "ok",
        })


# ---------------------------------------------------------------------------
# UCI Phishing Websites (already present under ml/data/ from an earlier phase)
# ---------------------------------------------------------------------------

def fetch_uci_phishing() -> None:
    print("[uci_phishing] UCI Phishing Websites dataset")
    dest_dir = DATA_RAW / "uci_phishing"
    existing = REPO_ROOT / "ml" / "data" / "Training Dataset.arff"
    dest = dest_dir / "Training Dataset.arff"
    if existing.exists():
        dest_dir.mkdir(parents=True, exist_ok=True)
        if not dest.exists():
            shutil.copy2(existing, dest)
        checksum = sha256_of(dest)
        print(f"    reused already-downloaded copy from ml/data/ (sha256={checksum})")
        write_metadata(dest_dir, {
            "file": dest.name,
            "source_url": "https://archive.ics.uci.edu/dataset/327/phishing",
            "download_date": now_iso(),
            "sha256": checksum,
            "size_bytes": dest.stat().st_size,
            "license": "UCI Machine Learning Repository — free for research/education use.",
            "status": "ok",
            "note": "Acquired in an earlier build phase (NetraX URL-phishing model); "
                    "referenced here rather than re-downloaded.",
        })
        return
    # Fallback: attempt a live download if the earlier copy is missing.
    url = "https://archive.ics.uci.edu/static/public/327/phishing+websites.zip"
    dest_zip = dest_dir / "phishing_websites.zip"
    ok, msg = download(url, dest_zip)
    if not ok:
        print(f"    FAILED: {msg}")
        write_metadata(dest_dir, {
            "file": dest_zip.name, "source_url": url, "status": "download_failed",
            "error": msg, "attempted_at": now_iso(),
        })
        return
    checksum = sha256_of(dest_zip)
    write_metadata(dest_dir, {
        "file": dest_zip.name, "source_url": url, "download_date": now_iso(),
        "sha256": checksum, "size_bytes": dest_zip.stat().st_size,
        "license": "UCI Machine Learning Repository — free for research/education use.",
        "status": "ok",
    })


# ---------------------------------------------------------------------------
# URLhaus (public CSV snapshot — no API key required for read-only downloads)
# ---------------------------------------------------------------------------

def fetch_urlhaus() -> None:
    print("[urlhaus] abuse.ch URLhaus recent malicious URL feed")
    url = "https://urlhaus.abuse.ch/downloads/csv_recent/"
    dest_dir = DATA_RAW / "urlhaus"
    stamp = datetime.now(timezone.utc).strftime("%Y%m%d")
    dest = dest_dir / f"urlhaus_csv_recent_{stamp}.csv"
    ok, msg = download(url, dest)
    if not ok:
        print(f"    FAILED: {msg}")
        write_metadata(dest_dir, {
            "file": dest.name, "source_url": url, "status": "download_failed",
            "error": msg, "attempted_at": now_iso(),
        })
        return
    checksum = sha256_of(dest)
    print(f"    ok: {msg}, sha256={checksum}")
    write_metadata(dest_dir, {
        "file": dest.name,
        "source_url": url,
        "download_date": now_iso(),
        "sha256": checksum,
        "size_bytes": dest.stat().st_size,
        "license": "abuse.ch URLhaus — free for non-commercial use per abuse.ch terms; "
                   "this is a point-in-time SNAPSHOT of the last-30-days feed, not exhaustive live "
                   "intelligence. The live ThreatIntelProvider adapter (Phase 6) queries the API "
                   "directly for current data at investigation time.",
        "status": "ok",
        "note": "No API key required for this static bulk CSV download. Correction "
                "(verified 2026-09-06): the live query API (single-URL/host lookups) DOES "
                "require URLHAUS_AUTH_KEY as of abuse.ch's current policy — an earlier "
                "version of this note incorrectly said lookups were also key-free.",
    })


# ---------------------------------------------------------------------------
# PhishTank (requires a registered app_key; heavily rate-limited/blocked without one)
# ---------------------------------------------------------------------------

def fetch_phishtank() -> None:
    print("[phishtank] PhishTank verified phishing feed")
    dest_dir = DATA_RAW / "phishtank"
    app_key = ENV.get("PHISHTANK_APP_KEY")
    if not app_key:
        print("    SKIPPED: PHISHTANK_APP_KEY not set. Register at https://phishtank.org/ "
              "and add PHISHTANK_APP_KEY to your .env to enable this download.")
        write_metadata(dest_dir, {
            "file": "online-valid.csv",
            "source_url": "https://data.phishtank.com/data/<app_key>/online-valid.csv",
            "status": "unavailable_missing_credentials",
            "attempted_at": now_iso(),
            "note": "PhishTank throttles/blocks unauthenticated bulk downloads (HTTP 429 observed "
                    "without a key). Live single-URL lookups may still work via the public checkurl "
                    "API and are handled by the ThreatIntelProvider adapter in Phase 6 regardless.",
        })
        return
    url = f"https://data.phishtank.com/data/{app_key}/online-valid.csv"
    dest = dest_dir / "online-valid.csv"
    ok, msg = download(url, dest)
    if not ok:
        print(f"    FAILED: {msg}")
        write_metadata(dest_dir, {
            "file": dest.name, "source_url": "https://data.phishtank.com/data/<app_key>/online-valid.csv",
            "status": "download_failed", "error": msg, "attempted_at": now_iso(),
        })
        return
    checksum = sha256_of(dest)
    write_metadata(dest_dir, {
        "file": dest.name,
        "source_url": "https://data.phishtank.com/data/<app_key>/online-valid.csv",
        "download_date": now_iso(), "sha256": checksum, "size_bytes": dest.stat().st_size,
        "license": "PhishTank data is free for research use per PhishTank terms of use "
                   "(attribution required).",
        "status": "ok",
    })


# ---------------------------------------------------------------------------
# MaxMind GeoLite2 (requires a MaxMind account + license key)
# ---------------------------------------------------------------------------

def fetch_geolite() -> None:
    print("[geolite] MaxMind GeoLite2 City + ASN")
    dest_dir = DATA_RAW / "geolite"
    account_id = ENV.get("MAXMIND_ACCOUNT_ID")
    license_key = ENV.get("MAXMIND_LICENSE_KEY")
    if not account_id or not license_key:
        print("    SKIPPED: MAXMIND_ACCOUNT_ID / MAXMIND_LICENSE_KEY not set. Register a free "
              "account at https://www.maxmind.com/en/geolite2/signup and add both to your .env.")
        write_metadata(dest_dir, {
            "file": "GeoLite2-City.mmdb",
            "source_url": "https://download.maxmind.com/geoip/databases/GeoLite2-City/download?suffix=tar.gz",
            "status": "unavailable_missing_credentials",
            "attempted_at": now_iso(),
        })
        write_metadata(dest_dir, {
            "file": "GeoLite2-ASN.mmdb",
            "source_url": "https://download.maxmind.com/geoip/databases/GeoLite2-ASN/download?suffix=tar.gz",
            "status": "unavailable_missing_credentials",
            "attempted_at": now_iso(),
        })
        return
    import base64
    auth_header = {"Authorization": "Basic " + base64.b64encode(f"{account_id}:{license_key}".encode()).decode()}
    for edition in ("GeoLite2-City", "GeoLite2-ASN"):
        url = f"https://download.maxmind.com/geoip/databases/{edition}/download?suffix=tar.gz"
        dest = dest_dir / f"{edition}.tar.gz"
        ok, msg = download(url, dest, headers=auth_header)
        if not ok:
            print(f"    FAILED {edition}: {msg}")
            write_metadata(dest_dir, {
                "file": dest.name, "source_url": url, "status": "download_failed",
                "error": msg, "attempted_at": now_iso(),
            })
            continue
        checksum = sha256_of(dest)
        write_metadata(dest_dir, {
            "file": dest.name, "source_url": url, "download_date": now_iso(),
            "sha256": checksum, "size_bytes": dest.stat().st_size,
            "license": "MaxMind GeoLite2 End User License Agreement — free tier, attribution required, "
                       "redistribution restricted.",
            "status": "ok",
        })


DATASETS = {
    "enron": fetch_enron,
    "spamassassin": fetch_spamassassin,
    "uci_phishing": fetch_uci_phishing,
    "urlhaus": fetch_urlhaus,
    "phishtank": fetch_phishtank,
    "geolite": fetch_geolite,
}


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--dataset", choices=list(DATASETS) + ["all"], default="all")
    args = parser.parse_args()

    targets = list(DATASETS) if args.dataset == "all" else [args.dataset]
    print(f"Downloading: {', '.join(targets)}\n")
    for name in targets:
        DATASETS[name]()
        print()
    print("Done. See metadata.json in each data/raw/<dataset>/ folder for provenance details.")


if __name__ == "__main__":
    sys.exit(main())
