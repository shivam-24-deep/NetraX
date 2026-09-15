// Shared tool-execution bookkeeping used by every agent pipeline
// (investigateEmail, investigateUrl, …) so each one logs tool calls/skips the
// same auditable way instead of reimplementing this per pipeline.

import type { ToolExecutionRecord, ToolName } from "./types.ts";

export async function runTool<T>(
  tool: ToolName,
  log: ToolExecutionRecord[],
  fn: () => Promise<T>,
  countFindings: (result: T) => number,
): Promise<T> {
  const startedAt = new Date().toISOString();
  const start = performance.now();
  try {
    const result = await fn();
    log.push({ tool, status: "success", startedAt, durationMs: performance.now() - start, findingCount: countFindings(result) });
    return result;
  } catch (err) {
    log.push({
      tool,
      status: "error",
      reason: err instanceof Error ? err.message : "unknown error",
      startedAt,
      durationMs: performance.now() - start,
      findingCount: 0,
    });
    throw err;
  }
}

export function skipTool(tool: ToolName, log: ToolExecutionRecord[], reason: string): void {
  log.push({ tool, status: "skipped", reason, startedAt: new Date().toISOString(), durationMs: 0, findingCount: 0 });
}
