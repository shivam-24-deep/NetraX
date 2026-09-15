import { test } from "node:test";
import assert from "node:assert/strict";
import { levenshteinDistance } from "./levenshtein.ts";

test("identical strings have distance 0", () => {
  assert.equal(levenshteinDistance("paypal.com", "paypal.com"), 0);
});

test("single substitution has distance 1", () => {
  assert.equal(levenshteinDistance("paypal.com", "paypa1.com"), 1);
});

test("known distance for classic example", () => {
  assert.equal(levenshteinDistance("kitten", "sitting"), 3);
});

test("empty string distance equals other string length", () => {
  assert.equal(levenshteinDistance("", "abc"), 3);
  assert.equal(levenshteinDistance("abc", ""), 3);
});
