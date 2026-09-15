// Supabase Edge Function: POST /check-threat-intel
// { indicator: string, indicator_type: "url"|"domain"|"ip"|"email" } -> ThreatIntelLookupResult[]

import { checkIndicator } from "../_shared/threat-intel/index.ts";
import type { IndicatorType } from "../_shared/threat-intel/types.ts";

const VALID_TYPES: IndicatorType[] = ["url", "domain", "ip", "email"];

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method not allowed. Use POST." }, 405);

  let payload: { indicator?: string; indicator_type?: string };
  try {
    payload = await req.json();
  } catch {
    return json({ error: "Request body must be valid JSON: { indicator, indicator_type }." }, 400);
  }

  if (typeof payload.indicator !== "string" || !payload.indicator.trim()) {
    return json({ error: "Missing required field: indicator (string)." }, 400);
  }
  if (!VALID_TYPES.includes(payload.indicator_type as IndicatorType)) {
    return json({ error: `indicator_type must be one of ${VALID_TYPES.join(", ")}.` }, 400);
  }

  try {
    const results = await checkIndicator(payload.indicator, payload.indicator_type as IndicatorType);
    return json({ results }, 200);
  } catch (err) {
    console.error("check-threat-intel failed:", err);
    return json({ error: "Failed to check threat intelligence." }, 500);
  }
});

function json(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
