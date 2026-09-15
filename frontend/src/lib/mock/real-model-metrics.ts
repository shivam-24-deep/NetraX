/**
 * Real, measured metrics from ml/models/model_metadata.json — a snapshot
 * taken at the last local training run (see trainedAt per model). Not
 * fabricated: every number here traces back to a real `ml/train.py` run
 * evaluated once on an untouched test set. If the local ML API
 * (ml/api/server.py) is running, GET /models returns this same data live;
 * this file is the offline fallback so the page still shows real numbers
 * without the API running.
 *
 * Regenerate by re-running `ml/train.py` and copying the relevant fields
 * from ml/models/model_metadata.json.
 */

export interface ConfusionMatrix {
  truePositive: number
  falseNegative: number
  falsePositive: number
  trueNegative: number
  positiveLabel: string
  negativeLabel: string
}

export interface CandidateResult {
  name: string
  f1: number
  rocAuc: number
  prAuc?: number
}

export interface RealModelMetrics {
  key: "email" | "sms" | "url" | "transaction"
  displayName: string
  dataset: string
  datasetFile: string
  algorithm: string
  version: string
  trainedAt: string
  trainRows: number
  testRows: number
  headlineMetric: "f1" | "prAuc"
  metrics: { accuracy: number; precision: number; recall: number; f1: number; rocAuc: number; prAuc: number }
  confusionMatrix: ConfusionMatrix
  featureImportance: { feature: string; importance: number }[]
  threshold: { default: number; selected: number }
  candidatesCompared: CandidateResult[]
  selectionCriterion: string
}

export const realModelMetrics: RealModelMetrics[] = [
  {
    key: "email",
    displayName: "Email Content Classifier",
    dataset: "Apache SpamAssassin Public Corpus",
    datasetFile: "data/raw/spamassassin/*.tar.bz2",
    algorithm: "Linear SVM",
    version: "v1",
    trainedAt: "2026-09-06T18:13:36Z",
    trainRows: 4773,
    testRows: 1194,
    headlineMetric: "f1",
    metrics: { accuracy: 0.9782, precision: 0.9611, recall: 0.9611, f1: 0.9611, rocAuc: 0.9981, prAuc: 0.9953 },
    confusionMatrix: { trueNegative: 847, falsePositive: 13, falseNegative: 13, truePositive: 321, negativeLabel: "ham", positiveLabel: "spam/phishing" },
    featureImportance: [
      { feature: "remove", importance: 1.5357 },
      { feature: "spamassassin talk", importance: 1.5273 },
      { feature: "2002", importance: 1.4602 },
      { feature: "free", importance: 1.3743 },
      { feature: "you", importance: 1.3609 },
      { feature: "the", importance: 1.3595 },
      { feature: "spamassassin sightings", importance: 1.3098 },
      { feature: "wrote", importance: 1.3047 },
      { feature: "sightings", importance: 1.2927 },
      { feature: "your", importance: 1.2745 },
    ],
    threshold: { default: 0.5, selected: 0.33 },
    selectionCriterion: "Highest mean 5-fold CV F1 on training set, tie-break on recall",
    candidatesCompared: [
      { name: "Logistic Regression", f1: 0.96, rocAuc: 0.9969 },
      { name: "Linear SVM", f1: 0.9688, rocAuc: 0.9981 },
      { name: "Multinomial Naive Bayes", f1: 0.951, rocAuc: 0.9949 },
      { name: "Random Forest", f1: 0.9552, rocAuc: 0.9962 },
    ],
  },
  {
    key: "sms",
    displayName: "SMS Fraud/Spam Classifier",
    dataset: "UCI SMS Spam Collection",
    datasetFile: "ml/data/SMSSpamCollection",
    algorithm: "Linear SVM",
    version: "v1",
    trainedAt: "2026-09-04T09:16:15Z",
    trainRows: 4136,
    testRows: 1035,
    headlineMetric: "f1",
    metrics: { accuracy: 0.9845, precision: 0.9675, recall: 0.9084, f1: 0.937, rocAuc: 0.99, prAuc: 0.9686 },
    confusionMatrix: { trueNegative: 900, falsePositive: 4, falseNegative: 12, truePositive: 119, negativeLabel: "ham", positiveLabel: "spam" },
    featureImportance: [
      { feature: "txt", importance: 2.2584 },
      { feature: "call", importance: 2.0042 },
      { feature: "text", importance: 1.8767 },
      { feature: "www", importance: 1.479 },
      { feature: "150p", importance: 1.3963 },
      { feature: "com", importance: 1.3369 },
      { feature: "arsenal", importance: 1.3324 },
      { feature: "chat", importance: 1.3319 },
      { feature: "free", importance: 1.3311 },
      { feature: "uk", importance: 1.3305 },
    ],
    threshold: { default: 0.5, selected: 0.43 },
    selectionCriterion: "Highest mean 5-fold CV F1 on training set, tie-break on recall",
    candidatesCompared: [
      { name: "Logistic Regression", f1: 0.9354, rocAuc: 0.9913 },
      { name: "Linear SVM", f1: 0.9479, rocAuc: 0.9918 },
      { name: "Multinomial Naive Bayes", f1: 0.8412, rocAuc: 0.9813 },
      { name: "Random Forest", f1: 0.8797, rocAuc: 0.9896 },
    ],
  },
  {
    key: "url",
    displayName: "Phishing URL Classifier",
    dataset: "UCI Phishing Websites Data Set",
    datasetFile: "ml/data/Training Dataset.arff",
    algorithm: "HistGradientBoosting",
    version: "v1",
    trainedAt: "2026-09-04T09:16:31Z",
    trainRows: 4679,
    testRows: 1170,
    headlineMetric: "f1",
    metrics: { accuracy: 0.953, precision: 0.9598, recall: 0.9487, f1: 0.9542, rocAuc: 0.9928, prAuc: 0.9936 },
    confusionMatrix: { trueNegative: 542, falsePositive: 24, falseNegative: 31, truePositive: 573, negativeLabel: "legitimate", positiveLabel: "phishing" },
    featureImportance: [
      { feature: "URL_of_Anchor", importance: 0.1396 },
      { feature: "SSLfinal_State", importance: 0.1132 },
      { feature: "Prefix_Suffix", importance: 0.0254 },
      { feature: "web_traffic", importance: 0.0216 },
      { feature: "Links_in_tags", importance: 0.0151 },
      { feature: "having_IP_Address", importance: 0.0144 },
      { feature: "SFH", importance: 0.0134 },
      { feature: "Links_pointing_to_page", importance: 0.0131 },
      { feature: "having_Sub_Domain", importance: 0.0129 },
      { feature: "URL_Length", importance: 0.0074 },
    ],
    threshold: { default: 0.5, selected: 0.45 },
    selectionCriterion: "Highest mean 5-fold CV F1 on training set, tie-break on ROC-AUC",
    candidatesCompared: [
      { name: "Logistic Regression", f1: 0.9225, rocAuc: 0.9753 },
      { name: "Random Forest", f1: 0.9504, rocAuc: 0.9883 },
      { name: "HistGradientBoosting", f1: 0.9522, rocAuc: 0.992 },
      { name: "XGBoost", f1: 0.949, rocAuc: 0.9915 },
    ],
  },
  {
    key: "transaction",
    displayName: "Transaction Fraud Detector",
    dataset: "Credit Card Fraud Detection (Kaggle / ULB)",
    datasetFile: "ml/data/creditcard.csv",
    algorithm: "Random Forest",
    version: "v1",
    trainedAt: "2026-09-04T09:31:23Z",
    trainRows: 226980,
    testRows: 56746,
    headlineMetric: "prAuc",
    metrics: { accuracy: 0.9995, precision: 0.9467, recall: 0.7474, f1: 0.8353, rocAuc: 0.9491, prAuc: 0.8094 },
    confusionMatrix: { trueNegative: 56647, falsePositive: 4, falseNegative: 24, truePositive: 71, negativeLabel: "legitimate", positiveLabel: "fraud" },
    featureImportance: [
      { feature: "V14", importance: 0.1634 },
      { feature: "V10", importance: 0.1286 },
      { feature: "V12", importance: 0.1099 },
      { feature: "V4", importance: 0.1064 },
      { feature: "V17", importance: 0.0873 },
      { feature: "V11", importance: 0.0612 },
      { feature: "V16", importance: 0.0578 },
      { feature: "V3", importance: 0.051 },
      { feature: "V2", importance: 0.0265 },
      { feature: "V7", importance: 0.0255 },
    ],
    threshold: { default: 0.5, selected: 0.26 },
    selectionCriterion: "Highest mean 5-fold CV PR-AUC on training set, tie-break on F1 — not accuracy, which is meaningless at a 0.17% fraud rate",
    candidatesCompared: [
      { name: "Logistic Regression", f1: 0.1135, rocAuc: 0.9814, prAuc: 0.7538 },
      { name: "Random Forest", f1: 0.8322, rocAuc: 0.9575, prAuc: 0.8376 },
      { name: "HistGradientBoosting", f1: 0.4928, rocAuc: 0.6403, prAuc: 0.4766 },
    ],
  },
]
