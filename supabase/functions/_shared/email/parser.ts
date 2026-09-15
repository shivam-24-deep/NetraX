// Phase 3 — Email Parser entry point.
//
// Accepts .eml/raw MIME, pasted plain-text email, or a structured JSON input,
// and produces a single normalized ParsedEmail. Never fetches a URL, never
// executes/decodes attachment content beyond metadata + approximate size.

import { approxDecodedSize, parseHeaderBlock, parseHeaderParams, parseMime, splitHeadersAndBody, type MimeNode } from "./mime.ts";
import { htmlToText } from "./html-to-text.ts";
import {
  extractBodySignals,
  extractCryptoAddresses,
  extractDomainsFromUrls,
  extractEmailAddresses,
  extractIpAddresses,
  extractPhoneNumbers,
  extractUrls,
} from "./indicators.ts";
import type {
  EmailAttachment,
  EmailBody,
  EmailHeaders,
  EmailIndicators,
  EmailInputFormat,
  EmailJsonInput,
  ParsedEmail,
} from "./types.ts";

export function parseEmail(input: string | EmailJsonInput, formatHint?: EmailInputFormat): ParsedEmail {
  if (typeof input !== "string") {
    return parseJsonInput(input);
  }
  if (formatHint === "json") {
    try {
      return parseJsonInput(JSON.parse(input) as EmailJsonInput);
    } catch {
      return buildTextOnly(input, ["Input was hinted as JSON but failed to parse; treated as plain text instead."]);
    }
  }
  if (formatHint === "text") {
    return buildTextOnly(input, []);
  }
  // formatHint === "eml" or no hint: auto-detect whether this looks like a real message.
  if (formatHint === "eml" || looksLikeRawEmail(input)) {
    return parseEml(input);
  }
  return buildTextOnly(input, ["No recognizable email header block was found; treated as plain text body."]);
}

function looksLikeRawEmail(raw: string): boolean {
  const { headerBlock, hadBlankLine } = splitHeadersAndBody(raw);
  if (!hadBlankLine) return false;
  if (!/^(from|to|subject|date|received|message-id|return-path):/im.test(headerBlock)) return false;
  const lines = headerBlock.split("\n").filter((l) => l.trim().length > 0);
  if (lines.length === 0) return false;
  const headerLike = lines.filter((l) => /^[A-Za-z][A-Za-z0-9-]*\s*:/.test(l) || /^[ \t]/.test(l)).length;
  return headerLike / lines.length > 0.8;
}

function parseEml(raw: string): ParsedEmail {
  const warnings: string[] = [];
  const tree = parseMime(raw);
  const headers = buildHeadersFromRaw(tree.headers);

  const body: EmailBody = {};
  const attachments: EmailAttachment[] = [];
  collectParts(tree, body, attachments, warnings);
  if (body.html && !body.text) {
    body.htmlAsText = htmlToText(body.html);
  }

  const scanText = [headers.subject ?? "", body.text ?? "", body.htmlAsText ?? "", headers.from ?? "", ...headers.to, headers.replyTo ?? ""].join("\n");
  const indicators = buildIndicators(scanText, attachments);
  const bodySignals = extractBodySignals([body.text ?? "", body.htmlAsText ?? ""].join("\n"));

  return { format: "eml", headers, body, indicators, bodySignals, warnings };
}

function collectParts(node: MimeNode, body: EmailBody, attachments: EmailAttachment[], warnings: string[]): void {
  if (node.children.length > 0) {
    if (node.children.length === 0 && node.contentType.startsWith("multipart/")) {
      warnings.push(`Multipart node "${node.contentType}" had no parseable child parts.`);
    }
    for (const child of node.children) collectParts(child, body, attachments, warnings);
    return;
  }

  const dispositionRaw = node.headers["content-disposition"]?.[0];
  const disposition = dispositionRaw ? parseHeaderParams(dispositionRaw) : undefined;
  const filename = disposition?.params.filename ?? node.params.name;
  const isAttachment = disposition?.primary === "attachment" || (!!filename && !node.contentType.startsWith("text/"));

  if (isAttachment) {
    attachments.push({
      filename,
      contentType: node.contentType,
      sizeBytes: approxDecodedSize(node.body, node.rawEncoding),
      contentDisposition: disposition?.primary,
    });
    return;
  }

  if (node.contentType === "text/plain" && !body.text) {
    body.text = node.body;
  } else if (node.contentType === "text/html" && !body.html) {
    body.html = node.body;
  }
}

function buildHeadersFromRaw(raw: Record<string, string[]>): EmailHeaders {
  const authResults = raw["authentication-results"]?.[0];
  const receivedSpf = raw["received-spf"]?.[0];

  return {
    from: raw["from"]?.[0],
    to: splitAddressList(raw["to"]?.join(", ") ?? ""),
    cc: splitAddressList(raw["cc"]?.join(", ") ?? ""),
    bcc: splitAddressList(raw["bcc"]?.join(", ") ?? ""),
    replyTo: raw["reply-to"]?.[0],
    returnPath: raw["return-path"]?.[0],
    subject: raw["subject"]?.[0],
    date: raw["date"]?.[0],
    messageId: raw["message-id"]?.[0],
    received: raw["received"] ?? [],
    mimeVersion: raw["mime-version"]?.[0],
    contentType: raw["content-type"]?.[0],
    authenticationResults: authResults,
    spf: extractAuthToken(authResults, "spf") ?? (receivedSpf ? receivedSpf.split(" ")[0] : undefined),
    dkim: extractAuthToken(authResults, "dkim"),
    dmarc: extractAuthToken(authResults, "dmarc"),
    xMailer: raw["x-mailer"]?.[0],
    userAgent: raw["user-agent"]?.[0],
    raw,
  };
}

function extractAuthToken(authResults: string | undefined, mechanism: "spf" | "dkim" | "dmarc"): string | undefined {
  if (!authResults) return undefined;
  const match = authResults.match(new RegExp(`${mechanism}=([a-zA-Z]+)`, "i"));
  return match?.[1]?.toLowerCase();
}

function splitAddressList(value: string): string[] {
  const result: string[] = [];
  let current = "";
  let angleDepth = 0;
  let inQuotes = false;
  for (const ch of value) {
    if (ch === '"') inQuotes = !inQuotes;
    if (ch === "<" && !inQuotes) angleDepth++;
    if (ch === ">" && !inQuotes) angleDepth = Math.max(0, angleDepth - 1);
    if (ch === "," && !inQuotes && angleDepth === 0) {
      if (current.trim()) result.push(current.trim());
      current = "";
    } else {
      current += ch;
    }
  }
  if (current.trim()) result.push(current.trim());
  return result;
}

function buildTextOnly(text: string, warnings: string[]): ParsedEmail {
  const headers: EmailHeaders = {
    to: [],
    cc: [],
    bcc: [],
    received: [],
    raw: {},
  };
  const body: EmailBody = { text };
  const indicators = buildIndicators(text, []);
  const bodySignals = extractBodySignals(text);
  return { format: "text", headers, body, indicators, bodySignals, warnings };
}

function parseJsonInput(input: EmailJsonInput): ParsedEmail {
  if (typeof input.raw === "string") {
    return parseEml(input.raw);
  }

  const h = input.headers ?? {};
  const toList = ([] as string[]).concat(h.to ?? []).flatMap((v) => splitAddressList(v));
  const ccList = ([] as string[]).concat(h.cc ?? []).flatMap((v) => splitAddressList(v));
  const bccList = ([] as string[]).concat(h.bcc ?? []).flatMap((v) => splitAddressList(v));
  const receivedList = ([] as string[]).concat(h.received ?? []);

  const rawHeaders: Record<string, string[]> = {};
  for (const [key, value] of Object.entries(h)) {
    if (value === undefined) continue;
    rawHeaders[key.toLowerCase()] = Array.isArray(value) ? value.map(String) : [String(value)];
  }

  const headers: EmailHeaders = {
    from: h.from,
    to: toList,
    cc: ccList,
    bcc: bccList,
    replyTo: h.replyTo,
    returnPath: h.returnPath,
    subject: h.subject,
    date: h.date,
    messageId: h.messageId,
    received: receivedList,
    mimeVersion: h.mimeVersion,
    contentType: h.contentType,
    authenticationResults: h.authenticationResults,
    spf: h.spf ?? extractAuthToken(h.authenticationResults, "spf"),
    dkim: h.dkim ?? extractAuthToken(h.authenticationResults, "dkim"),
    dmarc: h.dmarc ?? extractAuthToken(h.authenticationResults, "dmarc"),
    xMailer: h.xMailer,
    userAgent: h.userAgent,
    raw: rawHeaders,
  };

  const body: EmailBody = { text: input.body?.text, html: input.body?.html };
  if (body.html && !body.text) body.htmlAsText = htmlToText(body.html);

  const attachments: EmailAttachment[] = (input.attachments ?? []).map((a) => ({
    filename: a.filename,
    contentType: a.contentType,
    sizeBytes: a.sizeBytes,
  }));

  const scanText = [headers.subject ?? "", body.text ?? "", body.htmlAsText ?? "", headers.from ?? "", ...headers.to, headers.replyTo ?? ""].join("\n");
  const indicators = buildIndicators(scanText, attachments);
  const bodySignals = extractBodySignals([body.text ?? "", body.htmlAsText ?? ""].join("\n"));

  return { format: "json", headers, body, indicators, bodySignals, warnings: [] };
}

function buildIndicators(scanText: string, attachments: EmailAttachment[]): EmailIndicators {
  const urls = extractUrls(scanText);
  // Query strings inside URLs (e.g. "?em=jm@netnoteinc.com") otherwise get
  // mis-extracted as standalone email addresses, dragging the URL path along
  // as a bogus "local part" — RFC 5322 atext technically allows "/" and "?"
  // unquoted, so a plain regex can't tell URL noise from a real address.
  // Masking already-extracted URLs out before scanning for emails fixes this
  // without narrowing what counts as a valid address elsewhere in the text.
  const textWithoutUrls = urls.reduce((text, url) => text.split(url).join(" "), scanText);
  return {
    urls,
    domains: extractDomainsFromUrls(urls),
    emailAddresses: extractEmailAddresses(textWithoutUrls),
    ipAddresses: extractIpAddresses(scanText),
    phoneNumbers: extractPhoneNumbers(scanText),
    cryptoAddresses: extractCryptoAddresses(scanText),
    attachments,
  };
}

// Re-exported for callers/tests that need lower-level access.
export { parseHeaderBlock, splitHeadersAndBody };
export type { EmailAttachment, EmailBody, EmailHeaders, EmailIndicators, ParsedEmail };
