import "server-only";

/**
 * Deep structured logging for the Copilot agent.
 *
 * Everything the agent does is observable: each turn gets a correlation id
 * that is threaded through the request lifecycle, every tool call is timed,
 * every stream chunk is counted, and failures are recorded with enough
 * context to replay the decision.
 *
 * Output is newline-delimited JSON so it can be shipped straight to CloudWatch
 * Logs Insights (or any log shipper) without a parser, and the same fields are
 * queryable there without regex.
 */

type Level = "DEBUG" | "INFO" | "WARN" | "ERROR";

export interface LogFields {
  [key: string]: unknown;
}

/** Truncate any value so one pathological payload cannot flood the log. */
function safe(value: unknown, depth = 0): unknown {
  if (value === null || value === undefined) return value;
  if (typeof value === "string") {
    return value.length > 2000 ? `${value.slice(0, 2000)}…[truncated]` : value;
  }
  if (typeof value === "number" || typeof value === "boolean") return value;
  if (value instanceof Error) {
    return { name: value.name, message: value.message, stack: value.stack };
  }
  if (depth >= 3) return "[depth-limit]";
  if (Array.isArray(value)) {
    return value.length > 50
      ? [...value.slice(0, 50).map((v) => safe(v, depth + 1)), `…+${value.length - 50}`]
      : value.map((v) => safe(v, depth + 1));
  }
  if (typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      out[k] = safe(v, depth + 1);
    }
    return out;
  }
  return String(value);
}

const IS_DEV = process.env.NODE_ENV === "development";
const LOG_LEVEL = (process.env.COPILOT_LOG_LEVEL ?? "INFO").toUpperCase() as Level;
const LEVEL_ORDER: Record<Level, number> = {
  DEBUG: 10,
  INFO: 20,
  WARN: 30,
  ERROR: 40,
};

/**
 * Emit one structured line. `scope` namespaces the subsystem so `agent`,
 * `tool`, `stream`, `approval` can be filtered independently.
 */
export function log(
  level: Level,
  scope: string,
  message: string,
  fields: LogFields = {},
): void {
  if (LEVEL_ORDER[level] < LEVEL_ORDER[LOG_LEVEL]) return;

  const entry = {
    ts: new Date().toISOString(),
    level,
    scope,
    msg: message,
    ...(safe(fields) as LogFields),
  };

  const line = JSON.stringify(entry);
  if (level === "ERROR") console.error(line);
  else if (level === "WARN") console.warn(line);
  else if (level === "DEBUG" && !IS_DEV) return;
  else console.log(line);
}

export const logDebug = (scope: string, msg: string, f?: LogFields) =>
  log("DEBUG", scope, msg, f);
export const logInfo = (scope: string, msg: string, f?: LogFields) =>
  log("INFO", scope, msg, f);
export const logWarn = (scope: string, msg: string, f?: LogFields) =>
  log("WARN", scope, msg, f);
export const logError = (scope: string, msg: string, f?: LogFields) =>
  log("ERROR", scope, msg, f);

/**
 * A single chat turn. Carries the correlation id and accumulated counters so
 * every log line for one user request can be found with one filter.
 */
export class TurnLogger {
  readonly turnId: string;
  private readonly startedAt = Date.now();

  constructor(
    turnId: string,
    private readonly base: LogFields = {},
  ) {
    this.turnId = turnId;
    this.event("start", {
      tenantId: base.tenantId,
      userId: base.userId,
      model: base.model,
      provider: base.provider,
      messageCount: base.messageCount,
      allowAll: base.allowAll,
      maxSteps: base.maxSteps,
      toolCount: base.toolCount,
    });
  }

  private event(name: string, fields: LogFields = {}, level: Level = "DEBUG") {
    log(level, "turn", name, {
      turnId: this.turnId,
      elapsedMs: Date.now() - this.startedAt,
      ...this.base,
      ...fields,
    });
  }

  step = (fields: LogFields) => this.event("step", fields, "INFO");
  toolStart = (fields: LogFields) => this.event("tool:start", fields);
  toolEnd = (fields: LogFields) => this.event("tool:end", fields);
  // Fires inside the SDK's onToolExecutionStart/onToolExecutionEnd hooks.
  // Different from toolStart/toolEnd (which are inside our execute wrapper)
  // so we can distinguish "tool was called by model" vs "tool finished".
  toolExecutionStart = (fields: LogFields) =>
    this.event("tool-execution:start", fields);
  toolExecutionEnd = (fields: LogFields) =>
    this.event("tool-execution:end", fields);
  approval = (fields: LogFields) => this.event("approval", fields, "WARN");
  chunk = (fields: LogFields) => this.event("stream:chunk", fields);
  finish = (fields: LogFields) => this.event("finish", fields, "INFO");
  fail = (error: unknown, fields: LogFields = {}) =>
    this.event("turn:error", { error, ...fields }, "ERROR");

  // ── Approval-flow lifecycle ───────────────────────────────────────
  // Logged at WARN so the operator can grep approval-flow lines quickly
  // even when the default level is INFO. Every phase of the approval
  // pipeline gets its own event so a single trace file makes "did the
  // follow-up request actually fire?" answerable without guesswork.
  approvalQueued = (fields: LogFields) =>
    this.event("approval:queued", fields, "WARN");
  approvalReceived = (fields: LogFields) =>
    this.event("approval:received", fields, "WARN");
  approvalAnswered = (fields: LogFields) =>
    this.event("approval:answered", fields, "WARN");
  approvalSanitized = (fields: LogFields) =>
    this.event("approval:sanitized", fields, "WARN");
  approvalResumed = (fields: LogFields) =>
    this.event("approval:resumed", fields, "WARN");
  approvalDangling = (fields: LogFields) =>
    this.event("approval:dangling", fields, "ERROR");
  approvalExecuted = (fields: LogFields) =>
    this.event("approval:executed", fields, "INFO");
  approvalDenied = (fields: LogFields) =>
    this.event("approval:denied", fields, "INFO");

  /** Wrap a tool's execute so success, failure and duration are all recorded. */
  async traceTool<T>(
    toolName: string,
    fields: LogFields,
    fn: () => Promise<T>,
  ): Promise<T> {
    const start = Date.now();
    this.toolStart({ tool: toolName, ...fields });
    try {
      const result = await fn();
      this.toolEnd({
        tool: toolName,
        durationMs: Date.now() - start,
        ok: true,
        resultShape: describeShape(result),
      });
      return result;
    } catch (error) {
      this.toolEnd({
        tool: toolName,
        durationMs: Date.now() - start,
        ok: false,
        error,
      });
      throw error;
    }
  }
}

/** Compact description of a result so logs stay readable. */
function describeShape(value: unknown): string {
  if (value === null) return "null";
  if (Array.isArray(value)) return `array(${value.length})`;
  if (typeof value === "object") {
    const keys = Object.keys(value as object);
    return `object{${keys.slice(0, 8).join(",")}${keys.length > 8 ? ",…" : ""}}`;
  }
  return typeof value;
}