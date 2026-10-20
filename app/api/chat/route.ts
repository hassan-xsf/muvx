import { NextRequest, NextResponse } from "next/server"
import {
  streamText,
  convertToModelMessages,
  tool,
  createUIMessageStream,
  createUIMessageStreamResponse,
  toUIMessageStream,
  isStepCount,
  pruneMessages,
  isToolUIPart,
  type UIMessage,
  type UIMessageStreamWriter,
} from "ai"
import { getModel } from "@/lib/ai-providers"
import { getSession } from "@/lib/dal"
import { getEffectivePermissions } from "@/lib/can"
import { ALL_TMS_TOOLS, type ToolContext } from "@/lib/copilot/tools"
import { TurnLogger } from "@/lib/copilot/logging"

// Long-running freight workflows (FMCSA audits, 50+ load matching, invoice
// runs) can exceed a minute. Self-hosted on AWS/ECS, so this is a real ceiling
// rather than a serverless platform cap — keep it aligned with the ALB / ECS
// task timeout so the process isn't killed mid-tool.
export const maxDuration = 300

/** Payload emitted as a `data-cot-step` data part for the client's CoT UI. */
type CotStepData = {
  id: string
  toolName: string
  icon: string
  label: string
  description: string
  status: "active" | "complete" | "pending"
  summary: string[]
}

/** Minimal shape of streamText's `onStepEnd` payload that we consume. */
type StepEndEvent = {
  stepNumber?: number
  toolCalls?: { toolCallId: string; toolName: string }[]
  toolResults?: { toolCallId: string; output?: unknown }[]
  usage?: unknown
}

export async function POST(req: NextRequest) {
  // Hoisted outside the try so the catch block can report failures that happen
  // before the logger is constructed (auth, settings load, model resolution).
  let logger: TurnLogger | null = null
  try {
    const session = await getSession()
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const tenantId = session.session.activeOrganizationId
    if (!tenantId) {
      return NextResponse.json({ error: "No active workspace" }, { status: 400 })
    }

    const body = await req.json().catch(() => ({}))
    const { messages, model, provider, chatId } = body

    if (!Array.isArray(messages) || messages.length === 0) {
      return NextResponse.json({ error: "Messages array is required" }, { status: 400 })
    }

    // One correlation id per turn; every log line below carries it.
    const turnId = crypto.randomUUID()

    const {
      getOrCreateCopilotSettings,
      getActiveCopilotMemories,
      logCopilotEvent,
    } = await import("@/lib/copilot/db-init")

    const settings = await getOrCreateCopilotSettings(tenantId, session.user.id)
    const isAllowAll = Boolean(body.allowAll ?? settings.allowAll)
    const activeMemories = await getActiveCopilotMemories(tenantId, session.user.id)

    const perms = await getEffectivePermissions(session.user.id, tenantId)

    const targetProvider = provider || (process.env.OPENROUTER_API_KEY ? "openrouter" : "nim")
    const targetModel =
      model || (targetProvider === "openrouter" ? "openai/gpt-4o-mini" : "meta/llama-3.3-70b-instruct")

    const resolvedModel = getModel(targetProvider, targetModel)

    // Structured turn logger — one line per lifecycle event, correlated by
    // turnId. See lib/copilot/logging.ts.
    // Assigning into `logger` keeps it reachable from the catch block; `trace`
    // is the narrowed const that the closures below capture, so TypeScript
    // does not widen it back to `TurnLogger | null` inside callbacks.
    const trace = (logger = new TurnLogger(turnId, {
      tenantId,
      userId: session.user.id,
      chatId: chatId ?? null,
      provider: targetProvider,
      model: targetModel,
      messageCount: messages.length,
      allowAll: isAllowAll,
    }))

    // ── Approval-flow deep log (server) ────────────────────────────────
    // Every approval-card turn lands here with three possible flows. We
    // log every part's terminal state before we touch anything so a
    // single `grep approval` tells the whole story of a stuck turn.
    const approvalCounts = {
      approvalRequested: 0,
      approvalRespondedApproved: 0,
      approvalRespondedDenied: 0,
      inputStreaming: 0,
      inputAvailable: 0,
      outputAvailable: 0,
      outputError: 0,
      outputDenied: 0,
    };
    for (const m of messages as UIMessage[]) {
      for (const p of m.parts) {
        if (!isToolUIPart(p)) continue;
        if (p.state === "approval-requested") approvalCounts.approvalRequested++;
        else if (p.state === "approval-responded") {
          const approved = (p as { approval?: { approved?: boolean } }).approval
            ?.approved;
          if (approved === true) approvalCounts.approvalRespondedApproved++;
          else if (approved === false)
            approvalCounts.approvalRespondedDenied++;
        } else if (p.state === "input-streaming") approvalCounts.inputStreaming++;
        else if (p.state === "input-available") approvalCounts.inputAvailable++;
        else if (p.state === "output-available") approvalCounts.outputAvailable++;
        else if (p.state === "output-error") approvalCounts.outputError++;
        else if (p.state === "output-denied") approvalCounts.outputDenied++;
      }
    }
    trace.approvalReceived({
      trigger: body.trigger ?? "submit-message",
      messageId: body.messageId ?? null,
      resendFlag: body.resend ?? body.resendStreamId ?? null,
      ...approvalCounts,
    });

    // ── Approval-state sanitiser ──────────────────────────────────────
    // The SDK's `convertToModelMessages` validates that every
    // assistant tool-call has a matching tool-result and throws
    // `AI_MissingToolResultsError` otherwise. There are three tool-part
    // states that show up between turns and need different handling:
    //
    //   `approval-requested`
    //     Stale — operator did not answer this one. Drop it. The SDK
    //     re-emits the request when it needs to, and we don't want
    //     this part to cause `MissingToolResults` errors.
    //
    //   `approval-responded` + `approved === false`
    //     Denial. The SDK synthesises a tool-result with
    //     `output-denied` on the next turn (see convertToModelMessages
    //     in ai/dist/index.js around the `approval-responded` branch),
    //     so the part STILL leaves a dangling tool-call unless we keep
    //     it. We DO keep it — the SDK knows how to translate
    //     approval-responded + approved=false into a synthetic result.
    //
    //   `approval-responded` + `approved === true`
    //     Approved. The SDK needs this part in the next request so it
    //     can drive execution of the tool itself (server-side execute)
    //     and emit the tool-result. Stripping these was the cause of
    //     the "approval granted, conversation stops" bug — the model
    //     never received the matching tool-result on the next turn and
    //     stalled. KEEP these parts.
    //
    // TL;DR: drop only `approval-requested`. Keep `approval-responded`
    // (the SDK handles both branches cleanly).
    const sanitizedMessages = (messages as UIMessage[]).map((m) => ({
      ...m,
      parts: m.parts.filter((p) => {
        if (!isToolUIPart(p)) return true;
        return p.state !== "approval-requested";
      }),
    }))

    const droppedParts = (messages as UIMessage[]).reduce(
      (n, m) =>
        n +
        m.parts.filter(
          (p) => isToolUIPart(p) && p.state === "approval-requested",
        ).length,
      0,
    );

    trace.approvalSanitized({
      incomingMessages: messages.length,
      droppedApprovalParts: droppedParts,
      keptApprovalResponded: approvalCounts.approvalRespondedApproved +
        approvalCounts.approvalRespondedDenied,
      approvedKept: approvalCounts.approvalRespondedApproved,
      deniedKept: approvalCounts.approvalRespondedDenied,
    });

    const modelMessages = await convertToModelMessages(sanitizedMessages, {
      ignoreIncompleteToolCalls: true,
    })

    // After conversion: did every tool-call pair with a tool-result?
    // If not, the model is about to error and the response will be empty
    // — that's the symptom we want to surface BEFORE the user sees it.
    let toolCallCount = 0
    let toolResultCount = 0
    for (const m of modelMessages) {
      const content = (m as { content?: unknown }).content
      if (!Array.isArray(content)) continue
      for (const block of content) {
        const t = (block as { type?: string }).type
        if (t === "tool-call") toolCallCount++
        else if (t === "tool-result") toolResultCount++
      }
    }
    if (toolCallCount > toolResultCount) {
      trace.approvalDangling({
        toolCalls: toolCallCount,
        toolResults: toolResultCount,
        missing: toolCallCount - toolResultCount,
      })
    } else if (
      approvalCounts.approvalRespondedApproved > 0 &&
      approvalCounts.outputAvailable === 0
    ) {
      trace.approvalResumed({
        approval: "approved-without-yet-emitted-result",
        sdkWillDriveExecution: true,
      })
    }

    const memorySnippet =
      activeMemories.length > 0
        ? `\nENTERPRISE MEMORY & SAVED CONTEXT:\n${activeMemories.map((m) => `- [${m.key}] (${m.category}): ${m.content}`).join("\n")}`
        : ""

    const customInstructionsSnippet = settings.customInstructions
      ? `\nUSER CUSTOM PREFERENCES:\n${settings.customInstructions}`
      : ""

    const systemPrompt = `.
 ${session.user.name || session.user.email} (${session.user.role || "Member"})
Workspace: ${tenantId}
Autonomous Mode (Allow All): ${isAllowAll ? "ENABLED (execute approved transactions without halting)" : "DISABLED (prompt user for write confirmation)"}
work :
- loads: ${perms.has("loads.create")}
- trips: ${perms.has("trips.create")}
- fleet & drivers: ${perms.has("fleet.trucks.create")}
- invoices & billing: ${perms.has("invoices.view_all")}
- AP expenses: ${perms.has("expenses.view_all")}
- compliance: ${perms.has("safety.module")}

.${memorySnippet}${customInstructionsSnippet}`

    const toolCtx: ToolContext = {
      userId: session.user.id,
      userEmail: session.user.email,
      userName: session.user.name,
      tenantId,
      perms,
    }

    const toolsRecord: Record<string, any> = {}
    const toolApprovalRecord: Record<string, any> = {}

    for (const t of ALL_TMS_TOOLS) {
      toolsRecord[t.name] = tool({
        description: t.description,
        inputSchema: t.inputSchema,
        execute: async (params) => {
          const start = Date.now()
          // Deep trace: input shape + timing go to the structured log even when
          // the durable audit write below is async (and may itself fail).
          trace.toolStart({
            tool: t.name,
            requiresApproval: Boolean(t.requiresApproval),
            requiredPermissions: t.requiredPermissions ?? [],
            input: params,
          })
          try {
            const out = await t.execute(params, toolCtx)
            const durationMs = `${Date.now() - start}ms`
            trace.toolEnd({
              tool: t.name,
              durationMs: Date.now() - start,
              ok: true,
              output: out,
            })
            logCopilotEvent({
              tenantId,
              userId: session.user.id,
              chatId: chatId || null,
              level: "info",
              action: `Executed ${t.name}`,
              toolName: t.name,
              status: "completed",
              durationMs,
              input: params as any,
              output: out as any,
            }).catch(() => {})
            return out
          } catch (err: any) {
            const durationMs = `${Date.now() - start}ms`
            trace.toolEnd({
              tool: t.name,
              durationMs: Date.now() - start,
              ok: false,
              error: err,
            })
            logCopilotEvent({
              tenantId,
              userId: session.user.id,
              chatId: chatId || null,
              level: "error",
              action: `Failed ${t.name}`,
              toolName: t.name,
              status: "error",
              durationMs,
              input: params as any,
              error: err?.message || String(err),
            }).catch(() => {})
            throw err
          }
        },
      })

      // When allowAll is true, bypass human confirmation so the agent executes autonomously
      if (t.requiresApproval && !isAllowAll) {
        const reason =
          t.approvalReason ||
          `Authorizing ${t.name} will execute an official operational transaction.`
        toolApprovalRecord[t.name] = { type: "user-approval", reason }
        // Surface the gate at WARN so "why did the agent stop?" is answerable
        // from logs alone instead of guessing from the UI.
        trace.approval({
          tool: t.name,
          reason,
          action: "gated",
        })
      }
    }

    trace.step({
      toolsRegistered: Object.keys(toolsRecord).length,
      approvalGated: Object.keys(toolApprovalRecord),
    })

    const maxSteps = Math.max(
      1,
      Math.min(48, parseInt(String(settings.maxSteps || "12"), 10) || 12),
    )

    // Rough token estimate. Char/4 is close enough to decide when to compact;
    // the provider reports the real number afterwards.
    const estimateTokens = (msgs: unknown) =>
      Math.ceil(JSON.stringify(msgs).length / 4)
    const COMPACTION_THRESHOLD = 120_000

    const streamConfig: any = {
      model: resolvedModel,
      system: systemPrompt,
      messages: modelMessages,
      // Official built-in step limiter only.
      //
      // `askDispatcher` used to be in this list as a hand-off mechanism, but
      // it is a normal tool with an `execute` that returns `{ question,
      // options }` — putting it in `stopWhen` halted generation the moment
      // the model reached for it, so the run died before any approval card
      // could render and before the tool result ever came back. The model
      // then re-called it in the same step (hence `["askDispatcher",
      // "askDispatcher"]` in the logs) and the turn ended with nothing but a
      // question. `askDispatcher` now runs inline like any other tool; the
      // UI renders its question/options and the agent continues in the same
      // turn.
      stopWhen: isStepCount(maxSteps),
      tools: toolsRecord,

      // ── Ordering ────────────────────────────────────────────────────
      // TMS writes are dependent: bookLoad creates the load that
      // updateLoad then mutates, dispatchTrip reads the load the previous
      // step created. The SDK runs tool calls in a step concurrently by
      // default, which is a race. Serialise them.
      toolCallConcurrency: 1,

      // ── Context management for long runs ────────────────────────────
      // A 30-step freight audit can pull hundreds of KB of tool results into
      // the prompt. Compact once the estimate crosses the threshold instead of
      // letting the provider reject the request or silently truncate.
      prepareStep: async ({ messages }: { messages: unknown[] }) => {
        if (estimateTokens(messages) <= COMPACTION_THRESHOLD) return {}

        return {
          messages: pruneMessages({
            messages: messages as never,
            // Reasoning is never worth re-reading; drop it entirely.
            reasoning: "all",
            // Keep the last few tool exchanges — the agent usually refers
            // back to the most recent results when writing its summary.
            toolCalls: "before-last-3-messages",
            // Empty assistant turns carry no signal.
            emptyMessages: "remove",
          }),
        }
      },
    }

    if (!isAllowAll && Object.keys(toolApprovalRecord).length > 0) {
      streamConfig.toolApproval = toolApprovalRecord
    }

// Tool → presentation metadata for Chain-of-Thought steps.
    const toolMeta: Record<
      string,
      { icon: string; label: string; description: string }
    > = Object.fromEntries(
      ALL_TMS_TOOLS.map((t) => [
        t.name,
          {
            icon: inferToolIcon(t.name),
            label: humanizeToolName(t.name),
            // Tool descriptions are written for the model, not for humans —
            // they read like API docs. Showing them verbatim in the UI is
            // noise, so the label alone carries the meaning.
            description: "",
          },
      ])
    )

    // Writer is captured so the streamText `onStepEnd` callback — which fires
    // WHILE the model is still generating — can push `data-cot-step` parts into
    // the same response. This keeps the trace live instead of buffered.
    let writerRef: UIMessageStreamWriter | null = null

    const emitCotStep = (stepId: string, data: CotStepData) => {
      try {
        writerRef?.write({
          type: "data-cot-step",
          id: stepId,
          data,
        })
      } catch {
        // Client disconnected mid-stream; ignore.
      }
    }

    const result = streamText({
      ...streamConfig,
      // Official per-step hook. Fires after every LLM step (tool round-trip
      // included) while the response is still streaming. Emits one typed cot
      // step per tool call so the client renders a live reasoning trace.
      onStepEnd: ({ toolCalls, toolResults, usage, stepNumber }: StepEndEvent) => {
        trace.step({
          stepNumber: stepNumber ?? null,
          toolCalls: (toolCalls ?? []).map((c) => c.toolName),
          toolResultCount: (toolResults ?? []).length,
          usage: usage ?? null,
        })
        for (const call of toolCalls ?? []) {
          const meta =
            toolMeta[call.toolName] ?? {
              icon: "wrench",
              label: humanizeToolName(call.toolName),
              description: "",
            }
          const res = (toolResults ?? []).find(
            (r) => r.toolCallId === call.toolCallId
          )
          emitCotStep(`cot-${call.toolCallId}`, {
            id: `cot-${call.toolCallId}`,
            toolName: call.toolName,
            icon: meta.icon,
            label: meta.label,
            description: meta.description,
            status: res ? "complete" : "active",
            summary: res ? summarizeToolOutput(res.output) : [],
          })
        }
      },
      // ── Tool lifecycle hooks — these fire around each tool's execute call.
      // `onToolExecutionStart` fires BEFORE execute() is called.
      // `onToolExecutionEnd` fires AFTER execute() resolves (or throws).
      // Both are wrapped in try/catch so a callback error cannot crash the stream.
      onToolExecutionStart: ({ toolCall }) => {
        try {
          trace.toolExecutionStart({
            toolCallId: toolCall.toolCallId,
            toolName: toolCall.toolName,
            input: toolCall.input as Record<string, unknown>,
          })
        } catch {
          /* non-fatal */
        }
      },
      onToolExecutionEnd: ({ toolCall, toolExecutionMs, toolOutput }) => {
        try {
          if (toolOutput.type === "tool-error") {
            trace.toolExecutionEnd({
              toolCallId: toolCall.toolCallId,
              toolName: toolCall.toolName,
              durationMs: toolExecutionMs,
              ok: false,
              errorMessage:
                toolOutput.error instanceof Error
                  ? toolOutput.error.message
                  : String(toolOutput.error ?? "unknown"),
            })
          } else {
            trace.toolExecutionEnd({
              toolCallId: toolCall.toolCallId,
              toolName: toolCall.toolName,
              durationMs: toolExecutionMs,
              ok: true,
              output: toolOutput.output as Record<string, unknown>,
            })
          }
        } catch {
          /* non-fatal */
        }
      },
    } as Parameters<typeof streamText>[0])

    const stream = createUIMessageStream({
      // Runs once the whole generation is done. The placeholder "thinking"
      // step is written with status `active` at the top of this stream, so
      // without this finalisation it would stay `active` forever and the
      // client's shimmer would keep looping long after the answer arrived.
      onFinish: () => {
        emitCotStep("cot-thinking", {
          id: "cot-thinking",
          toolName: "__thinking__",
          icon: "think",
          label: "",
          description: "",
          status: "complete",
          summary: [],
        })
        trace.finish({ reason: "stream-complete" })
      },
      execute: async ({ writer }) => {
        writerRef = writer

        // 1. Emit a placeholder step FIRST so the UI has instant feedback the
        //    moment the user hits enter. The label stays neutral — the client
        //    renders the shimmer and swaps in the real step labels that
        //    onStepEnd emits as tools actually run.
        writer.write({
          type: "data-cot-step",
          id: "cot-thinking",
          data: {
            id: "cot-thinking",
            toolName: "__thinking__",
            icon: "think",
            label: "",
            description: "",
            status: "active",
            summary: [],
          },
        })

        // 2. Bridge the real UI stream immediately so text/reasoning/tool
        //    chunks reach the client token-by-token. This MUST happen before any
        //    awaiting, otherwise the entire run is buffered server-side and the
        //    UI only updates once generation has finished.
        //
        //    Wrapped in try/catch: an error thrown inside the execute function
        //    (e.g. from a DB write inside a tool) becomes an unhandled rejection
        //    that crashes the Bun worker — producing ERR_INCOMPLETE_CHUNKED_ENCODING
        //    on the client. The catch ensures the stream is closed gracefully so
        //    the HTTP response can terminate cleanly.
        try {
          writer.merge(
            toUIMessageStream({
              stream: result.stream,
              sendReasoning: true,
              // Surface real failures to the operator instead of the SDK's
              // default "An error occurred." — a silent black box makes a TMS
              // that mutates freight data genuinely dangerous to debug.
              onError: (error) => {
                if (error == null) return "Unknown error";
                if (typeof error === "string") return error;
                if (error instanceof Error) return error.message;
                return JSON.stringify(error);
              },
              // Official hook for token usage. The client's <Context> component
              // reads this off message.metadata to render the context-window
              // meter and cost estimate.
              messageMetadata: ({ part }) => {
                if (part.type === "finish") {
                  // Final accounting for this turn: what the operator actually
                  // paid for, in one line.
                  trace.finish({
                    usage: part.totalUsage,
                    finishReason: "complete",
                  })
                  return { totalUsage: part.totalUsage }
                }
              },
            }),
          )
        } catch (mergeErr) {
          // Log but do not re-throw — a merge error means the underlying stream
          // errored and has already been surfaced to the client via onError.
          // Re-throwing here would crash the Bun worker with
          // ERR_STREAM_PREMATURE_CLOSE or ERR_INCOMPLETE_CHUNKED_ENCODING.
          console.error(`[chat] writer.merge error:`, mergeErr)
          trace.fail(mergeErr, { reason: "writer-merge" })
        }
      },
    })

    return createUIMessageStreamResponse({ stream })
  } catch (error: any) {
    // Structured failure, correlated by turnId where we got far enough to
    // create the logger.
    if (logger) logger.fail(error)
    console.error("Chat API error:", error)
    return NextResponse.json(
      {
        error: error?.message || "Internal server error",
        code: error?.code || "CHAT_FAILED",
        reason:
          error?.message?.includes("API")
            ? "provider_api"
            : error?.message?.includes("timeout")
            ? "timeout"
            : "server",
      },
      { status: 500 }
    )
  }
}

/**
 * Map a tool name to a string icon key the client can resolve to a Lucide icon.
 * Keeps the server payload tiny and the rendering concern on the client.
 */
function inferToolIcon(toolName: string): string {
  const n = toolName.toLowerCase()
  if (n.includes("load") && (n.includes("book") || n.includes("create"))) return "package-plus"
  if (n.includes("load") || n.includes("freight")) return "package"
  if (n.includes("dispatch") || n.includes("trip")) return "truck"
  if (n.includes("driver") || n.includes("fleet") || n.includes("truck") || n.includes("trailer")) return "truck"
  if (n.includes("customer") || n.includes("shipper")) return "building-2"
  if (n.includes("carrier")) return "truck"
  if (n.includes("invoice") || n.includes("billing") || n.includes("payment")) return "receipt"
  if (n.includes("expense") || n.includes("settle")) return "banknote"
  if (n.includes("member") || n.includes("invite") || n.includes("workspace")) return "user-plus"
  if (n.includes("audit") || n.includes("security")) return "shield"
  if (n.includes("plan") || n.includes("delegate") || n.includes("subtask")) return "list-checks"
  if (n.includes("dispatcher") || n.includes("ask")) return "help-circle"
  if (n.includes("memory") || n.includes("recall") || n.includes("save")) return "brain"
  if (n.includes("search") || n.includes("query")) return "search"
  if (n.includes("email") || n.includes("send")) return "mail"
  if (n.includes("schedule") || n.includes("task")) return "calendar"
  if (n.includes("pod") || n.includes("doc") || n.includes("file")) return "file-text"
  return "wrench"
}

/**
 * Tool name → present-continuous status label, matching how VS Code Copilot
 * phrases its own progress ("Planning refactor strategy"). `queryLoads`
 * becomes "Searching loads", not the unusable "query Loads".
 */
function humanizeToolName(toolName: string): string {
  const verb = VERB_BY_TOOL[toolName];
  if (verb) return verb;

  // Unknown tool: fall back to a clean capitalised phrase rather than raw
  // camelCase soup.
  const words = toolName
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
  return `Running ${words}`;
}

/** Explicit verb phrases so every TMS tool reads like a real progress step. */
const VERB_BY_TOOL: Record<string, string> = {
  // Loads
  bookLoad: "Booking load",
  queryLoads: "Searching loads",
  updateLoad: "Updating load",
  updateLoadDocs: "Updating load documents",
  // Trips & dispatch
  dispatchTrip: "Dispatching trip",
  updateTripStatus: "Updating trip status",
  // Fleet
  getFleetStatus: "Checking fleet status",
  createDriver: "Adding driver",
  updateDriver: "Updating driver",
  createTruck: "Adding tractor",
  updateTruck: "Updating tractor",
  createTrailer: "Adding trailer",
  // Customers & carriers
  queryCustomers: "Searching customers",
  createCustomer: "Adding customer",
  queryCarriers: "Searching carriers",
  createCarrier: "Adding carrier",
  // Invoicing
  queryInvoices: "Searching invoices",
  createInvoice: "Generating invoice",
  sendInvoiceEmail: "Sending invoice email",
  markInvoicePaid: "Recording payment",
  getMissingPods: "Checking missing PODs",
  // Expenses
  reviewPendingExpenses: "Reviewing pending expenses",
  approveExpense: "Approving expense",
  logTripExpense: "Logging trip expense",
  // Members
  listWorkspaceMembers: "Listing workspace members",
  inviteWorkspaceMember: "Inviting member",
  resendInvitation: "Resending invitation",
  cancelInvitation: "Cancelling invitation",
  updateMemberRole: "Updating member role",
  removeMember: "Removing member",
  // System & subagents
  queryAuditLogs: "Reviewing audit log",
  checkIntegrations: "Checking integrations",
  searchFreightKnowledge: "Searching freight knowledge",
  createExecutionPlan: "Building execution plan",
  delegateSubtask: "Delegating subtask",
  askDispatcher: "Asking dispatcher",
  // Coworker
  assignDriverTask: "Assigning driver task",
  askDriverQuestion: "Asking driver",
  scheduleCoworkerTask: "Scheduling checkup",
  listScheduledTasks: "Listing scheduled tasks",
  saveCopilotMemory: "Saving memory",
  recallCopilotMemory: "Recalling memory",
}

/**
 * Reduce a tool's output to a few short labels suitable for
 * ChainOfThoughtSearchResult badges.
 */
function summarizeToolOutput(output: unknown): string[] {
  if (!output || typeof output !== "object") return []
  const o = output as Record<string, unknown>
  const out: string[] = []
  if (Array.isArray(o.results)) {
    out.push(`${o.results.length} result${o.results.length === 1 ? "" : "s"}`)
  }
  if (typeof o.count === "number") {
    out.push(`${o.count} item${o.count === 1 ? "" : "s"}`)
  }
  if (typeof o.success === "boolean") {
    out.push(o.success ? "ok" : "failed")
  }
  if (o.id != null) out.push(`#${String(o.id).slice(0, 8)}`)
  if (typeof o.message === "string") out.push(o.message.slice(0, 60))
  return out.slice(0, 4)
}
