import { test } from "node:test";
import assert from "node:assert/strict";
import {
  approxDecodedSize,
  decodeBase64ToText,
  decodeEncodedWords,
  decodeQuotedPrintable,
  parseHeaderBlock,
  parseHeaderParams,
  parseMime,
  splitHeadersAndBody,
  splitMultipart,
} from "./mime.ts";

test("splitHeadersAndBody separates on first blank line", () => {
  const { headerBlock, body, hadBlankLine } = splitHeadersAndBody("From: a@x.com\r\nSubject: Hi\r\n\r\nHello there");
  assert.equal(hadBlankLine, true);
  assert.match(headerBlock, /Subject: Hi$/);
  assert.equal(body, "Hello there");
});

test("splitHeadersAndBody reports no blank line when absent", () => {
  const { hadBlankLine } = splitHeadersAndBody("just some text\nwith no headers at all");
  assert.equal(hadBlankLine, false);
});

test("parseHeaderBlock unfolds continuation lines", () => {
  const headers = parseHeaderBlock("Subject: Hello\r\n World\r\nFrom: a@x.com");
  assert.equal(headers["subject"][0], "Hello World");
  assert.equal(headers["from"][0], "a@x.com");
});

test("parseHeaderBlock preserves repeated headers (e.g. Received)", () => {
  const headers = parseHeaderBlock("Received: hop1\r\nReceived: hop2\r\nSubject: X");
  assert.deepEqual(headers["received"], ["hop1", "hop2"]);
});

test("decodeEncodedWords decodes RFC 2047 base64 and Q-encoding", () => {
  assert.equal(decodeEncodedWords("=?UTF-8?B?SGVsbG8=?="), "Hello");
  assert.equal(decodeEncodedWords("=?UTF-8?Q?Hi=21_there?="), "Hi! there");
});

test("decodeBase64ToText round-trips UTF-8 text", () => {
  const b64 = Buffer.from("café", "utf-8").toString("base64");
  assert.equal(decodeBase64ToText(b64, "utf-8"), "café");
});

test("decodeQuotedPrintable handles soft line breaks and hex escapes", () => {
  assert.equal(decodeQuotedPrintable("Hi=21 caf=C3=A9"), "Hi! café");
  assert.equal(decodeQuotedPrintable("line one=\r\nline two"), "line oneline two");
});

test("parseHeaderParams extracts content-type primary and params", () => {
  const { primary, params } = parseHeaderParams('multipart/mixed; boundary="abc123"; charset=UTF-8');
  assert.equal(primary, "multipart/mixed");
  assert.equal(params.boundary, "abc123");
  assert.equal(params.charset, "UTF-8"); // param values preserve original case; charset case-normalization happens at decode time
});

test("parseHeaderParams respects quoted semicolons", () => {
  const { params } = parseHeaderParams('attachment; filename="a;b.txt"');
  assert.equal(params.filename, "a;b.txt");
});

test("splitMultipart isolates parts and drops preamble/epilogue", () => {
  const body = [
    "This is a preamble, ignore me.",
    "--BOUND",
    "Content-Type: text/plain",
    "",
    "part one",
    "--BOUND",
    "Content-Type: text/html",
    "",
    "<p>part two</p>",
    "--BOUND--",
    "epilogue text",
  ].join("\r\n");
  const parts = splitMultipart(body, "BOUND");
  assert.equal(parts.length, 2);
  assert.match(parts[0], /part one/);
  assert.match(parts[1], /part two/);
});

test("parseMime parses a simple single-part text/plain message", () => {
  const raw = "From: a@x.com\r\nSubject: Hi\r\nContent-Type: text/plain; charset=utf-8\r\n\r\nHello world";
  const node = parseMime(raw);
  assert.equal(node.contentType, "text/plain");
  assert.equal(node.body, "Hello world");
  assert.equal(node.children.length, 0);
});

test("parseMime parses multipart/alternative with base64 html part", () => {
  const htmlB64 = Buffer.from("<p>Hi</p>", "utf-8").toString("base64");
  const raw = [
    "From: a@x.com",
    'Content-Type: multipart/alternative; boundary="B"',
    "",
    "--B",
    "Content-Type: text/plain",
    "",
    "Hi",
    "--B",
    "Content-Type: text/html",
    "Content-Transfer-Encoding: base64",
    "",
    htmlB64,
    "--B--",
  ].join("\r\n");
  const node = parseMime(raw);
  assert.equal(node.children.length, 2);
  assert.equal(node.children[0].body, "Hi");
  assert.equal(node.children[1].body, "<p>Hi</p>");
});

test("approxDecodedSize estimates base64 payload size without corrupting binary", () => {
  const original = Buffer.from([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
  const b64 = original.toString("base64");
  const size = approxDecodedSize(b64, "base64");
  assert.equal(size, original.length);
});
