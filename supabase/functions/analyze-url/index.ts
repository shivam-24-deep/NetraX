// Supabase Edge Function: POST /analyze-url
// Thin HTTP wrapper around ../_shared/url-analysis. No network calls of its
// own beyond the optional local ML API — never follows the submitted URL.

import { analyzeUrlWithMl } from "../_shared/url-analysis/index.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method not allowed. Use POST." }, 405);

  let payload: { url?: string };
  try {
    payload = await req.json();
  } catch {
    return json({ error: "Request body must be valid JSON: { url }." }, 400);
  }

  if (typeof payload.url !== "string" || !payload.url.trim()) {
    return json({ error: "Missing required field: url (string)." }, 400);
  }
  if (payload.url.length > 8192) {
    return json({ error: "url exceeds maximum length." }, 413);
  }

  try {
    const result = await analyzeUrlWithMl(payload.url);
    return json(result, 200);
  } catch (err) {
    console.error("analyze-url failed:", err);
    return json({ error: "Failed to analyze URL." }, 422);
  }
});

function json(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
