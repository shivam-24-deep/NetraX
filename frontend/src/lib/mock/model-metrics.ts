export const modelInfo = {
  name: "Random Forest",
  version: "v1.2",
  trainedOn: "SMS Spam Collection + Phishing Websites + Credit Card Fraud (UCI, demo subsets)",
  lastTrained: "2026-08-15",
}

export const modelMetrics = {
  accuracy: 0.93,
  precision: 0.9,
  recall: 0.87,
  f1: 0.88,
  rocAuc: 0.95,
}

export const confusionMatrix = {
  truePositive: 287,
  falseNegative: 43,
  falsePositive: 32,
  trueNegative: 638,
}

export const featureImportance = [
  { feature: "URL characteristics", importance: 0.24 },
  { feature: "Urgency language", importance: 0.21 },
  { feature: "Financial keywords", importance: 0.19 },
  { feature: "Transaction anomaly", importance: 0.17 },
  { feature: "Sender characteristics", importance: 0.12 },
  { feature: "Other", importance: 0.07 },
]
