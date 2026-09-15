// Supabase Edge Function: POST /parse-email
// Thin HTTP wrapper around the portable parser in ../_shared/email/parser.ts.
// No network calls, no attachment execution — see that module for the actual logic.

import { parseEmail } from "../_shared/email/parser.ts";
import type { EmailInputFormat, EmailJsonInput } from "../_shared/email/types.ts";

const MAX_BODY_BYTES = 10 * 1024 * 1024; // 10MB — generous for an email incl. attachments metadata, bounded against abuse

interface RequestBody {
  input: string | EmailJsonInput;
  format?: EmailInputFormat;
}

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }
  if (req.method !== "POST") {
    return json({ error: "Method not allowed. Use POST." }, 405);
  }

  const contentLength = Number(req.headers.get("content-length") ?? "0");
  if (contentLength > MAX_BODY_BYTES) {
    return json({ error: `Request body too large (max ${MAX_BODY_BYTES} bytes).` }, 413);
  }

  let payload: RequestBody;
  try {
    payload = await req.json();
  } catch {
    return json({ error: "Request body must be valid JSON: { input, format? }." }, 400);
  }

  if (payload.input === undefined || payload.input === null) {
    return json({ error: "Missing required field: input (string or object)." }, 400);
  }
  if (typeof payload.input === "string" && payload.input.length > MAX_BODY_BYTES) {
    return json({ error: "input exceeds maximum size." }, 413);
  }
  if (payload.format && !["eml", "json", "text"].includes(payload.format)) {
    return json({ error: 'format must be one of "eml", "json", "text" if provided.' }, 400);
  }

  try {
    const result = parseEmail(payload.input, payload.format);
    return json(result, 200);
  } catch (err) {
    console.error("parse-email failed:", err);
    return json({ error: "Failed to parse email input." }, 422);
  }
});

function json(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
