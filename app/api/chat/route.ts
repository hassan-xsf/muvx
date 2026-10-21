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

import { getS3, bucket } from "@/lib/s3"
import { GetObjectCommand } from "@aws-sdk/client-s3"
import { extractDocumentText } from "@/lib/copilot/document-parser"

async function inlineFileParts(messages: UIMessage[]): Promise<UIMessage[]> {
  let s3: any = null
  try {
    if (bucket) {
      s3 = getS3()
    }
  } catch {
    // S3 might not be configured
  }

  return Promise.all(
    messages.map(async (msg) => {
      if (!Array.isArray(msg.parts) || msg.parts.length === 0) return msg

      const inlinedParts = await Promise.all(
        msg.parts.map(async (part: any) => {
          if (part.type !== "file") return part

          const mediaType = part.mediaType || "application/octet-stream"
          const filename = part.filename || "file"
          const isImage =
            mediaType.startsWith("image/") ||
            /\.(png|jpe?g|webp|gif|svg)$/i.test(filename)
          const isPdf =
            mediaType === "application/pdf" || /\.pdf$/i.test(filename)

          // If already inlined data URI and it is an image or PDF, keep as is
          if (
            typeof part.url === "string" &&
            part.url.startsWith("data:") &&
            (isImage || isPdf)
          ) {
            return part
          }

          try {
            let buffer: Buffer | null = null

            if (typeof part.url === "string" && part.url.startsWith("data:")) {
              const commaIdx = part.url.indexOf(",")
              if (commaIdx !== -1) {
                buffer = Buffer.from(part.url.slice(commaIdx + 1), "base64")
              }
            } else if (part.key && bucket && s3) {
              const cmd = new GetObjectCommand({
                Bucket: bucket,
                Key: part.key,
              })
              const response = await s3.send(cmd)
              if (response.Body) {
                const bytes = await response.Body.transformToByteArray()
                buffer = Buffer.from(bytes)
              }
            } else if (typeof part.url === "string" && part.url.startsWith("http")) {
              const resp = await fetch(part.url)
              if (resp.ok) {
                const arrayBuf = await resp.arrayBuffer()
                buffer = Buffer.from(arrayBuf)
              }
            }

            if (buffer) {
              // 1. Multimodal files (Images & PDFs) - supported natively by LLMs
              if (isImage || isPdf) {
                const resolvedMediaType = isPdf
                  ? "application/pdf"
                  : mediaType.startsWith("image/")
                  ? mediaType
                  : "image/jpeg"
                return {
                  ...part,
                  mediaType: resolvedMediaType,
                  url: `data:${resolvedMediaType};base64,${buffer.toString("base64")}`,
                }
              }

              // 2. Documents (Word .docx, Excel .xlsx, CSV, Text, JSON)
              // Bedrock & OpenRouter reject binary Office MIME types with 400.
              // Extract text so LLM can read and reason over the document!
              const extractedText = await extractDocumentText(
                buffer,
                filename,
                mediaType
              )
              return {
                type: "text",
                text: extractedText,
              }
            } else if (!isImage && !isPdf) {
              // File could not be retrieved from S3: do NOT pass binary MIME type to model
              return {
                type: "text",
                text: `[Attached Document: ${filename} (${mediaType})]`,
              }
            }
          } catch (err) {
            console.error("[INLINE-FILE] Could not process file attachment:", err)
            if (!isImage && !isPdf) {
              return {
                type: "text",
                text: `[Attached Document: ${filename} (Failed to read content)]`,
              }
            }
          }

          return part
        })
      )

      return { ...msg, parts: inlinedParts }
    })
  )
}


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
    let targetModel =
      model || (targetProvider === "openrouter" ? "google/gemini-2.5-flash" : "meta/llama-3.3-70b-instruct")

    // Check if any message contains an image part
    const hasImage = (messages as UIMessage[]).some((m) =>
      Array.isArray(m.parts) &&
      m.parts.some(
        (p: any) =>
          (p.type === "file" && (p.mediaType?.startsWith("image/") || /\.(png|jpe?g|webp|gif|svg)$/i.test(p.filename ?? ""))) ||
          p.type === "image"
      )
    )

    // If an image is attached, ensure a vision-capable model is used on OpenRouter
    if (hasImage && targetProvider === "openrouter") {
      const isKnownVision =
        /gpt-4|gemini|claude-3|qwen.*vl|vision|pixtral/i.test(targetModel)
      if (!isKnownVision) {
        targetModel = "google/gemini-2.5-flash"
      }
    }

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

    // Inline files from S3 as base64 data URIs so OpenRouter never throws
    // "URL content type mismatch: expected application/pdf, detected unknown"
    const inlinedMessages = await inlineFileParts(messages as UIMessage[])

    // Convert UI messages to model format for the LLM
    const modelMessages = await convertToModelMessages(inlinedMessages, {
      ignoreIncompleteToolCalls: true,
    })

    const memorySnippet =
      activeMemories.length > 0
        ? `\nENTERPRISE MEMORY & SAVED CONTEXT:\n${activeMemories.map((m) => `- [${m.key}] (${m.category}): ${m.content}`).join("\n")}`
        : ""

    const customInstructionsSnippet = settings.customInstructions
      ? `\nUSER CUSTOM PREFERENCES:\n${settings.customInstructions}`
      : ""

    const systemPrompt = `You are Donny, the AI Dispatcher and Operations Copilot for Muvx TMS.
Operating Context:
- User: ${session.user.name || session.user.email} (Tenant: ${tenantId})
- Mode: ${isAllowAll ? "FULL AUTONOMY (Approvals pre-granted for authorized actions)" : "SUPERVISED (Request confirmation for impactful writes)"}
- Permissions: loads.create=${perms.has("loads.create")}, trips.create=${perms.has("trips.create")}, fleet.manage=${perms.has("fleet.trucks.create")}, invoices.manage=${perms.has("invoices.view_all")}, expenses.manage=${perms.has("expenses.view_all")}.

Freight Dispatch & Load Creation Protocol:
1. When asked to create, book, or draft a load (or reading rate confirmations, BOLs, tenders, carrier agreements, emails, or images):
   - You MUST extract and provide ALL available fields to 'bookLoad': customerName, loadNumber, tenderNumber, rateConfirmNumber, originFacility, originAddress, originCity, originState (2-letter code), originZip, originAppointment, pickupDate, destFacility, destAddress, destCity, destState (2-letter code), destZip, destAppointment, deliveryDate, rate, customerRate, carrierRate, equipmentType, commodity, weight, miles, temperature (for Reefer), and specialInstructions.
   - NEVER drop street addresses, facility names, or postal codes if they are present in the text, document, or rate confirmation.
   - If an attachment or rate confirmation is provided, parse every stop, dock time, shipper name, consignee name, and equipment spec into the tool call.
2. For state/region values, always provide the standard 2-letter postal code (e.g. "TX", "GA", "IL", "ON").
3. After booking, summarize the complete lane, schedule, rate, equipment, and reference numbers clearly.
${memorySnippet}${customInstructionsSnippet}`

    const toolCtx: ToolContext = {
      userId: session.user.id,
      userEmail: session.user.email,
      userName: session.user.name,
      tenantId,
      perms,
    }

    const toolsRecord: Record<string, any> = {}

    for (const t of ALL_TMS_TOOLS) {
      toolsRecord[t.name] = tool({
        inputSchema: t.inputSchema,
        execute: async (params) => {
          const start = Date.now()
          trace.toolStart({
            tool: t.name,
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
    }

    trace.step({
      toolsRegistered: Object.keys(toolsRecord).length,
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

    return createUIMessageStreamResponse({
      stream,
      headers: {
        "Content-Type": "text/event-stream; charset=utf-8",
        "Cache-Control": "no-cache, no-transform",
        "Connection": "keep-alive",
        "X-Accel-Buffering": "no",
        "Content-Encoding": "none",
      },
    })
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
