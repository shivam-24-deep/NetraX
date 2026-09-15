import { test } from "node:test";
import assert from "node:assert/strict";
import { parseEmail } from "./parser.ts";

function crlf(lines: string[]): string {
  return lines.join("\r\n");
}

test("parses a simple single-part eml with headers", () => {
  const raw = crlf([
    "From: Alice <alice@example.com>",
    "To: bob@example.com, carol@example.com",
    "Subject: Meeting notes",
    "Date: Mon, 1 Sep 2025 10:00:00 +0000",
    "Message-ID: <abc123@example.com>",
    "Content-Type: text/plain; charset=utf-8",
    "",
    "Hi team, see attached notes. Visit https://example.com/notes for details.",
  ]);
  const result = parseEmail(raw);
  assert.equal(result.format, "eml");
  assert.equal(result.headers.from, "Alice <alice@example.com>");
  assert.deepEqual(result.headers.to, ["bob@example.com", "carol@example.com"]);
  assert.equal(result.headers.subject, "Meeting notes");
  assert.equal(result.body.text, "Hi team, see attached notes. Visit https://example.com/notes for details.");
  assert.deepEqual(result.indicators.urls, ["https://example.com/notes"]);
  assert.deepEqual(result.indicators.domains, ["example.com"]);
});

test("reports headers as absent, never invents them", () => {
  const raw = crlf(["From: a@x.com", "Subject: No auth headers here", "", "Body text"]);
  const result = parseEmail(raw);
  assert.equal(result.headers.spf, undefined);
  assert.equal(result.headers.dkim, undefined);
  assert.equal(result.headers.dmarc, undefined);
  assert.equal(result.headers.returnPath, undefined);
});

test("extracts SPF/DKIM/DMARC results from Authentication-Results", () => {
  const raw = crlf([
    "From: a@x.com",
    "Authentication-Results: mx.google.com; spf=fail smtp.mailfrom=x.com; dkim=pass header.i=@x.com; dmarc=fail",
    "",
    "Body",
  ]);
  const result = parseEmail(raw);
  assert.equal(result.headers.spf, "fail");
  assert.equal(result.headers.dkim, "pass");
  assert.equal(result.headers.dmarc, "fail");
});

test("parses multipart/mixed with html body and a real attachment", () => {
  const attachmentContent = Buffer.from("PDF-BYTES-HERE", "utf-8").toString("base64");
  const raw = crlf([
    "From: a@x.com",
    "To: b@x.com",
    'Content-Type: multipart/mixed; boundary="OUTER"',
    "",
    "--OUTER",
    'Content-Type: multipart/alternative; boundary="INNER"',
    "",
    "--INNER",
    "Content-Type: text/plain",
    "",
    "Please verify your password immediately, urgent!",
    "--INNER",
    "Content-Type: text/html",
    "",
    "<p>Please <b>verify your password</b> immediately, urgent!</p>",
    "--INNER--",
    "--OUTER",
    'Content-Type: application/pdf; name="invoice.pdf"',
    "Content-Transfer-Encoding: base64",
    'Content-Disposition: attachment; filename="invoice.pdf"',
    "",
    attachmentContent,
    "--OUTER--",
  ]);
  const result = parseEmail(raw);
  assert.equal(result.body.text, "Please verify your password immediately, urgent!");
  assert.equal(result.indicators.attachments.length, 1);
  assert.equal(result.indicators.attachments[0].filename, "invoice.pdf");
  assert.equal(result.indicators.attachments[0].contentType, "application/pdf");
  assert.ok(result.indicators.attachments[0].sizeBytes! > 0);

  const categories = result.bodySignals.map((s) => s.category);
  assert.ok(categories.includes("urgency"));
  assert.ok(categories.includes("credential_request"));
});

test("falls back to plain text when no header block is detected", () => {
  const result = parseEmail("Just a pasted paragraph of suspicious text with no headers at all.");
  assert.equal(result.format, "text");
  assert.equal(result.warnings.length, 1);
  assert.equal(result.headers.from, undefined);
});

test("explicit text format hint skips auto-detection entirely", () => {
  const result = parseEmail("From: looks-like-a-header@example.com but treat as text", "text");
  assert.equal(result.format, "text");
  assert.equal(result.headers.from, undefined);
  assert.equal(result.body.text, "From: looks-like-a-header@example.com but treat as text");
});

test("json input with raw MIME delegates to eml parsing", () => {
  const raw = crlf(["From: a@x.com", "Subject: Hi", "", "Body text"]);
  const result = parseEmail({ raw });
  assert.equal(result.format, "eml");
  assert.equal(result.headers.subject, "Hi");
});

test("json input with structured fields builds headers/body directly", () => {
  const result = parseEmail({
    headers: { from: "a@x.com", to: ["b@x.com"], subject: "Wire transfer request", spf: "fail" },
    body: { text: "Please wire transfer the funds to this bitcoin address today." },
  });
  assert.equal(result.format, "json");
  assert.equal(result.headers.from, "a@x.com");
  assert.deepEqual(result.headers.to, ["b@x.com"]);
  assert.equal(result.headers.spf, "fail");
  assert.ok(result.bodySignals.some((s) => s.category === "financial"));
});

test("does not mis-extract an email address embedded in a URL query string", () => {
  const raw = crlf([
    "From: Sender <greatoffers@sendgreatoffers.com>",
    "To: jm@netnoteinc.com",
    "Content-Type: text/plain",
    "",
    "Manage your subscription: http://admanmail.com/subscription.asp?em=jm@netnoteinc.com&l=SGO",
  ]);
  const result = parseEmail(raw);
  assert.deepEqual(result.indicators.urls, ["http://admanmail.com/subscription.asp?em=jm@netnoteinc.com&l=SGO"]);
  // jm@netnoteinc.com is legitimately in the To: header, but must not appear with URL-path noise attached.
  assert.ok(result.indicators.emailAddresses.includes("jm@netnoteinc.com"));
  assert.ok(!result.indicators.emailAddresses.some((e) => e.includes("/") || e.includes("subscription")));
});

test("json input html-only body derives text via html-to-text", () => {
  const result = parseEmail({ body: { html: "<p>Hello <b>World</b></p>" } });
  assert.equal(result.body.htmlAsText, "Hello World");
});
