"use client";

/**
 * ToolPart — Copilot-style row that describes what the agent did.
 *
 * Features:
 *   - per-tool icon (read_file = FileText, search = Search, etc.)
 *   - present-tense label while running, past-tense once complete
 *   - small target pill (path / repo / query / command) inline
 *   - collapsible Input / Output / Error drawers with JSON viewer,
 *     chart detection, and download buttons for file outputs
 *   - VS Code-style active pulse + relative rail in ToolPartList
 */

import { useEffect, useMemo, useRef, useState } from "react";
import {
  AlertCircle,
  Check,
  Loader2,
  X,
  ChevronRight,
  Circle,
  FileText,
  Search,
  Globe,
  Mail,
  Truck,
  Banknote,
  Receipt,
  Users,
  ShieldCheck,
  Cable,
  Building2,
  HelpCircle,
  BookOpen,
  Calendar,
  Cpu,
  Workflow,
  Mic,
  Image as ImageIcon,
  PencilLine,
  Terminal,
  FolderOpen,
  Sparkles,
  Wrench,
  Download,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { JsonViewer } from "./json-viewer";
import type {
  ApprovalResponder,
  ToolCallEvent,
  ToolCallState,
} from "../types"

// ---------------------------------------------------------------------------
// Per-tool icon map (Copilot-style: file = FileText, search = Search, etc.)
// ---------------------------------------------------------------------------
const TOOL_ICONS: Record<string, typeof FileText> = {
  // reads / writes / searches
  read_file: FileText,
  workspace_file_read: FileText,
  list_dir: FolderOpen,
  workspace_list: FolderOpen,
  search: Search,
  grep_search: Search,
  workspace_grep: Search,
  apply_patch: PencilLine,
  write_file: PencilLine,
  workspace_file_write: PencilLine,
  create_file: FileText,

  // exec
  exec: Terminal,
  run_command: Terminal,

  // web
  web_search: Globe,
  web_request: Globe,
  web_fetch: Globe,
  tavily_search: Globe,

  // memory
  memory_search: Sparkles,
  memory_remember: Sparkles,
  memory_forget: Sparkles,

  // subagents
  spawn_subagent: Workflow,
  discover_skills: Workflow,

  // generated media
  generate_image: ImageIcon,
  generate_video: ImageIcon,
  text_to_speech: Mic,

  // ── TMS tools (Muvx) ─────────────────────────────────────────────
  bookLoad: Truck,
  draftLoad: Truck,
  queryLoads: Truck,
  updateLoad: PencilLine,
  updateLoadDocs: PencilLine,
  dispatchTrip: Truck,
  updateTripStatus: PencilLine,

  getFleetStatus: Users,
  createDriver: Users,
  updateDriver: PencilLine,
  createTruck: Truck,
  updateTruck: PencilLine,
  createTrailer: Truck,

  queryCustomers: Building2,
  createCustomer: Building2,
  queryCarriers: Truck,
  createCarrier: Truck,

  queryInvoices: Receipt,
  createInvoice: Receipt,
  sendInvoiceEmail: Mail,
  markInvoicePaid: Banknote,
  getMissingPods: FileText,

  reviewPendingExpenses: Banknote,
  approveExpense: Banknote,
  logTripExpense: Banknote,

  listWorkspaceMembers: Users,
  inviteWorkspaceMember: Users,
  resendInvitation: Mail,
  cancelInvitation: Wrench,
  updateMemberRole: PencilLine,
  removeMember: Users,

  queryAuditLogs: ShieldCheck,
  checkIntegrations: Cable,
  searchFreightKnowledge: BookOpen,

  createExecutionPlan: Workflow,
  delegateSubtask: Workflow,
  askDispatcher: HelpCircle,

  assignDriverTask: Cpu,
  askDriverQuestion: Mail,
  scheduleCoworkerTask: Calendar,
  listScheduledTasks: Calendar,

  saveCopilotMemory: Sparkles,
  recallCopilotMemory: Search,
};

const ACTIVE_TOOL_STATES = [
  "calling",
  "input-streaming",
  "input-available",
  "executing",
] as const;

function isActiveToolState(state: ToolCallState | string) {
  return ACTIVE_TOOL_STATES.includes(state as (typeof ACTIVE_TOOL_STATES)[number])
}

/**
 * How long this step has been running, in whole seconds. Ticks while the
 * tool is active, then freezes at the final duration so a finished row
 * still says how long it took. The clock starts the first time we see the
 * row active, so replayed/persisted history (never active) shows nothing.
 */
function useStepDuration(active: boolean): number | undefined {
  const startRef = useRef<number | null>(null)
  const [secs, setSecs] = useState<number | undefined>(undefined)

  useEffect(() => {
    if (!active) return
    if (startRef.current === null) startRef.current = Date.now()
    const tick = () =>
      setSecs(Math.floor((Date.now() - (startRef.current ?? Date.now())) / 1000))
    tick()
    const id = setInterval(tick, 500)
    return () => {
      clearInterval(id)
      // Freeze at the real elapsed time (min 1s so fast tools don't read "0s").
      if (startRef.current !== null) {
        setSecs(Math.max(1, Math.round((Date.now() - startRef.current) / 1000)))
      }
    }
  }, [active])

  return secs
}

function formatDuration(s: number): string {
  return s < 60 ? `${s}s` : `${Math.floor(s / 60)}m ${s % 60}s`
}

/**
 * Count of rows a tool came back with, for the ", 12 results" suffix.
 * Looks at the array itself or the usual envelope keys our TMS tools use.
 */
function resultCount(result: unknown): number | undefined {
  if (Array.isArray(result)) return result.length
  if (result && typeof result === "object") {
    for (const key of ["results", "items", "rows", "matches", "data", "loads", "drivers"]) {
      const v = (result as Record<string, unknown>)[key]
      if (Array.isArray(v)) return v.length
    }
  }
  return undefined
}
/** True while the operator still owes us a decision. */
function isAwaitingApproval(tool: ToolCallEvent): boolean {
  return tool.state === "approval-requested"
}

/** True once a decision is in and the SDK is executing or has executed it. */
function isApprovalResolved(tool: ToolCallEvent): boolean {
  return (
    tool.state === "approval-responded" ||
    tool.state === "output-available" ||
    tool.state === "output-error"
  ) && tool.approval?.approved !== undefined
}

/**
 * ApprovalCard — the interactive gate for write operations.
 *
 * This is the ONLY interactive surface in an assistant message. Without it
 * the operator sees a stalled tool row with no way to proceed, which reads
 * as "the agent stopped". Rendered inside the tool row so the pending
 * action, its inputs, and its consequence are visible together.
 */
function ApprovalCard({
  tool,
  onRespond,
}: {
  tool: ToolCallEvent
  onRespond?: ApprovalResponder
}) {
  const approval = tool.approval
  if (!approval) return null

  const answered = isApprovalResolved(tool)
  const approved = approval.approved === true
  const rejected = approval.approved === false

  return (
    <div
      className={cn(
        "mt-1.5 overflow-hidden rounded-lg border transition-colors",
        answered && approved && "border-emerald-300/50 bg-emerald-50/30",
        answered && rejected && "border-rose-300/50 bg-rose-50/30",
        !answered && "border-brand-accent/35 bg-brand-accent/[0.06]",
      )}
    >
      {!answered ? (
        <>
          <div className="flex items-start gap-2 px-3 py-2.5">
            <ShieldCheck className="mt-0.5 size-3.5 shrink-0 text-brand-accent" />
            <div className="min-w-0 flex-1">
              <p className="text-[12.5px] font-medium text-brand-ink">
                {approval.requestReason ??
                  `Approve ${describeTool(tool.toolName, tool.args).toLowerCase()}?`}
              </p>
              <p className="mt-0.5 text-[11px] text-brand-muted-soft">
                This writes to your live operational data.
              </p>
            </div>
          </div>
          <div className="flex items-center justify-end gap-2 border-t border-brand-accent/20 px-3 py-2">
            <button
              type="button"
              onClick={() =>
                onRespond?.({
                  id: approval.id,
                  approved: false,
                  toolName: tool.toolName,
                  source: "tool-approval-card",
                })
              }
              className="rounded-md border border-brand-rule bg-brand-card px-3 py-1.5 text-[12px] font-medium text-brand-muted transition-colors hover:border-brand-ink/25 hover:text-brand-ink"
            >
              Reject
            </button>
            <button
              type="button"
              onClick={() =>
                onRespond?.({
                  id: approval.id,
                  approved: true,
                  toolName: tool.toolName,
                  source: "tool-approval-card",
                })
              }
              className="rounded-md bg-brand-ink px-3 py-1.5 text-[12px] font-medium text-brand-cream transition-colors hover:bg-brand-ink-soft"
            >
              Approve
            </button>
          </div>
        </>
      ) : (
        <div className="flex items-center gap-2 px-3 py-2 text-[12px]">
          {approved ? (
            <>
              <Check className="size-3.5 shrink-0 text-emerald-600" />
              <span className="text-brand-muted">
                Approved — executing{" "}
                {describeTool(tool.toolName, tool.args).toLowerCase()}
              </span>
            </>
          ) : (
            <>
              <X className="size-3.5 shrink-0 text-rose-600" />
              <span className="text-brand-muted">
                Rejected — {describeTool(tool.toolName, tool.args).toLowerCase()}{" "}
                was not run
              </span>
            </>
          )}
        </div>
      )}
    </div>
  )
}
function ActivePulseDot() {
  // The ping ring and the dot are the same size and both absolutely centred,
  // so the ring expands around the dot rather than nudging it off-centre.
  return (
    <span className="relative flex size-2 items-center justify-center">
      <span className="absolute inset-0 rounded-full bg-brand-accent/25 animate-ping" />
      <Circle className="relative size-2 fill-brand-accent text-brand-accent animate-pulse" />
    </span>
  );
}

// ---------------------------------------------------------------------------
// Per-tool invocation formatter.
// ---------------------------------------------------------------------------
function basename(p: string): string {
  const i = Math.max(p.lastIndexOf("/"), p.lastIndexOf("\\"))
  return i >= 0 ? p.slice(i + 1) : p
}
function asString(v: unknown): string | undefined {
  return typeof v === "string" && v.length > 0 ? v : undefined
}
function quote(s: string, max = 56): string {
  const t = s.length > max ? `${s.slice(0, max)}…` : s
  return `"${t}"`
}

export function describeTool(
  toolName: string,
  args?: Record<string, unknown>,
): string {
  const a = args ?? {}
  const path = asString(a.path) ?? asString(a.filePath) ?? asString(a.filename)
  const query = asString(a.query) ?? asString(a.search) ?? asString(a.q)
  const cmd = asString(a.command) ?? asString(a.cmd)

  // Generic file-style
  if (path && /read|file/i.test(toolName)) {
    return `Reading ${basename(path)}`
  }
  if (path && /write|create_file|apply_patch|update|edit/i.test(toolName)) {
    return `Editing ${basename(path)}`
  }

  switch (toolName) {
    case "search":
    case "grep_search":
    case "workspace_grep":
      return query ? `Searching for ${quote(query)}` : "Searching files"

    case "exec":
    case "run_command":
      return cmd ? `Running ${quote(cmd, 64)}` : "Running command"

    case "web_search":
    case "tavily_search":
      return query ? `Searching the web for ${quote(query)}` : "Searching the web"
    case "web_fetch":
    case "web_request":
      return asString(a.url) ? `Fetching ${asString(a.url)}` : "Making web request"

    case "spawn_subagent":
      return `Delegating to ${asString(a.agent) ?? "sub-agent"}`

    case "generate_image":
      return "Generating image"
    case "generate_video":
      return "Generating video"
    case "text_to_speech":
      return "Generating audio"

    // TMS-specific labels
    case "bookLoad":
      return "Booking load"
    case "draftLoad":
      return "Drafting load"
    case "queryLoads":
      return "Searching loads"
    case "updateLoad":
      return "Updating load"
    case "updateLoadDocs":
      return "Updating load documents"
    case "dispatchTrip":
      return "Dispatching trip"
    case "updateTripStatus":
      return "Updating trip status"

    case "getFleetStatus":
      return "Checking fleet status"
    case "createDriver":
      return "Adding driver"
    case "updateDriver":
      return "Updating driver"
    case "createTruck":
      return "Adding tractor"
    case "updateTruck":
      return "Updating tractor"
    case "createTrailer":
      return "Adding trailer"

    case "queryCustomers":
      return "Searching customers"
    case "createCustomer":
      return "Adding customer"
    case "queryCarriers":
      return "Searching carriers"
    case "createCarrier":
      return "Adding carrier"

    case "queryInvoices":
      return "Searching invoices"
    case "createInvoice":
      return "Generating invoice"
    case "sendInvoiceEmail":
      return "Sending invoice email"
    case "markInvoicePaid":
      return "Recording payment"
    case "getMissingPods":
      return "Checking missing PODs"

    case "reviewPendingExpenses":
      return "Reviewing pending expenses"
    case "approveExpense":
      return "Approving expense"
    case "logTripExpense":
      return "Logging trip expense"

    case "listWorkspaceMembers":
      return "Listing workspace members"
    case "inviteWorkspaceMember":
      return "Inviting member"
    case "resendInvitation":
      return "Resending invitation"
    case "cancelInvitation":
      return "Cancelling invitation"
    case "updateMemberRole":
      return "Updating member role"
    case "removeMember":
      return "Removing member"

    case "queryAuditLogs":
      return "Reviewing audit log"
    case "checkIntegrations":
      return "Checking integrations"
    case "searchFreightKnowledge":
      return "Searching freight knowledge"

    case "createExecutionPlan":
      return "Building execution plan"
    case "delegateSubtask":
      return "Delegating subtask"
    case "askDispatcher":
      return "Asking dispatcher"

    case "assignDriverTask":
      return "Assigning driver task"
    case "askDriverQuestion":
      return "Asking driver"
    case "scheduleCoworkerTask":
      return "Scheduling checkup"
    case "listScheduledTasks":
      return "Listing scheduled tasks"

    case "saveCopilotMemory":
      return "Saving memory"
    case "recallCopilotMemory":
      return "Recalling memory"

    default:
      if (path) return `${toolName} ${basename(path)}`
      if (query) return `${toolName} ${quote(query)}`
      return toolName
  }
}

function ToolIcon({
  toolName,
  state,
  className,
}: {
  toolName: string
  state: ToolCallState
  className?: string
}) {
  const error = state === "output-error"

  // Every icon is size-3.5 in the same 4-unit slot, so swapping between
  // spinner / tool glyph / check never shifts the row's left edge.
  if (error) {
    return <AlertCircle className={cn("size-3.5 text-rose-600", className)} />
  }
  if (isActiveToolState(state)) {
    return (
      <Loader2 className={cn("size-3.5 animate-spin text-brand-accent", className)} />
    )
  }
  if (state === "output-available") {
    return <Check className={cn("size-3.5 text-brand-success", className)} />
  }
  const Icon = TOOL_ICONS[toolName] ?? Wrench
  return <Icon className={cn("size-3.5 text-brand-muted-soft", className)} />
}

function formatJson(v: unknown): string {
  try {
    return JSON.stringify(v, null, 2)
  } catch {
    return String(v)
  }
}

/**
 * TruncatedBlock — long monospace payload capped with a fade instead of a
 * scroll box, plus a "Show N more lines" pill. A nested scroller inside a
 * chat transcript steals the page's wheel events; a fade doesn't.
 */
function TruncatedBlock({
  text,
  collapsedLines = 12,
  label = "lines",
  tone = "default",
}: {
  text: string
  collapsedLines?: number
  label?: string
  tone?: "default" | "error"
}) {
  const [expanded, setExpanded] = useState(false)
  const total = useMemo(() => text.split("\n").length, [text])
  const overflow = total > collapsedLines
  const hidden = overflow ? total - collapsedLines : 0

  return (
    <div className="relative">
      <div
        className={cn(
          "overflow-hidden transition-[max-height] duration-200",
          overflow &&
            !expanded &&
            "max-h-52 mask-[linear-gradient(to_bottom,#000_calc(100%-36px),transparent)]",
        )}
      >
        <pre
          className={cn(
            "overflow-x-auto whitespace-pre-wrap break-all rounded-md border px-2.5 py-1.5 font-mono text-[11.5px] leading-relaxed",
            tone === "error"
              ? "border-rose-300/40 bg-rose-50/50 text-rose-700"
              : "border-brand-rule/50 bg-brand-cream-soft text-brand-muted",
          )}
        >
          {text}
        </pre>
      </div>
      {overflow && (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation()
            setExpanded((v) => !v)
          }}
          className="mt-1 inline-flex items-center gap-1 rounded-md border border-brand-rule bg-brand-cream-soft px-1.5 py-0.5 text-[10.5px] font-medium text-brand-muted transition-colors hover:border-brand-accent/40 hover:text-brand-ink"
        >
          {expanded ? "Show less" : `Show ${hidden} more ${label}`}
        </button>
      )}
    </div>
  )
}

export function ToolPart({
  tool,
  onRespond,
}: {
  tool: ToolCallEvent
  onRespond?: ApprovalResponder
}) {
  const [open, setOpen] = useState(false)
  const error = tool.state === "output-error"
  const isPending = isActiveToolState(tool.state)
  // While awaiting approval, open the drawer automatically — the operator
  // needs to see WHAT they are approving, not just the tool name.
  const awaiting = isAwaitingApproval(tool)

  const label = describeTool(tool.toolName, tool.args)
  const duration = useStepDuration(isPending)
  const count = isPending ? undefined : resultCount(tool.result)

  // Pull a short mono "target" out of args.
  const a = tool.args ?? {}
  const target =
    asString(a.path) ??
    asString(a.filePath) ??
    asString(a.filename) ??
    asString(a.url) ??
    asString(a.domain) ??
    asString(a.query) ??
    asString(a.search) ??
    asString(a.q) ??
    asString(a.command) ??
    asString(a.cmd) ??
    [asString(a.originCity), asString(a.destCity)].filter(Boolean).join(" → ")
  const targetShort = target
    ? target.length > 64
      ? `…${target.slice(-61)}`
      : target
    : undefined

  const hasDetails =
    (tool.args && Object.keys(tool.args).length > 0) || tool.result != null

  return (
    <div className="group/tool relative">
      <button
        type="button"
        onClick={() => hasDetails && setOpen((v) => !v)}
        disabled={!hasDetails}
        className={cn(
          "flex w-full max-w-full items-start gap-2.5 py-1 text-left text-[13px] text-brand-muted transition-colors",
          hasDetails && "hover:text-brand-ink",
          "disabled:cursor-default",
        )}
      >
        <span className="mt-0.5 flex size-4 shrink-0 items-center justify-center">
          <ToolIcon toolName={tool.toolName} state={tool.state} />
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex min-w-0 items-center gap-2">
            <span
              className={cn(
                "truncate",
                error && "text-rose-600",
                isPending && !error && "animate-pulse text-brand-ink/85",
              )}
            >
              {label}
              {count != null && (
                <span className="text-brand-muted-soft/75">
                  , {count} {count === 1 ? "result" : "results"}
                </span>
              )}
            </span>
            {targetShort && (
              <span className="min-w-0 truncate font-mono text-[11px] text-brand-muted-soft/60">
                {targetShort}
              </span>
            )}
            {awaiting && (
              <span className="ml-1.5 shrink-0 rounded-full border border-brand-accent/35 bg-brand-accent/10 px-1.5 py-0.5 text-[10px] font-medium text-brand-accent">
                Awaiting approval
              </span>
            )}
            {duration != null && !awaiting && (
              <span className="ml-auto shrink-0 font-mono text-[10px] tabular-nums text-brand-muted-soft/55">
                {formatDuration(duration)}
              </span>
            )}
            {hasDetails && (
              <ChevronRight
                className={cn(
                  "size-3 shrink-0 text-brand-muted-soft/55 transition-transform",
                  duration == null || awaiting ? "ml-auto" : "ml-1",
                  (open || awaiting) && "rotate-90",
                )}
              />
            )}
          </div>
        </div>
      </button>

      {awaiting && <ApprovalCard tool={tool} onRespond={onRespond} />}

      <div
        className={cn(
          "grid transition-[grid-template-rows,opacity] duration-200 ease-out",
          (open || awaiting) && hasDetails
            ? "grid-rows-[1fr] opacity-100"
            : "grid-rows-[0fr] opacity-0",
        )}
      >
        <div className="overflow-hidden">
          <div className="ml-6 mt-1 mb-1 space-y-2 border-l border-brand-rule/60 pl-3">
            {tool.args && Object.keys(tool.args).length > 0 && (
              <div>
                <div className="text-[10px] font-medium uppercase tracking-wide text-brand-muted-soft/65">
                  Input
                </div>
                <div className="mt-1">
                  <TruncatedBlock text={formatJson(tool.args)} />
                </div>
              </div>
            )}
            {tool.result != null && (
              <div>
                <div className="text-[10px] font-medium uppercase tracking-wide text-brand-muted-soft/65">
                  Output
                </div>
                {/* Download button for create_file tool */}
                {typeof tool.result === "object" &&
                  tool.result !== null &&
                  "download_url" in (tool.result as Record<string, unknown>) && (
                    <a
                      href={String(
                        (tool.result as Record<string, unknown>).download_url,
                      )}
                      download={
                        ((tool.result as Record<string, unknown>)
                          .filename as string) ?? "download"
                      }
                      target="_blank"
                      rel="noopener noreferrer"
                      className="mt-2 mb-2 inline-flex items-center gap-2 rounded-lg border border-brand-accent/30 bg-brand-accent/5 px-3 py-2 text-sm font-medium text-brand-accent transition-colors hover:bg-brand-accent/10 hover:border-brand-accent/50"
                    >
                      <Download className="size-4" />
                      Download{" "}
                      {((tool.result as Record<string, unknown>)
                        .filename as string) ?? "file"}
                    </a>
                  )}
                {typeof tool.result === "string" ? (
                  <div className="mt-1">
                    <TruncatedBlock text={tool.result} />
                  </div>
                ) : (
                  <JsonViewer
                    data={tool.result}
                    className="mt-1 max-h-72 overflow-auto"
                  />
                )}
              </div>
            )}
            {error && tool.errorText && (
              <div>
                <div className="text-[10px] font-medium uppercase tracking-wide text-rose-600/80">
                  Error
                </div>
                <div className="mt-1">
                  <TruncatedBlock text={tool.errorText} tone="error" collapsedLines={8} />
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

export function ToolPartList({
  tools,
  onRespond,
}: {
  tools: ToolCallEvent[]
  onRespond?: ApprovalResponder
}) {
  const [expanded, setExpanded] = useState(false)
  if (!tools.length) return null

  // Never collapse a list that contains a pending approval — hiding the
  // Approve button behind "show N earlier steps" is a dead end.
  const hasPendingApproval = tools.some(isAwaitingApproval)
  const collapsible = tools.length > 4 && !hasPendingApproval
  const visible = collapsible && !expanded ? tools.slice(-3) : tools
  const hidden = tools.length - visible.length

  return (
    <div className="relative ml-0.5 pl-3">
      {collapsible && !expanded && hidden > 0 && (
        <button
          type="button"
          onClick={() => setExpanded(true)}
          className="mb-0.5 flex items-center gap-1 text-[11.5px] text-brand-muted-soft/75 transition-colors hover:text-brand-ink"
        >
          <ChevronRight className="size-3" />
          <span>
            Show {hidden} earlier {hidden === 1 ? "step" : "steps"}
          </span>
        </button>
      )}

      {visible.map((tool, index) => {
        const active = isActiveToolState(tool.state)
        const error = tool.state === "output-error"
        const awaiting = isAwaitingApproval(tool)
        const only = visible.length === 1
        const first = index === 0
        const last = index === visible.length - 1
        return (
          <div key={`${tool.toolCallId}-${index}`} className="relative">
            {/* VS Code chat rail: a solid 1px vertical line with a 8px gap
                where the status dot sits. The line stops short of the first
                and last dot so it never dangles past the final step. Plain
                inset maths — no gradient masks, so it renders identically in
                every browser and stays crisp at 1x. */}
            <span
              aria-hidden
              className={cn(
                "absolute -left-3 w-px bg-brand-rule",
                only && !active && "hidden",
                // Starts/stops at the dot centre (14px from the row top),
                // so the rail meets the dot instead of overshooting it.
                only && active && "top-3.5 bottom-0",
                !only && first && "top-3.5 bottom-0",
                !only && last && "top-0 bottom-3.5",
                !only && !first && !last && "top-0 bottom-0",
              )}
            />
            {/* Status dot: hollow ring at rest, filled + pulsing while active,
                red on error, accent-filled while an approval is pending.

                Alignment: the row is `py-1` (4px) and its icon is `mt-0.5`
                (2px) on a `size-4` (16px) box, so the icon's centre sits
                28px/2 = 14px from the row top. This slot is a 28px-tall flex
                box pinned to the row top, which puts its centre on exactly
                that line — and because BOTH dot states centre inside the same
                slot, the dot no longer shifts when a step starts or finishes.
                (It used to be a 10px box holding a 12px pulse dot.) */}
            <span className="absolute -left-4.5 top-0 flex h-7 w-3 items-center justify-center bg-brand-cream">
              {active || awaiting ? (
                <ActivePulseDot />
              ) : (
                <Circle
                  className={cn(
                    "size-1.75 border",
                    error
                      ? "border-rose-500 bg-rose-500"
                      : "border-brand-muted-soft/60 bg-transparent",
                  )}
                />
              )}
            </span>
            <ToolPart tool={tool} onRespond={onRespond} />
          </div>
        )
      })}
    </div>
  )
}
