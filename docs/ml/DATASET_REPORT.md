# Dataset Report

All values below were calculated directly from the files in `ml/data/` (see
`ml/src/data_loader.py`), not assumed or estimated. Generated as part of the
NetraX ML pipeline build.

> **Note on naming**: this document/pipeline was built under the "DhokhaDetect AI"
> working title used during ML integration; the live application repo is
> named **NetraX**. Both names refer to the same project.

---

## 1. SMS Spam / Fraud Dataset

| Field | Value |
|---|---|
| Dataset name | UCI SMS Spam Collection v.1 |
| File name | `ml/data/SMSSpamCollection` |
| File type | Plain text, tab-separated, no header |
| Rows | 5,574 |
| Columns | 2 |
| Column names | `label`, `message` |
| Target/label column | `label` (binary: `ham` / `spam`) |
| Class distribution | ham: 4,827 (86.60%) · spam: 747 (13.40%) |
| Missing values | 0 |
| Duplicate rows | **403** exact duplicates (identical label+message) |
| Data types | both columns: string |
| Message length | min 2, max 910, mean 80.5 characters |

**Data-loading gotcha found and fixed**: reading this file with pandas'
default CSV quoting rules silently merges some row pairs (5,574 → 5,572),
because several SMS messages contain unbalanced `"` characters that pandas
interprets as opening a multi-line quoted field. `data_loader.load_sms()`
uses `quoting=csv.QUOTE_NONE` to load the correct 5,574 rows.

**Potential data leakage**: the 403 exact duplicate rows must be removed
*before* the train/test split — otherwise an identical message could appear
in both splits, inflating test performance. Handled in `train_sms.py`.

**Potential irrelevant features**: none — only 2 columns, both required.
No PII beyond what's inherent to a public SMS spam research corpus.

---

## 2. Phishing URL Dataset

Two files exist in `ml/data/`; both were inspected.

### 2a. `ml/data/Training Dataset.arff` — used as the primary dataset

| Field | Value |
|---|---|
| Dataset name | UCI Phishing Websites Data Set (Mohammad, Thabtani & McCluskey) |
| File type | ARFF (Weka), 31 attributes declared |
| Rows | 11,055 |
| Columns | 31 (30 features + 1 target) |
| Column names | `having_IP_Address`, `URL_Length`, `Shortining_Service`, `having_At_Symbol`, `double_slash_redirecting`, `Prefix_Suffix`, `having_Sub_Domain`, `SSLfinal_State`, `Domain_registeration_length`, `Favicon`, `port`, `HTTPS_token`, `Request_URL`, `URL_of_Anchor`, `Links_in_tags`, `SFH`, `Submitting_to_email`, `Abnormal_URL`, `Redirect`, `on_mouseover`, `RightClick`, `popUpWidnow`, `Iframe`, `age_of_domain`, `DNSRecord`, `web_traffic`, `Page_Rank`, `Google_Index`, `Links_pointing_to_page`, `Statistical_report`, `Result` |
| Target/label column | `Result` (`1` = legitimate, `-1` = phishing) |
| Class distribution | legitimate: 6,157 (55.69%) · phishing: 4,898 (44.31%) |
| Missing values | 0 |
| Duplicate rows | **5,206 of 11,055 (47.08%)** — see leakage note below |
| Data types | all 31 columns: small-integer categorical, values in `{-1, 0, 1}` |

Corroborated by `ml/data/Phishing Websites Features.docx`, which is the
dataset authors' own feature-definition document — its rule descriptions
(IP-address URLs, `@` symbols, `//` redirects, prefix/suffix dashes, SSL
state, domain age, etc.) match the 30 feature names exactly.

**Potential data leakage**: 47% of rows are exact duplicates — a known
characteristic of this dataset's coarse categorical feature space (many
distinct real websites collapse to the same feature vector). This is a real
leakage risk if not handled: a naive random split could place identical
feature rows in both train and test, inflating test metrics. `train_url.py`
drops exact duplicates before splitting.

**Potential irrelevant features**: none identified — all 30 are purpose-built
per the published feature-engineering paper, not incidental columns.

### 2b. `ml/data/.old.arff` — present but NOT used for training

| Field | Value |
|---|---|
| Rows | 2,456 |
| Columns | 31 (same schema as above) |
| Target distribution | phishing: 1,362 (55.46%) · legitimate: 1,094 (44.54%) |
| Duplicate rows | 740 of 2,456 (30.13%) |

Same 30 feature names as the primary file, but a different value-encoding
convention on several columns (e.g. `{0,1}` instead of `{-1,1}`) and a
`@relation test` header rather than `@relation phishing`. The filename and
smaller size strongly indicate this is the dataset authors' earlier
(~2012) version, superseded by the 11,055-row file. **Not deleted, not used**
— kept as-is per instructions not to remove existing data.

---

## 3. Transaction Fraud Dataset

| Field | Value |
|---|---|
| Dataset name | Credit Card Fraud Detection (Kaggle / Université Libre de Bruxelles) |
| File name | `ml/data/creditcard.csv` |
| File type | CSV, header row, **150.8 MB** |
| Rows | 284,807 |
| Columns | 31 |
| Column names | `Time`, `V1`–`V28` (PCA-anonymized), `Amount`, `Class` |
| Target/label column | `Class` (`0` = legitimate, `1` = fraud) |
| Class distribution | legitimate: 284,315 (99.827%) · fraud: 492 (**0.173%**) |
| Missing values | 0 |
| Duplicate rows | 1,081 (0.38%) |
| Data types | `Class`: int64 · all other 30 columns: float64 |
| `Amount` range | ₹0.00 – ₹25,691.16 (mean ₹88.35) |
| `Time` range | 0 – 172,792 seconds (≈ 48 hours of transactions) |
| Negative amounts / infinities | none |

**Potential data leakage**: 1,081 duplicate rows exist; dropped before
splitting in `train_transaction.py` for the same reason as above. `V1`–`V28`
are already PCA-transformed by the dataset's original publishers — this is
a fixed, given transformation (not something this pipeline can refit), so it
is not leakage in the traditional sense, but it does mean per-feature
interpretability is limited to the anonymized component number.

**Potential irrelevant features**: none removable — `V1`–`V28` are opaque PCA
components, `Amount` and `Time` are both plausibly informative (large/odd-hour
transactions are a classic anomaly signal) and are used as-is.

**Class imbalance**: at 0.173% positive rate, accuracy is not a meaningful
metric (predicting "always legitimate" scores 99.83% while catching zero
fraud) — see `docs/ml/MODEL_SELECTION.md` for how this is handled.

**Not committed to GitHub**: `creditcard.csv` is 150.8 MB, over GitHub's
100 MB hard file-size limit, and is already excluded via `.gitignore`
(`ml/data/*.csv`). To reproduce training, download it yourself from Kaggle
("Credit Card Fraud Detection", ULB Machine Learning Group) and place it at
`ml/data/creditcard.csv`.
