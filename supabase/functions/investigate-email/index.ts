// Supabase Edge Function: POST /investigate-email
// { input: string | EmailJsonInput, format?: "eml"|"json"|"text" } -> InvestigationResult
// The main entry point tying together Phases 3-10.

import { investigateEmail } from "../_shared/agent/orchestrator.ts";
import type { EmailInputFormat, EmailJsonInput } from "../_shared/email/types.ts";

const MAX_BODY_BYTES = 10 * 1024 * 1024;

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method not allowed. Use POST." }, 405);

  const contentLength = Number(req.headers.get("content-length") ?? "0");
  if (contentLength > MAX_BODY_BYTES) return json({ error: `Request body too large (max ${MAX_BODY_BYTES} bytes).` }, 413);

  let payload: { input?: string | EmailJsonInput; format?: EmailInputFormat };
  try {
    payload = await req.json();
  } catch {
    return json({ error: "Request body must be valid JSON: { input, format? }." }, 400);
  }

  if (payload.input === undefined || payload.input === null) {
    return json({ error: "Missing required field: input (string or object)." }, 400);
  }
  if (payload.format && !["eml", "json", "text"].includes(payload.format)) {
    return json({ error: 'format must be one of "eml", "json", "text" if provided.' }, 400);
  }

  try {
    const result = await investigateEmail(payload.input, payload.format);
    return json(result, 200);
  } catch (err) {
    console.error("investigate-email failed:", err);
    return json({ error: "Failed to investigate email." }, 422);
  }
});

function json(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
