// Supabase Edge Function: POST /geolocate-ip
// { ips: string[] } -> GeolocatedIp[] (private/reserved/localhost IPs are silently excluded, not looked up)

import { geolocateSourceIps } from "../_shared/geolocation/index.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method not allowed. Use POST." }, 405);

  let payload: { ips?: unknown };
  try {
    payload = await req.json();
  } catch {
    return json({ error: "Request body must be valid JSON: { ips: string[] }." }, 400);
  }

  if (!Array.isArray(payload.ips) || !payload.ips.every((ip) => typeof ip === "string")) {
    return json({ error: "Missing or invalid field: ips (string[])." }, 400);
  }
  if (payload.ips.length > 50) {
    return json({ error: "Too many IPs in one request (max 50)." }, 413);
  }

  try {
    const results = await geolocateSourceIps(payload.ips as string[]);
    return json({ results }, 200);
  } catch (err) {
    console.error("geolocate-ip failed:", err);
    return json({ error: "Failed to geolocate IPs." }, 500);
  }
});

function json(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
