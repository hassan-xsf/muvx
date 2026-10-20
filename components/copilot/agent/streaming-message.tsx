"use client";

/**
 * StreamingChatMessage — Copilot-style Muvx agentic UI.
 *
 * Faithful re-implementation of AI-Agent's streaming-message.tsx, sized
 * for Muvx (cream + ink + burnt-orange). Each assistant message renders
 * an ordered sequence of:
 *
 *   ThinkingRun: groups reasoning + tool calls into one collapsible unit.
 *     Title carries the active tool's describeTool() output, animated
 *     with shimmer-text + animated-ellipsis while running.
 *   Tool rows: per-tool icons, past/present-tense label switch, target
 *     pill, collapsible Input/Output/Error drawers with JSON viewer.
 *   Text blocks: VS Code-style progressive markdown (frozen + live split)
 *     with the .streaming-live CSS class triggering an inline caret.
 *   Warning / error banners: friendly explanations for connection issues.
 *   Source pills, Confirmation cards, Subagent cards, etc.
 */

import {
  createContext,
  memo,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react"
import Markdown from "react-markdown"
import remarkGfm from "remark-gfm"
import {
  AlertTriangle,
  Check,
  ChevronRight,
  Circle,
  Copy,
  ExternalLink,
  Loader2,
  PencilLine,
  RefreshCw,
  Share2,
  ThumbsDown,
  ThumbsUp,
} from "lucide-react"
import { cn } from "@/lib/utils"
import { ToolPartList, describeTool } from "./parts/tool-part"
import { FilePartList } from "./parts/file-part"
import { ReasoningPart } from "./parts/reasoning-part"
import { DataTable, parseMarkdownTable } from "./parts/data-table"
import type {
  ApprovalResponder,
  ReasoningPartEvent,
  StreamingMessage,
  StreamPart,
  TextDeltaEvent,
  ToolCallEvent,
  WarningEvent,
  StreamErrorEvent,
  SourceUrlEvent,
  MessageAttachment,
  ProgressEvent,
} from "./types"

// ---------------------------------------------------------------------------
// Active-state guard
// ---------------------------------------------------------------------------
const ACTIVE_TOOL_STATES = [
  "calling",
  "input-streaming",
  "input-available",
  "executing",
] as const

function isActiveToolState(state: string) {
  return (ACTIVE_TOOL_STATES as readonly string[]).includes(state)
}

// ---------------------------------------------------------------------------
// useElapsedTimer — second counter that resets when inactive
// ---------------------------------------------------------------------------
function useElapsedTimer(isActive: boolean) {
  const [elapsed, setElapsed] = useState(0)
  const startRef = useRef(0)

  useEffect(() => {
    if (!isActive) {
      const t = setTimeout(() => setElapsed(0), 0)
      return () => clearTimeout(t)
    }
    startRef.current = Date.now()
    const id = setInterval(
      () => setElapsed(Math.floor((Date.now() - startRef.current) / 1000)),
      500,
    )
    return () => clearInterval(id)
  }, [isActive])

  return elapsed
}

// ---------------------------------------------------------------------------
// ActivePulseDot — for ThinkingRun title
// ---------------------------------------------------------------------------
function ActivePulseDot({ className }: { className?: string }) {
  return (
    <span className={cn("relative flex size-3 items-center justify-center", className)}>
      <span className="absolute size-2 rounded-full bg-brand-accent/25 animate-ping" />
      <Circle className="relative size-2 fill-brand-accent text-brand-accent animate-pulse-soft" />
    </span>
  )
}

// ---------------------------------------------------------------------------
// Friendly stream error translation
// ---------------------------------------------------------------------------
function formatStreamErrorMessage(message: string): string {
  const lower = message.toLowerCase()
  if (
    lower.includes("10054") ||
    lower.includes("connection reset") ||
    lower.includes("forcibly closed")
  ) {
    return "The connection to the AI provider was interrupted mid-stream. This is usually a temporary network issue. You can retry your message."
  }
  if (lower.includes("broken pipe")) {
    return "The connection to the AI provider was dropped. Please retry your message."
  }
  if (lower.includes("timeout") || lower.includes("timed out")) {
    return "The request timed out — the model took too long to respond. Try a shorter prompt or retry."
  }
  return message
}

// ---------------------------------------------------------------------------
// LiveBlockContext — StreamingText uses this to skip code chrome while
// the markdown is still streaming.
// ---------------------------------------------------------------------------
const LiveBlockContext = createContext(false)

function StreamingTextCodeBlock({
  children,
  className,
}: {
  children?: ReactNode
  className?: string
}) {
  const isLive = useContext(LiveBlockContext)
  const isInline = !className
  if (isInline) {
    return (
      <code className="rounded-md bg-brand-cream px-1.5 py-0.5 font-mono text-[13px] text-brand-ink">
        {children}
      </code>
    )
  }
  const code = String(children ?? "").replace(/\n$/, "")
  if (isLive) {
    return (
      <pre className="my-2 max-h-105 overflow-auto rounded-lg border border-brand-rule/40 bg-brand-cream-soft px-3 py-2 font-mono text-[12.5px] leading-relaxed text-brand-ink">
        <code>{code}</code>
      </pre>
    )
  }
  return (
    <pre className="my-2 overflow-x-auto rounded-lg border border-brand-rule/60 bg-brand-cream-soft px-3 py-2 font-mono text-[12.5px] leading-relaxed text-brand-ink">
      <code>{code}</code>
    </pre>
  )
}

function StreamingTextTable({ children }: { children?: ReactNode }) {
  return (
    <div className="my-2 overflow-x-auto rounded-md border border-brand-rule/40">
      <table className="m-0 w-full border-collapse text-[13.5px]">
        {children}
      </table>
    </div>
  )
}

const STREAMING_MARKDOWN_COMPONENTS = {
  code: StreamingTextCodeBlock,
  table: StreamingTextTable,
} as const

// ---------------------------------------------------------------------------
// FrozenMarkdown — already-closed markdown that won't re-render
// ---------------------------------------------------------------------------
const FrozenMarkdown = memo(function FrozenMarkdown({
  text,
}: {
  text: string
}) {
  return (
    <Markdown
      remarkPlugins={[remarkGfm]}
      components={STREAMING_MARKDOWN_COMPONENTS}
    >
      {text}
    </Markdown>
  )
})

// ---------------------------------------------------------------------------
// StreamingText — VS Code-style progressive markdown. Frozen + live split.
// Sets `.streaming-live` on the live tail so the CSS caret rides at the
// end of the last child block.
// ---------------------------------------------------------------------------
const StreamingText = memo(function StreamingText({
  text,
  isStreaming,
}: {
  text: string
  isStreaming: boolean
}) {
  const { frozen, live, liveRender } = useMemo(() => {
    if (!text) return { frozen: "", live: "", liveRender: "" }
    if (!isStreaming) return { frozen: text, live: "", liveRender: "" }
    const fenceCount = (text.match(/^```/gm) ?? []).length
    const insideFence = fenceCount % 2 === 1
    if (insideFence) {
      return { frozen: "", live: text, liveRender: `${text}\n\`\`\`` }
    }
    const lastBreak = text.lastIndexOf("\n\n")
    if (lastBreak === -1) return { frozen: "", live: text, liveRender: text }
    return {
      frozen: text.slice(0, lastBreak + 2),
      live: text.slice(lastBreak + 2),
      liveRender: text.slice(lastBreak + 2),
    }
  }, [text, isStreaming])

  const tableData = useMemo(() => {
    if (isStreaming) return null
    const tableMatch = text.match(
      /^\|.+\|[\s\S]*?\n\|[-: |]+\|[\s\S]*?\n(\|.+\|[\s\S]*)/m,
    )
    if (!tableMatch) return null
    const tableStart = text.indexOf(tableMatch[0])
    const tableText = text.slice(tableStart).split(/\n\n/)[0]
    const parsed = parseMarkdownTable(tableText)
    if (parsed && parsed.rows.length >= 5)
      return {
        parsed,
        beforeTable: text.slice(0, tableStart),
        afterTable: text.slice(tableStart + tableText.length),
      }
    return null
  }, [text, isStreaming])

  if (!text) return null

  const prose = cn(
    "mx-auto max-w-3xl wrap-break-word text-brand-ink",
    "text-[15px] leading-[1.72]",
    "[&>*:first-child]:mt-0 [&>*:last-child]:mb-0",
  )

  if (tableData) {
    return (
      <div className={prose}>
        {tableData.beforeTable && <FrozenMarkdown text={tableData.beforeTable} />}
        <DataTable
          headers={tableData.parsed.headers}
          rows={tableData.parsed.rows}
          className="my-2"
        />
        {tableData.afterTable.trim() && (
          <FrozenMarkdown text={tableData.afterTable} />
        )}
      </div>
    )
  }

  return (
    <div className={prose}>
      {frozen && <FrozenMarkdown text={frozen} />}
      {live && (
        // .streaming-live enables the .streaming-live > :last-child:not(pre)::after
        // rule from globals.css — that paints the blinking caret at the tail.
        <div className={cn(isStreaming && "streaming-live")}>
          <LiveBlockContext.Provider value={isStreaming}>
            <Markdown
              remarkPlugins={[remarkGfm]}
              components={STREAMING_MARKDOWN_COMPONENTS}
            >
              {liveRender}
            </Markdown>
          </LiveBlockContext.Provider>
        </div>
      )}
    </div>
  )
})

// ---------------------------------------------------------------------------
// Reasoning block — embedded variant lives under a ThinkingRun title row;
// standalone variant uses the ReasoningPart component (with caret).
// ---------------------------------------------------------------------------
function ReasoningBlock({
  reasoningEvents,
  isStreaming,
  embedded = false,
}: {
  reasoningEvents: ReasoningPartEvent[]
  isStreaming: boolean
  embedded?: boolean
}) {
  const text = reasoningEvents
    .filter((e) => e.type === "reasoning-delta")
    .map((e) => e.text)
    .join("")
    .trim()

  if (!text && !isStreaming) return null

  if (embedded) {
    return (
      <div className="py-0.5 text-brand-muted-soft">
        <p className="whitespace-pre-wrap text-[12.5px] italic leading-relaxed text-brand-muted">
          <span
            className={cn(
              "mr-2 ml-[-19.5px] inline-block size-1.5 rounded-full align-middle",
              isStreaming ? "bg-brand-accent" : "bg-brand-muted-soft/60",
            )}
            aria-hidden
          />
          {text}
          {isStreaming && (
            <span className="ml-0.5 inline-block h-3 w-0.5 translate-y-0.5 rounded-sm bg-brand-muted-soft align-middle animate-pulse" />
          )}
        </p>
      </div>
    )
  }

  return <ReasoningPart text={text} streaming={isStreaming} />
}

// ---------------------------------------------------------------------------
// ThinkingRun + segment grouping (same algorithm as AI-Agent)
// ---------------------------------------------------------------------------
type ThinkingRunSegment =
  | { kind: "reasoning"; events: ReasoningPartEvent[] }
  | { kind: "tools"; tools: ToolCallEvent[] }

type RenderSegment =
  | ThinkingRunSegment
  | { kind: "text"; events: TextDeltaEvent[] }
  | { kind: "sources"; urls: SourceUrlEvent[] }
  | { kind: "progress"; ev: ProgressEvent }
  | { kind: "warning"; ev: WarningEvent }
  | { kind: "stream-error"; ev: StreamErrorEvent }

type RenderGroup =
  | RenderSegment
  | { kind: "thinking-run"; segments: ThinkingRunSegment[] }

function isThinkingRunSegment(seg: RenderSegment): seg is ThinkingRunSegment {
  return seg.kind === "reasoning" || seg.kind === "tools"
}

function groupThinkingRuns(segments: RenderSegment[]): RenderGroup[] {
  const groups: RenderGroup[] = []
  let current: ThinkingRunSegment[] = []
  let pendingText: TextDeltaEvent[] = []

  for (const seg of segments) {
    if (seg.kind === "text") {
      pendingText.push(...seg.events)
      continue
    }
    if (isThinkingRunSegment(seg)) {
      current.push(seg)
      continue
    }
    if (current.length) {
      groups.push({ kind: "thinking-run", segments: current })
      current = []
    }
    if (pendingText.length) {
      groups.push({ kind: "text", events: pendingText })
      pendingText = []
    }
    groups.push(seg)
  }
  if (current.length) {
    groups.push({ kind: "thinking-run", segments: current })
  }
  if (pendingText.length) {
    groups.push({ kind: "text", events: pendingText })
  }
  return groups
}

function deriveThinkingRunTitle(
  segments: ThinkingRunSegment[],
  active: boolean,
) {
  const tools = segments.flatMap((s) =>
    s.kind === "tools" ? s.tools : [],
  )
  const activeTool = [...tools].reverse().find((t) => isActiveToolState(t.state))
  if (active) {
    return {
      title: tools.length || activeTool ? "Working" : "Thinking",
      detail: activeTool ? describeTool(activeTool.toolName, activeTool.args) : undefined,
    }
  }
  if (!tools.length) return { title: "Thought" }
  if (tools.length === 1)
    return { title: describeTool(tools[0].toolName, tools[0].args) }
  const allSearch = tools.every((t) =>
    /search|grep|find|list|query/i.test(t.toolName),
  )
  if (allSearch) return { title: `Searched for ${tools.length} things` }
  const allRead = tools.every((t) =>
    /read|get_file|list_dir|get_/i.test(t.toolName),
  )
  if (allRead) return { title: `Reviewed ${tools.length} files` }
  return { title: `Finished ${tools.length} steps` }
}

function ThinkingRun({
  segments,
  active,
  onRespond,
}: {
  segments: ThinkingRunSegment[]
  active: boolean
  onRespond?: ApprovalResponder
}) {
  const [open, setOpen] = useState(true)
  const title = deriveThinkingRunTitle(segments, active)
  const elapsed = useElapsedTimer(active)
  const runTools = segments.flatMap((s) => (s.kind === "tools" ? s.tools : []))
  const doneTools = runTools.filter((t) => !isActiveToolState(t.state)).length
  const hasVisibleReasoning = segments.some(
    (s) =>
      s.kind === "reasoning" &&
      s.events.some(
        (e) => e.type === "reasoning-delta" && e.text.trim(),
      ),
  )

  return (
    <div className="my-1 text-brand-muted-soft">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="group/thinking inline-flex max-w-full items-center gap-1.5 py-0.5 text-[13px] leading-none text-brand-muted transition-colors hover:text-brand-ink"
        aria-expanded={open}
      >
        {active ? (
          <ActivePulseDot />
        ) : (
          <Check className="size-3 text-brand-muted-soft/80" />
        )}
        <span
          className={cn(
            "truncate",
            active && "font-medium text-brand-ink/85",
            active && "shimmer-text",
          )}
        >
          {title.title}
        </span>
        {title.detail && (
          <span
            className={cn(
              "min-w-0 truncate text-brand-muted-soft/70",
              active && "animated-ellipsis",
            )}
          >
            {title.detail}
          </span>
        )}
        {/* Live progress: steps finished so far, and how long the run has
            been going. Both only while active — a finished run's title
            already says "Finished N steps". The total is deliberately not
            shown: tool calls arrive as the model makes them, so there is no
            denominator until the run ends. */}
        {active && doneTools > 0 && (
          <span className="shrink-0 font-mono text-[10.5px] tabular-nums text-brand-muted-soft/60">
            {doneTools} done
          </span>
        )}
        {active && elapsed > 0 && (
          <span className="shrink-0 font-mono text-[10.5px] tabular-nums text-brand-muted-soft/60">
            {elapsed < 60 ? `${elapsed}s` : `${Math.floor(elapsed / 60)}m ${elapsed % 60}s`}
          </span>
        )}
        <ChevronRight
          className={cn(
            "size-3 shrink-0 text-brand-muted-soft/55 transition-transform group-hover/thinking:text-brand-muted",
            open && "rotate-90",
          )}
        />
      </button>

      {open && (
        <div className="relative mt-1 ml-1.5 space-y-1 border-l border-brand-rule/70 pl-4">
          {segments.map((segment, index) => {
            if (segment.kind === "reasoning") {
              return (
                <ReasoningBlock
                  key={`reasoning-${index}`}
                  reasoningEvents={segment.events}
                  isStreaming={active && index === segments.length - 1}
                  embedded
                />
              )
            }
            return <ToolPartList key={`tools-${index}`} tools={segment.tools} onRespond={onRespond} />
          })}
          {active && !hasVisibleReasoning && (
            <div className="py-0.5 text-[12.5px] text-brand-muted-soft/80">
              <span className="shimmer-text animated-ellipsis">
                {title.detail ?? title.title}
              </span>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Segments builder — orderedParts → RenderSegment[]
// ---------------------------------------------------------------------------
function buildSegments(parts: StreamPart[]): RenderSegment[] {
  const segs: RenderSegment[] = []
  const toolsById = new Map<string, ToolCallEvent>()

  for (const part of parts) {
    const last = segs[segs.length - 1]

    if (
      part.type === "reasoning-start" ||
      part.type === "reasoning-delta" ||
      part.type === "reasoning-end"
    ) {
      if (last?.kind === "reasoning") {
        last.events.push(part as ReasoningPartEvent)
      } else {
        segs.push({ kind: "reasoning", events: [part as ReasoningPartEvent] })
      }
      continue
    }
    if (part.type.startsWith("tool-call")) {
      const t = part as ToolCallEvent
      const existing = toolsById.get(t.toolCallId)
      if (existing) {
        Object.assign(existing, {
          ...t,
          toolName:
            t.toolName && t.toolName !== "tool"
              ? t.toolName
              : existing.toolName,
          args: t.args ?? existing.args,
          invocationMessage: t.invocationMessage ?? existing.invocationMessage,
          pastTenseMessage: t.pastTenseMessage ?? existing.pastTenseMessage,
        })
        continue
      }
      toolsById.set(t.toolCallId, t)
      if (last?.kind === "tools") {
        last.tools.push(t)
      } else {
        segs.push({ kind: "tools", tools: [t] })
      }
      continue
    }
    if (part.type === "text-delta" || part.type === "text-end") {
      if (last?.kind === "text") {
        last.events.push(part as TextDeltaEvent)
      } else {
        segs.push({ kind: "text", events: [part as TextDeltaEvent] })
      }
      continue
    }
    if (part.type === "source-url") {
      if (last?.kind === "sources") {
        last.urls.push(part as SourceUrlEvent)
      } else {
        segs.push({ kind: "sources", urls: [part as SourceUrlEvent] })
      }
      continue
    }
    if (part.type === "progress") {
      segs.push({ kind: "progress", ev: part as ProgressEvent })
      continue
    }
    if (part.type === "warning") {
      segs.push({ kind: "warning", ev: part as WarningEvent })
      continue
    }
    if (part.type === "stream-error") {
      segs.push({ kind: "stream-error", ev: part as StreamErrorEvent })
      continue
    }
  }
  return segs
}

// ---------------------------------------------------------------------------
// Warning / error banners
// ---------------------------------------------------------------------------
// ---------------------------------------------------------------------------
// WorkingSetHeader — "records this turn changed" pill row.
//
// Reads the RESULT, not the args: every write tool in lib/copilot/tools
// returns `{ success: true, <entity>Number | name, ... }`, so a pill only
// appears once the write actually landed. Read-only turns render nothing,
// which keeps ordinary Q&A answers clean.
// ---------------------------------------------------------------------------
const WRITE_TOOL = /^(book|draft|create|update|dispatch|delete|invite|remove|send|assign|record)/i

/** Human label for a record a write tool just touched. */
function touchedRecordLabel(tool: ToolCallEvent): string | undefined {
  if (tool.state !== "output-available") return undefined
  if (!WRITE_TOOL.test(tool.toolName)) return undefined
  const r = tool.result
  if (!r || typeof r !== "object") return undefined
  const obj = r as Record<string, unknown>
  if (obj.success === false) return undefined
  // Order matters: a trip/invoice result also carries the loadNumber it
  // references, so probe the most specific key first or the pill names the
  // wrong record.
  for (const key of [
    "tripNumber",
    "invoiceNumber",
    "expenseNumber",
    "unitNumber",
    "loadNumber",
    "name",
    "email",
  ]) {
    const v = obj[key]
    if (typeof v === "string" && v.trim()) return v
  }
  return undefined
}

function WorkingSetHeader({ tools }: { tools: ToolCallEvent[] }) {
  const touched = useMemo(() => {
    const seen = new Set<string>()
    for (const t of tools) {
      const label = touchedRecordLabel(t)
      if (label) seen.add(label)
    }
    return [...seen]
  }, [tools])

  if (!touched.length) return null

  return (
    <div className="mb-2 flex flex-wrap items-center gap-1.5 rounded-lg border border-brand-rule-soft bg-brand-card/70 px-2 py-1.5 text-[11px] text-brand-muted">
      <span className="mr-1 font-medium text-brand-ink/80">
        Changed {touched.length} {touched.length === 1 ? "record" : "records"}
      </span>
      {touched.slice(0, 6).map((label) => (
        <span
          key={label}
          title={label}
          className="inline-flex items-center gap-1 rounded border border-brand-accent/35 bg-brand-accent/10 px-1.5 py-0.5 font-mono text-[10.5px] text-brand-accent"
        >
          <PencilLine className="size-2.5" />
          <span className="max-w-40 truncate">{label}</span>
        </span>
      ))}
      {touched.length > 6 && (
        <span className="text-brand-muted-soft/70">+{touched.length - 6} more</span>
      )}
    </div>
  )
}

function WarningBanner({ ev }: { ev: WarningEvent }) {
  return (
    <div className="my-1 flex items-start gap-2 rounded-md border border-amber-300/40 bg-amber-50/40 px-3 py-2 text-[12px] text-amber-800">
      <AlertTriangle className="mt-0.5 size-3.5 shrink-0" />
      <span>{ev.text}</span>
    </div>
  )
}

function StreamErrorCard({ ev }: { ev: StreamErrorEvent }) {
  return (
    <div className="my-2 rounded-md border border-rose-300/50 bg-rose-50/40 px-3 py-2.5 text-[12.5px] text-rose-700">
      <div className="flex items-start gap-2">
        <AlertTriangle className="mt-0.5 size-3.5 shrink-0" />
        <div className="min-w-0 flex-1">
          <p className="font-medium">
            {ev.provider ? `${ev.provider} stream error` : "Stream error"}
          </p>
          <p className="mt-0.5 wrap-break-word text-brand-ink/80">
            {formatStreamErrorMessage(ev.message)}
          </p>
        </div>
      </div>
    </div>
  )
}

function SourceUrlPills({ urls }: { urls: SourceUrlEvent[] }) {
  if (!urls.length) return null
  return (
    <div className="mt-2">
      <div className="mb-1 text-[10px] font-medium uppercase tracking-wide text-brand-muted-soft/65">
        Sources
      </div>
      <div className="flex flex-wrap gap-1.5">
        {urls.map((u, i) => {
          let host = u.url
          try {
            host = new URL(u.url).hostname.replace(/^www\./, "")
          } catch {
            /* noop */
          }
          return (
            <a
              key={i}
              href={u.url}
              target="_blank"
              rel="noopener noreferrer"
              className="group inline-flex max-w-full items-center gap-1.5 rounded-md border border-brand-rule/60 bg-brand-card/40 px-2 py-1 text-[11.5px] text-brand-muted transition-colors hover:border-brand-accent/40 hover:bg-brand-cream-soft hover:text-brand-ink"
            >
              <span className="flex size-4 shrink-0 items-center justify-center rounded-sm bg-brand-cream text-[10px] font-semibold tabular-nums text-brand-muted-soft group-hover:bg-brand-accent/15 group-hover:text-brand-accent">
                {i + 1}
              </span>
              <span className="min-w-0 truncate">{u.title || host}</span>
              <span className="hidden shrink-0 font-mono text-[10.5px] text-brand-muted-soft/65 sm:inline">
                {host}
              </span>
              <ExternalLink className="size-3 shrink-0 opacity-60 group-hover:opacity-100" />
            </a>
          )
        })}
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Working indicator
// ---------------------------------------------------------------------------
function WorkingIndicator({ tool }: { tool?: ToolCallEvent }) {
  if (tool) {
    return (
      <div className="my-2 flex items-center gap-2 text-[12px] text-brand-muted">
        <ActivePulseDot />
        <span className="shimmer-text">
          {describeTool(tool.toolName, tool.args)}
        </span>
      </div>
    )
  }
  return (
    <div className="my-2 flex items-center gap-2 text-[12px] text-brand-muted">
      <Loader2 className="size-3 animate-spin text-brand-muted-soft" />
      <span className="shimmer-text">Working…</span>
    </div>
  )
}

// ---------------------------------------------------------------------------
// StreamingAssistantMessage — main assistant message body
// ---------------------------------------------------------------------------
export function StreamingAssistantMessage({
  message,
  isLoading,
  onRegenerate,
  onRespondToApproval,
}: {
  message: StreamingMessage
  isLoading: boolean
  onRegenerate?: () => void
  onRespondToApproval?: ApprovalResponder
}) {
  const isStreamingThis = isLoading && !message.isComplete
  const partsLen = message.orderedParts.length
  const segments = useMemo(
    () => buildSegments(message.orderedParts),
    [partsLen, isStreamingThis],
  )
  const renderGroups = useMemo(() => groupThinkingRuns(segments), [segments])

  const allText = useMemo(() => {
    return segments
      .filter(
        (s): s is { kind: "text"; events: TextDeltaEvent[] } => s.kind === "text",
      )
      .flatMap((s) => s.events)
      .map((e) => e.text)
      .join("")
  }, [segments])

  const showWorking = isStreamingThis && segments.length === 0
  const allTools = useMemo(
    () => segments.flatMap((s) => (s.kind === "tools" ? s.tools : [])),
    [segments],
  )
  const activeToolEvent = useMemo(
    () => allTools.find((t) => isActiveToolState(t.state)),
    [allTools],
  )

  return (
    <div
      className="group/msg py-2.5"
      data-chat-streaming={isStreamingThis ? "true" : undefined}
    >
      {showWorking && <WorkingIndicator tool={activeToolEvent} />}

      <WorkingSetHeader tools={allTools} />

      <div className="space-y-2">
        {renderGroups.map((seg, i) => {
          const isLastSeg = isStreamingThis && i === renderGroups.length - 1

          if (seg.kind === "thinking-run") {
            const hasActiveTool = seg.segments
              .flatMap((s) => (s.kind === "tools" ? s.tools : []))
              .some((t) => isActiveToolState(t.state))
            return (
              <ThinkingRun
                key={i}
                segments={seg.segments}
                active={isLastSeg || hasActiveTool}
                onRespond={onRespondToApproval}
              />
            )
          }
          if (seg.kind === "reasoning") {
            return (
              <ReasoningBlock
                key={i}
                reasoningEvents={seg.events}
                isStreaming={isLastSeg}
              />
            )
          }
          if (seg.kind === "tools") {
            return <ToolPartList key={i} tools={seg.tools} onRespond={onRespondToApproval} />
          }
          if (seg.kind === "text") {
            const text = seg.events.map((e) => e.text).join("")
            return text ? (
              <StreamingText key={i} text={text} isStreaming={isLastSeg} />
            ) : null
          }
          if (seg.kind === "sources") {
            return <SourceUrlPills key={i} urls={seg.urls} />
          }
          if (seg.kind === "progress") {
            return (
              <div key={i} className="text-[11.5px] text-brand-muted-soft/75">
                {seg.ev.label}
              </div>
            )
          }
          if (seg.kind === "warning") {
            return <WarningBanner key={i} ev={seg.ev} />
          }
          if (seg.kind === "stream-error") {
            return <StreamErrorCard key={i} ev={seg.ev} />
          }
          return null
        })}

        {allText && !isStreamingThis && (
          <MessageToolbar text={allText} onRegenerate={onRegenerate} />
        )}
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// MessageToolbar (copy / regenerate / thumbs / share)
// ---------------------------------------------------------------------------
function MessageToolbar({
  text,
  onRegenerate,
}: {
  text: string
  onRegenerate?: () => void
}) {
  const [copied, setCopied] = useState(false)
  const [feedback, setFeedback] = useState<"up" | "down" | null>(null)
  const [shared, setShared] = useState(false)

  const btn =
    "inline-flex h-7 w-7 items-center justify-center rounded-md text-brand-muted transition-colors hover:bg-brand-cream hover:text-brand-ink"

  return (
    <div className="mt-1 flex items-center gap-0.5 opacity-0 transition-opacity group-hover/msg:opacity-100 focus-within:opacity-100">
      <button
        type="button"
        onClick={() => {
          void navigator.clipboard.writeText(text)
          setCopied(true)
          setTimeout(() => setCopied(false), 1500)
        }}
        title={copied ? "Copied" : "Copy"}
        aria-label="Copy message"
        className={btn}
      >
        {copied ? (
          <Check className="size-3.5 text-emerald-600" />
        ) : (
          <Copy className="size-3.5" />
        )}
      </button>
      {onRegenerate && (
        <button
          type="button"
          onClick={onRegenerate}
          title="Regenerate"
          aria-label="Regenerate response"
          className={btn}
        >
          <RefreshCw className="size-3.5" />
        </button>
      )}
      <span className="mx-1 h-4 w-px bg-brand-rule/60" aria-hidden />
      <button
        type="button"
        onClick={() => setFeedback((f) => (f === "up" ? null : "up"))}
        title="Good response"
        aria-label="Good response"
        aria-pressed={feedback === "up"}
        className={cn(btn, feedback === "up" && "bg-brand-accent/10 text-brand-accent")}
      >
        <ThumbsUp className="size-3.5" />
      </button>
      <button
        type="button"
        onClick={() => setFeedback((f) => (f === "down" ? null : "down"))}
        title="Bad response"
        aria-label="Bad response"
        aria-pressed={feedback === "down"}
        className={cn(btn, feedback === "down" && "bg-rose-50 text-rose-600")}
      >
        <ThumbsDown className="size-3.5" />
      </button>
      <button
        type="button"
        onClick={() => {
          void navigator.clipboard.writeText(text)
          setShared(true)
          setTimeout(() => setShared(false), 1500)
        }}
        title={shared ? "Link copied" : "Share"}
        aria-label="Share message"
        className={btn}
      >
        {shared ? (
          <Check className="size-3.5 text-emerald-600" />
        ) : (
          <Share2 className="size-3.5" />
        )}
      </button>
    </div>
  )
}

// ---------------------------------------------------------------------------
// UserMessage — right-aligned bubble with attachment chips
// ---------------------------------------------------------------------------
function UserMessage({
  text,
  attachments,
}: {
  text: string
  attachments?: MessageAttachment[]
}) {
  return (
    <div className="group/user mt-4 mb-2 flex flex-col items-end">
      {attachments && attachments.length > 0 && (
        <FilePartList attachments={attachments} />
      )}
      {text && (
        <div className="max-w-[80%] rounded-2xl rounded-tr-sm bg-brand-card border border-brand-rule px-4 py-2.5 shadow-sm">
          <p className="whitespace-pre-wrap wrap-break-word text-[15px] leading-[1.65] text-brand-ink">
            {text}
          </p>
        </div>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// ChatMessageRow
// ---------------------------------------------------------------------------
const ChatMessageRow = memo(
  function ChatMessageRow({
    message,
    isLoading,
    onRegenerate,
  }: {
    message: StreamingMessage
    isLoading: boolean
    onRegenerate?: () => void
  }) {
    if (message.role === "user") {
      const text = message.orderedParts
        .filter((p) => p.type === "text-delta")
        .map((p) => (p as TextDeltaEvent).text)
        .join("")
      return <UserMessage text={text} attachments={message.attachments} />
    }
    return (
      <StreamingAssistantMessage
        message={message}
        isLoading={isLoading}
        onRegenerate={onRegenerate}
      />
    )
  },
  (prev, next) => {
    if (prev.message.id !== next.message.id) return false
    if (prev.message.orderedParts.length !== next.message.orderedParts.length)
      return false
    if (prev.message.isComplete !== next.message.isComplete) return false
    if (prev.isLoading !== next.isLoading) return false
    if (next.isLoading && !next.message.isComplete) return false
    return true
  },
)

// ---------------------------------------------------------------------------
// StreamingChatMessageList — public component
// ---------------------------------------------------------------------------
export interface StreamingChatMessageListProps {
  messages: StreamingMessage[]
  isLoading: boolean
  onRegenerate?: () => void
}

export function StreamingChatMessageList({
  messages,
  isLoading,
  onRegenerate,
}: StreamingChatMessageListProps) {
  return (
    <div className="flex flex-col gap-1 pb-4">
      {messages.map((message, idx) => (
        <ChatMessageRow
          key={message.id}
          message={message}
          isLoading={isLoading}
          onRegenerate={
            idx === messages.length - 1 && message.role === "assistant"
              ? onRegenerate
              : undefined
          }
        />
      ))}
    </div>
  )
}

export {
  fromUIMessage,
  type StreamingMessage,
  type StreamPart,
  type ToolCallEvent,
  type ReasoningPartEvent,
  type TextDeltaEvent,
  type SourceUrlEvent,
  type MessageAttachment,
} from "./types"
