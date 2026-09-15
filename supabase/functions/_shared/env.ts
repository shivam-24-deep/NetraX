// Reads an environment variable in both Deno (production Edge Function
// runtime) and Node (this repo's test runner) without either one needing to
// know about the other's global. Centralized so every adapter that needs a
// credential (URLhaus, PhishTank, MaxMind, ...) does this the same way.

declare const Deno: { env: { get(key: string): string | undefined } } | undefined;

export function getEnv(key: string): string | undefined {
  if (typeof Deno !== "undefined") return Deno.env.get(key);
  return (globalThis as { process?: { env?: Record<string, string> } }).process?.env?.[key];
}
