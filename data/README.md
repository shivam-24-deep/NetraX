# Data directory

All datasets are acquired from official sources only, via a single
reproducible script:

```bash
python scripts/data/download_datasets.py            # everything
python scripts/data/download_datasets.py --dataset enron
python scripts/data/download_datasets.py --dataset spamassassin
python scripts/data/download_datasets.py --dataset uci_phishing
python scripts/data/download_datasets.py --dataset urlhaus
python scripts/data/download_datasets.py --dataset phishtank   # needs PHISHTANK_APP_KEY
python scripts/data/download_datasets.py --dataset geolite     # needs MAXMIND_ACCOUNT_ID + MAXMIND_LICENSE_KEY
```

Full source URLs, licensing notes, and usage guidance for each dataset are in
[`docs/DATA_SOURCES.md`](../docs/DATA_SOURCES.md). This file just documents
the directory layout.

## Layout

```
data/
  raw/            Exactly as downloaded, untouched. Gitignored — regenerate
                   with the script above, never hand-edit.
    enron/         CMU Enron Email Dataset (legitimate corporate email corpus)
    spamassassin/  Apache SpamAssassin public corpus (spam + ham)
    uci_phishing/  UCI Phishing Websites dataset (reused from ml/data/, where
                   it was already downloaded for NetraX's URL-phishing model)
    phishtank/     Verified phishing URL feed — requires PHISHTANK_APP_KEY
    urlhaus/       Malicious URL feed snapshot (no key needed for read access)
    geolite/       MaxMind GeoLite2 City + ASN databases — requires
                   MAXMIND_ACCOUNT_ID + MAXMIND_LICENSE_KEY
  processed/      Cleaned/normalized datasets produced by the data-prep phase
                   (not yet populated — Phase 3+). Gitignored.
  splits/         train/validation/test splits per model (not yet populated).
                   Gitignored.
  samples/        Small, committed excerpts for quick local testing without
                   needing the full raw download.
  demo/           Synthetic demo email cases (Phase 21), clearly labeled as
                   DEMO DATA, never presented as real threat intelligence.
```

Every populated `data/raw/<dataset>/` directory contains a `metadata.json`
recording, per file: source URL, download date (UTC), SHA-256 checksum, file
size, license/usage notes, and status (`ok`, `download_failed`, or
`unavailable_missing_credentials`). Nothing in this directory is ever
fabricated — a missing credential produces a `metadata.json` entry saying so,
never a substitute file.

## Credentialed sources

Three sources need free registration before the script can fetch real data.
Until credentials are supplied, the script (and the rest of the pipeline)
treats them as **unavailable**, never fakes a result:

| Source | Get credentials at | Env vars |
|---|---|---|
| PhishTank | https://phishtank.org/ | `PHISHTANK_APP_KEY` |
| MaxMind GeoLite2 | https://www.maxmind.com/en/geolite2/signup | `MAXMIND_ACCOUNT_ID`, `MAXMIND_LICENSE_KEY` |

(URLhaus needs no key for read-only downloads/lookups — `URLHAUS_AUTH_KEY` is
only for submitting new indicators, which this project never does.)

Add real values to `frontend/.env` (or export as real environment variables)
and re-run the relevant `--dataset` command.
