# Data Sources

All datasets and threat-intelligence feeds used by NetraX / FraudShield AI
(SIH26106) come from official, documented sources — never Kaggle mirrors,
GitHub reuploads, or unknown third parties. This document records what each
source is, why it's used, what it can and can't prove, and its licensing
terms. Acquisition mechanics and directory layout are in
[`data/README.md`](../data/README.md); actual download provenance
(checksums, dates) lives in each dataset's `data/raw/<name>/metadata.json`.

## 1. CMU Enron Email Dataset

- **Official source**: https://www.cs.cmu.edu/~enron/
- **File**: `enron_mail_20150507.tar.gz` (~443 MB compressed)
- **Acquired**: 2026-09-06, via `scripts/data/download_datasets.py --dataset enron`
- **License**: released as part of the public record from the FERC
  investigation; the CALO project curated it for research. Widely used in
  academic NLP/email research.
- **Use in this project**: a large corpus of *real, structurally normal*
  corporate email — sender/recipient relationships, header formats, and
  everyday business language. Used to build a legitimate-email baseline for
  the header-forensics engine and language-model features, and as a source
  of realistic test fixtures for the email parser.
- **What it is NOT**: a labeled malicious-email dataset. Every message in
  this corpus is ordinary corporate correspondence, not verified phishing or
  fraud. **Do not label Enron messages as "benign" ground truth for a
  classifier** — treat it purely as normal-language/structure reference and
  parser test material, consistent with Rule 6 of the project's engineering
  rules.

## 2. Apache SpamAssassin Public Corpus

- **Official source**: https://spamassassin.apache.org/old/publiccorpus/
- **Files** (9 archives, ~13 MB total): `20021010_easy_ham.tar.bz2`,
  `20021010_hard_ham.tar.bz2`, `20021010_spam.tar.bz2`,
  `20030228_easy_ham.tar.bz2`, `20030228_easy_ham_2.tar.bz2`,
  `20030228_hard_ham.tar.bz2`, `20030228_spam.tar.bz2`,
  `20030228_spam_2.tar.bz2`, `20050311_spam_2.tar.bz2`
- **Acquired**: 2026-09-06
- **License**: Apache Software Foundation public corpus, distributed for
  spam-filter research; free to use for that purpose.
- **Use in this project**: real spam and (separately labeled) legitimate
  ("ham") email, including full headers — the primary labeled dataset for
  training the email/spam classifier baseline (Phase 8–9) and for testing
  header-forensics rules (SPF/DKIM/DMARC presence varies realistically
  across these messages since they predate widespread DMARC adoption, which
  is itself a useful edge case).
- **Caveats**: the corpus is from 2002–2005; email authentication headers
  (SPF/DKIM/DMARC) are largely absent since those standards weren't yet
  widespread, and some spam tactics have evolved since. Treated as a spam/
  ham *language and structure* baseline, not a source of current phishing
  infrastructure indicators.

## 3. UCI Phishing Websites Dataset

- **Official source**: https://archive.ics.uci.edu/dataset/327/phishing
- **File**: `Training Dataset.arff`
- **Acquired**: previously downloaded during NetraX's URL-phishing model
  build; referenced (not re-downloaded) into `data/raw/uci_phishing/` by the
  acquisition script.
- **License**: UCI Machine Learning Repository — free for research/education.
- **Use in this project**: pre-extracted URL/webpage phishing features and
  labels; trains the phishing-URL classifier (Phase 5). NetraX's existing
  `ml/models/url_pipeline.joblib` was already trained on this dataset and is
  reused as the SIH26106 URL-analysis model, extended with the additional
  URL features (punycode, homoglyph, brand-similarity, shortener detection)
  the SIH26106 spec calls for.

## 4. PhishTank

- **Official source**: https://phishtank.org/ (developer info:
  `/developer_info.php`)
- **Access**: requires free registration for an `app_key`. Verified without
  one: unauthenticated bulk CSV downloads are rate-limited/blocked
  (observed `HTTP 429` from `data.phishtank.com` during acquisition).
- **Env var**: `PHISHTANK_APP_KEY` (see `.env.example`)
- **Use in this project**: live phishing-URL verification via the
  `PhishTankProvider` threat-intelligence adapter (Phase 6). Until a key is
  supplied, the adapter reports **"Threat intelligence unavailable"** — it
  never reports "safe" for an unmatched or unreachable lookup (Rule 5).
- **Status as of 2026-09-06**: unavailable — no key configured.

## 5. URLhaus (abuse.ch)

- **Official source**: https://urlhaus.abuse.ch/ (API docs:
  https://urlhaus.abuse.ch/api/)
- **Access**: the static bulk CSV/JSON *downloads* (`/downloads/csv_recent/`,
  etc.) work without a key — verified in Phase 1. **Correction, verified
  2026-09-06**: the interactive *query* API (`urlhaus-api.abuse.ch/v1/url/`,
  `/v1/host/`), which a live single-indicator lookup adapter actually needs,
  now returns `{"error": "Unauthorized"}` without a key — abuse.ch changed
  this policy at some point after the "no key needed for lookups" claim was
  originally written; that claim was accurate for bulk downloads only, never
  re-verified against the live query endpoint until now. An `Auth-Key`
  (`URLHAUS_AUTH_KEY`) is required for query-API lookups; get one free at
  https://auth.abuse.ch/.
- **Acquired**: 2026-09-06 — a snapshot of the public `csv_recent` feed
  (last 30 days of malicious URLs) saved to
  `data/raw/urlhaus/urlhaus_csv_recent_<date>.csv` for offline testing.
- **Use in this project**: the `URLhausProvider` adapter (Phase 6) attempts
  a live query-API lookup when `URLHAUS_AUTH_KEY` is configured; without it,
  it reports "Threat intelligence unavailable" per Rule 5/Phase 24 rather
  than falling back to the static snapshot silently (a 2026-09-06 snapshot
  answering a query about today's email would be misleadingly stale). The
  saved CSV remains useful for offline testing and profiling only.
- **License**: free for non-commercial use per abuse.ch terms.

## 6. MaxMind GeoLite2

- **Official source**: https://dev.maxmind.com/geoip/geolite2-free-geolocation-data/
  (signup: https://www.maxmind.com/en/geolite2/signup)
- **Access**: requires a free MaxMind account (`MAXMIND_ACCOUNT_ID`) and
  license key (`MAXMIND_LICENSE_KEY`).
- **Use in this project**: IP → country/region/city/ASN/organization
  enrichment for infrastructure geolocation (Phase 7). Per Rule 4, results
  are always presented as **"approximate infrastructure geolocation"**,
  never an exact physical address or precise attacker location — GeoLite2
  itself is city-level-accurate at best and explicitly not suited for
  precise geolocation by MaxMind's own documentation.
- **Status as of 2026-09-06**: unavailable — no account/license key
  configured. Geolocation features degrade gracefully to "Geolocation
  unavailable" until supplied.

## Cross-cutting rules applied to every source

1. **No fabricated data.** A missing credential or failed request produces
   an explicit "unavailable" status in code and UI — never a substitute
   value.
2. **No mislabeling.** Enron is normal-email reference material, not a
   labeled negative class for any classifier (Rule 6).
3. **Live intel vs. static training data are kept separate** (Rule 7):
   PhishTank/URLhaus are queried live through adapters at investigation
   time; the CSV/ARFF files under `data/raw/` are for offline testing,
   profiling, and (for SpamAssassin/UCI Phishing) model training only.
4. **Checksums and provenance are recorded automatically** by
   `scripts/data/download_datasets.py` in each dataset's `metadata.json` —
   source URL, UTC download timestamp, SHA-256, file size, and license
   notes, so results are auditable and reproducible.
