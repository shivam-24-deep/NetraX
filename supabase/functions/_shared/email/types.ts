// Phase 3 — Email Parser types.
//
// Every field here is either directly present in the submitted email or
// literally absent — this module never infers or invents a value. Absent
// headers surface as `undefined`, not a guess.

export interface EmailHeaders {
  from?: string;
  to: string[];
  cc: string[];
  bcc: string[];
  replyTo?: string;
  returnPath?: string;
  subject?: string;
  date?: string;
  messageId?: string;
  /** In header order, top = most recently added hop. */
  received: string[];
  mimeVersion?: string;
  contentType?: string;
  authenticationResults?: string;
  spf?: string;
  dkim?: string;
  dmarc?: string;
  xMailer?: string;
  userAgent?: string;
  /** Every header actually present, unparsed values, lowercase key. Source of truth for anything not broken out above. */
  raw: Record<string, string[]>;
}

export interface EmailBody {
  text?: string;
  html?: string;
  /** Plain-text rendering derived from `html` when no text/plain part exists. */
  htmlAsText?: string;
}

export interface EmailAttachment {
  filename?: string;
  contentType?: string;
  /** Approximate decoded size in bytes. Content itself is never retained or executed. */
  sizeBytes?: number;
  contentDisposition?: string;
}

export interface EmailIndicators {
  urls: string[];
  domains: string[];
  emailAddresses: string[];
  ipAddresses: string[];
  phoneNumbers: string[];
  cryptoAddresses: string[];
  attachments: EmailAttachment[];
}

export type BodySignalCategory =
  | "urgency"
  | "financial"
  | "credential_request"
  | "suspicious_instruction";

export interface BodySignal {
  category: BodySignalCategory;
  matchedPhrase: string;
  /** Short excerpt of surrounding text for human review — never a verdict, just the literal match location. */
  context: string;
}

export type EmailInputFormat = "eml" | "json" | "text";

export interface ParsedEmail {
  /** Format actually used to parse this input (after auto-detection, if applicable). */
  format: EmailInputFormat;
  headers: EmailHeaders;
  body: EmailBody;
  indicators: EmailIndicators;
  bodySignals: BodySignal[];
  /** Non-fatal issues encountered while parsing (e.g. malformed MIME boundary) — surfaced, not swallowed. */
  warnings: string[];
}

/** Shape accepted for `format: "json"` input. */
export interface EmailJsonInput {
  /** Raw .eml/MIME source — if present, takes precedence and is parsed as "eml". */
  raw?: string;
  headers?: {
    from?: string;
    to?: string | string[];
    cc?: string | string[];
    bcc?: string | string[];
    replyTo?: string;
    returnPath?: string;
    subject?: string;
    date?: string;
    messageId?: string;
    received?: string | string[];
    mimeVersion?: string;
    contentType?: string;
    authenticationResults?: string;
    spf?: string;
    dkim?: string;
    dmarc?: string;
    xMailer?: string;
    userAgent?: string;
    [extra: string]: unknown;
  };
  body?: {
    text?: string;
    html?: string;
  };
  attachments?: Array<{ filename?: string; contentType?: string; sizeBytes?: number }>;
}
