"use client";

import { useChat } from "@ai-sdk/react";
import {
  isTextUIPart,
  isReasoningUIPart,
  isDataUIPart,
  isFileUIPart,
  isToolUIPart,
  type DynamicToolUIPart,
  type FileUIPart,
  type UIMessage,
  type LanguageModelUsage,
} from "ai";
import { useCallback, useEffect, useState, useRef, useMemo, Fragment } from "react";
import { cn } from "@/lib/utils";
import AI_Input_Search from "@/components/kokonutui/ai-input-search";
import {
  Conversation,
  ConversationContent,
  ConversationEmptyState,
  ConversationScrollButton,
} from "@/components/ai-elements/conversation";
import {
  Message,
  MessageContent,
  MessageResponse,
  MessageToolbar,
  MessageActions,
  MessageAction,
} from "@/components/ai-elements/message";
import {
  Plan,
  PlanHeader,
  PlanTitle,
  PlanDescription,
  PlanAction,
  PlanTrigger,
  PlanContent,
} from "@/components/ai-elements/plan";
import {
  ChainOfThought,
  ChainOfThoughtHeader,
  ChainOfThoughtStep,
  ChainOfThoughtSearchResults,
  ChainOfThoughtSearchResult,
  ChainOfThoughtContent,
} from "@/components/ai-elements/chain-of-thought";
import {
  Reasoning,
  ReasoningTrigger,
  ReasoningContent,
} from "@/components/ai-elements/reasoning";
import {
  Confirmation,
  ConfirmationTitle,
  ConfirmationRequest,
  ConfirmationAccepted,
  ConfirmationRejected,
  ConfirmationActions,
  ConfirmationAction,
} from "@/components/ai-elements/confirmation";
import {
  Task,
  TaskTrigger,
  TaskContent,
  TaskItem,
} from "@/components/ai-elements/task";
import {
  Question,
  QuestionPrompt,
  QuestionDescription,
  QuestionOptions,
  QuestionOption,
  QuestionActions,
  QuestionSubmit,
} from "@/components/ai-elements/question";
import {
  Sources,
  SourcesTrigger,
  SourcesContent,
  Source,
} from "@/components/ai-elements/sources";
import {
  Checkpoint,
  CheckpointIcon,
} from "@/components/ai-elements/checkpoint";
import type { AIModelItem } from "@/components/ai/model-picker";
import {
  ToolCallsSection,
  type ToolCallEntry,
} from "@/components/ui/tool-calls-section";
import {
  Tool,
  ToolContent,
  ToolHeader,
  ToolInput,
  ToolOutput,
  type ToolPart,
} from "@/components/ai-elements/tool";
import { Button } from "@/components/ui/button";
import {
  MessageFileAttachment,
  type StoredFilePart,
} from "@/components/chat/message-file-attachment";
import {
  Context,
  ContextTrigger,
  ContextContent,
  ContextContentHeader,
  ContextContentBody,
  ContextContentFooter,
  ContextInputUsage,
  ContextOutputUsage,
  ContextReasoningUsage,
  ContextCacheUsage,
} from "@/components/ai-elements/context";
import {
  Attachments,
  Attachment,
  AttachmentPreview,
} from "@/components/ai-elements/attachments";
import {
  uploadFilesToS3,
  refreshAttachmentUrl,
} from "@/lib/copilot/upload";
import {
  traceDebug,
  traceError,
  traceGroup,
  traceInfo,
  traceWarn,
  describePart,
} from "@/lib/copilot/client-trace";
import { Shimmer } from "@/components/ai-elements/shimmer";
import {
  StreamingAssistantMessage,
  fromUIMessage,
} from "@/components/copilot/agent/streaming-message";
import {
  MessageSquare,
  Sparkles,
  Copy,
  Check,
  CheckIcon,
  XIcon,
  Truck,
  ArrowRight,
  ShieldCheck,
  Cpu,
  CheckCircle2,
  Clock,
  Layers,
  Search,
  Users,
  Route,
  HelpCircle,
  Receipt,
  Banknote,
  FileWarning,
  Cable,
  Mail,
  ExternalLink,
  UserPlus,
  Building2,
CircleDollarSign,
  Brain,
  Package,
  PackagePlus,
  Wrench,
  Calendar,
  FileText,
  ListChecks,
  Shield,
  DownloadIcon,
} from "lucide-react";
import { MuvxBot, type BotMood, type BotCoat, type BotRole } from "@/components/ai/muvx-bot";

/** Default provider (OpenRouter preferred when API key is present). */
const DEFAULT_PROVIDER = "openrouter";

export interface BotSpecialist {
  id: BotRole;
  name: string;
  title: string;
  coat: BotCoat;
  icon: any;
  prompt: string;
  description: string;
  tagline: string;
}

export const SPECIALIST_TEAMS: BotSpecialist[] = [
  {
    id: "main",
    name: "Master Muvx",
    title: "Operations Intelligence",
    coat: "ink",
    icon: Sparkles,
    prompt: "Provide an operational status report across active loads, fleet availability, and missing PODs.",
    description: "Orchestrates all TMS modules with full autonomous agency.",
    tagline: "Master freight orchestrator",
  },
  {
    id: "dispatcher",
    name: "Load Dispatcher",
    title: "Freight Dispatch & Routing",
    coat: "indigo",
    icon: Route,
    prompt: "Show available loads needing coverage and match available drivers.",
    description: "Tender booking, multi-stop routing, driver assignments.",
    tagline: "Rate negotiation & route dispatch",
  },
  {
    id: "fleet_guardian",
    name: "Fleet Guardian",
    title: "HOS & FMCSA Safety",
    coat: "emerald",
    icon: ShieldCheck,
    prompt: "Audit fleet safety: check driver CDL expirations and HOS duty limits.",
    description: "Driver duty status, CDL expirations, 34-hour restart rules.",
    tagline: "FMCSA safety & duty logs",
  },
  {
    id: "rate_auditor",
    name: "Rate & Billing Auditor",
    title: "Factoring & Financials",
    coat: "amber",
    icon: Banknote,
    prompt: "Audit delivered loads missing signed PODs and overdue customer invoices.",
    description: "Rate confirmation audit, factoring receipts, AP expenses.",
    tagline: "Receivables, PODs & factoring",
  },
  {
    id: "safety_compliance",
    name: "Logistics Hub",
    title: "Telematics & Connectors",
    coat: "grove",
    icon: Cable,
    prompt: "Check connection status and latency for Samsara, Motive, and DAT One.",
    description: "Samsara GPS telemetry, Motive ELDs, loadboards & Resend.",
    tagline: "Live telemetry & loadboards",
  },
];



function CopyButton({ message }: { message: UIMessage }) {
  const [copied, setCopied] = useState(false);
  const handleCopy = () => {
    const text = message.parts
      .filter((p) => isTextUIPart(p))
      .map((p) => (p as { text: string }).text)
      .join("\n");
    if (text) {
      navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <MessageAction
      tooltip={copied ? "Copied to clipboard" : "Copy response"}
      onClick={handleCopy}
    >
      {copied ? (
        <Check className="size-3.5 text-emerald-600" />
      ) : (
        <Copy className="size-3.5 text-muted-foreground" />
      )}
    </MessageAction>
  );
}

/**
 * Context window meter.
 *
 * Sums the per-message token usage the server attaches through
 * `messageMetadata` and renders the official <Context> hover card: a
 * utilisation ring plus input / output / reasoning / cache breakdown and an
 * estimated cost. Hidden entirely until the first assistant response lands so
 * the input bar stays clean on an empty chat.
 */
function TokenContextMeter({ messages }: { messages: UIMessage[] }) {
  const latest = useMemo(() => {
    for (let i = messages.length - 1; i >= 0; i--) {
      const usage = (messages[i].metadata as { totalUsage?: LanguageModelUsage })
        ?.totalUsage;
      if (usage) return usage;
    }
    return null;
  }, [messages]);

  if (!latest) return null;

  // Provider models route through OpenRouter, so nominal window sizes vary
  // widely. 128K is a safe working assumption for the utilisation ring.
  const MAX_TOKENS = 128_000;
  const usedTokens = Math.min(
    MAX_TOKENS,
    (latest.inputTokens ?? 0) +
      (latest.outputTokens ?? 0) +
      (latest.totalTokens ?? 0)
  );

  return (
    <div className="mb-1.5 flex justify-end">
      <Context
        usedTokens={usedTokens}
        maxTokens={MAX_TOKENS}
        usage={latest}
        modelId="anthropic:claude-sonnet-4-5"
      >
        <ContextTrigger className="h-6 px-2 text-brand-muted-soft hover:text-brand-ink text-xs" />
        <ContextContent>
          <ContextContentHeader />
          <ContextContentBody>
            <ContextInputUsage />
            <ContextOutputUsage />
            <ContextReasoningUsage />
            <ContextCacheUsage />
          </ContextContentBody>
          <ContextContentFooter />
        </ContextContent>
      </Context>
    </div>
  );
}

/**
 * Past-tense label for a completed tool call, e.g. "Booking load" →
 * "Booked load". Falls back to a de-camelised phrase rather than leaking the
 * raw identifier into the UI.
 */
function toolStatusVerb(toolName: string): string {
  const map: Record<string, string> = {
    bookLoad: "Booked load",
    queryLoads: "Searched loads",
    updateLoad: "Updated load",
    updateLoadDocs: "Updated load documents",
    dispatchTrip: "Dispatched trip",
    updateTripStatus: "Updated trip status",
    getFleetStatus: "Checked fleet status",
    createDriver: "Added driver",
    updateDriver: "Updated driver",
    createTruck: "Added tractor",
    updateTruck: "Updated tractor",
    createTrailer: "Added trailer",
    queryCustomers: "Searched customers",
    createCustomer: "Added customer",
    queryCarriers: "Searched carriers",
    createCarrier: "Added carrier",
    queryInvoices: "Searched invoices",
    createInvoice: "Generated invoice",
    sendInvoiceEmail: "Sent invoice email",
    markInvoicePaid: "Recorded payment",
    getMissingPods: "Checked missing PODs",
    reviewPendingExpenses: "Reviewed pending expenses",
    approveExpense: "Approved expense",
    logTripExpense: "Logged trip expense",
    listWorkspaceMembers: "Listed workspace members",
    inviteWorkspaceMember: "Invited member",
    resendInvitation: "Resent invitation",
    cancelInvitation: "Cancelled invitation",
    updateMemberRole: "Updated member role",
    removeMember: "Removed member",
    queryAuditLogs: "Reviewed audit log",
    checkIntegrations: "Checked integrations",
    searchFreightKnowledge: "Searched freight knowledge",
    createExecutionPlan: "Built execution plan",
    delegateSubtask: "Delegated subtask",
    askDispatcher: "Asked dispatcher",
    assignDriverTask: "Assigned driver task",
    askDriverQuestion: "Asked driver",
    scheduleCoworkerTask: "Scheduled checkup",
    listScheduledTasks: "Listed scheduled tasks",
    saveCopilotMemory: "Saved memory",
    recallCopilotMemory: "Recalled memory",
  };
  if (map[toolName]) return map[toolName];

  const words = toolName
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
  return `Ran ${words}`;
}

/** Resolve a cot step icon key (string) to a Lucide component. */
function resolveCotIcon(iconKey?: string) {
  switch (iconKey) {
    case "think":
      return Brain;
    case "package-plus":
      return PackagePlus;
    case "package":
      return Package;
    case "truck":
      return Truck;
    case "search":
      return Search;
    case "brain":
      return Brain;
    case "building-2":
      return Building2;
    case "receipt":
      return Receipt;
    case "banknote":
      return Banknote;
    case "user-plus":
      return UserPlus;
    case "shield":
      return Shield;
    case "list-checks":
      return ListChecks;
    case "help-circle":
      return HelpCircle;
    case "mail":
      return Mail;
    case "calendar":
      return Calendar;
    case "file-text":
      return FileText;
    default:
      return Wrench;
  }
}

/**
 * Render a message's parts. Consecutive `data-cot-step` parts are grouped
 * into a single ChainOfThought wrapper so the user sees a coherent step list
 * (collapsible header + content) instead of disjoint step rows.
 */
function renderMessageParts(
  message: UIMessage,
  respondToApproval?: (options: {
    id: string
    approved: boolean
    reason?: string
    toolName?: string
    source?: string
  }) => void,
  onSendMessage?: (text: string) => void,
  botCoat: BotCoat = "ink",
  /**
   * True only while this exact message is the one currently streaming. Drives
   * the live "Thinking…" shimmer; once the run finishes the step keeps its
   * label and stops animating.
   */
  isLive: boolean = false
): React.ReactNode {
  const parts = message.parts;
  const out: React.ReactNode[] = [];
  let cotBuffer: UIMessage["parts"][number][] = [];

  const flushCot = (anchorIndex: number) => {
    if (cotBuffer.length === 0) return;
    const steps = cotBuffer.map((p, i) =>
      renderPart(message, p, anchorIndex + i, respondToApproval, onSendMessage, botCoat)
    );
    out.push(
      <ChainOfThought
        key={`${message.id}-cot-group-${anchorIndex}`}
        defaultOpen
        className="my-3 rounded-xl border border-brand-rule/40 bg-brand-cream/20 px-3.5 py-2.5"
      >
        <ChainOfThoughtHeader headerIcon={null}>
          <span className="flex items-center gap-2 text-[13px] font-medium text-brand-muted">
            <Cpu className="size-3.5 text-brand-accent/70" />
            Working through it
          </span>
        </ChainOfThoughtHeader>
        <ChainOfThoughtContent className="mt-1">{steps}</ChainOfThoughtContent>
      </ChainOfThought>
    );
    cotBuffer = [];
  };

  parts.forEach((part, i) => {
    if (isDataUIPart(part) && part.type === "data-cot-step") {
      cotBuffer.push(part);
      return;
    }
    flushCot(i);
    out.push(
      <Fragment key={`${message.id}-p-${i}`}>
        {renderPart(message, part, i, respondToApproval, onSendMessage, botCoat)}
      </Fragment>
    );
  });
  flushCot(parts.length);
  return out;
}

/** Render a single UIMessagePart using the appropriate AI Element component. */
function renderPart(
  message: UIMessage,
  part: UIMessage["parts"][number],
  index: number,
  respondToApproval?: (options: {
    id: string
    approved: boolean
    reason?: string
    toolName?: string
    source?: string
  }) => void,
  onSendMessage?: (text: string) => void,
  botCoat: BotCoat = "ink"
): React.ReactNode {
  if (isTextUIPart(part)) {
    return (
      <MessageResponse key={`${message.id}-${index}`}>{part.text}</MessageResponse>
    );
  }

  if (isReasoningUIPart(part)) {
    const isStreaming = part.state === "streaming";
    return (
      <ChainOfThought
        key={`${message.id}-reasoning-${index}`}
        defaultOpen={isStreaming}
        className="my-3 rounded-xl border border-brand-rule/40 bg-brand-cream/20 px-3.5 py-2.5"
      >
        <ChainOfThoughtHeader headerIcon={null}>
          <span className="flex items-center gap-2 text-[13px] font-medium text-brand-muted">
            {isStreaming ? (
              <>
                <Brain className="size-3.5 animate-pulse text-brand-accent" />
                <Shimmer duration={1.4}>Reasoning…</Shimmer>
              </>
            ) : (
              <>
                <Brain className="size-3.5 text-brand-muted-soft" />
                Reasoned through the request
              </>
            )}
          </span>
        </ChainOfThoughtHeader>
        <ChainOfThoughtContent>
          <div className="mt-1 border-l-2 border-brand-rule/50 pl-3 text-[13px] leading-relaxed text-brand-muted whitespace-pre-wrap">
            {part.text}
          </div>
        </ChainOfThoughtContent>
      </ChainOfThought>
    );
  }

  // Structured Chain-of-Thought data parts emitted by /api/chat route. Each
  // tool invocation lands here as a typed step (icon + label + status).
  // The renderer below is used both standalone and by the group renderer
  // when consecutive cot steps share the same parent message.
  if (isDataUIPart(part) && part.type === "data-cot-step") {
    const cot = part.data as {
      id?: string;
      toolName?: string;
      icon?: string;
      label?: string;
      description?: string;
      status?: "active" | "complete" | "pending";
      summary?: string[];
      error?: string;
    };
    const Icon = resolveCotIcon(cot.icon);
    const isPlaceholder = !cot.label?.trim();
    const status = cot.status ?? "complete";
    const isError = !!cot.error;
    return (
      <ChainOfThoughtStep
        key={cot.id ?? `${message.id}-cot-${index}`}
        icon={Icon}
        status={status}
        label={
          <span className={cn(
            "text-[13px] font-medium",
            status === "active" && "text-brand-ink",
            status === "complete" && !isError && "text-brand-muted",
            isError && "text-destructive"
          )}>
            {isPlaceholder && status === "active" ? (
              <Shimmer duration={1.4}>Analyzing…</Shimmer>
            ) : isPlaceholder ? (
              "Completed analysis"
            ) : (
              cot.label
            )}
          </span>
        }
        description={
          cot.error ? (
            <span className="text-destructive/80 text-xs">{cot.error}</span>
          ) : cot.description ? (
            <span className="text-brand-muted-soft text-xs">{cot.description}</span>
          ) : undefined
        }
      >
        {Array.isArray(cot.summary) && cot.summary.length > 0 && (
          <ChainOfThoughtSearchResults className="mt-1.5">
            {cot.summary.map((s, i) => (
              <ChainOfThoughtSearchResult key={`${cot.id ?? index}-s-${i}`}>
                {s}
              </ChainOfThoughtSearchResult>
            ))}
          </ChainOfThoughtSearchResults>
        )}
      </ChainOfThoughtStep>
    );
  }

  if (isFileUIPart(part)) {
    const filePart = part as StoredFilePart;
    const isImg = filePart.mediaType?.startsWith("image/");
    return (
      <div
        key={`${message.id}-file-${index}`}
        className={cn(
          "mb-2 flex flex-wrap items-start gap-2",
          message.role === "user" ? "justify-end" : "justify-start"
        )}
      >
        <MessageFileAttachment
          id={`${message.id}-${index}`}
          part={filePart}
          className={cn(
            "group/attachment",
            isImg && "max-w-xs rounded-xl overflow-hidden border border-brand-rule/50 shadow-sm"
          )}
        />
      </div>
    );
  }

  if (isToolUIPart(part)) {
    const toolPart = part as unknown as ToolPart;
    const key = `${message.id}-tool-${index}`;
    const dynamic = part as unknown as DynamicToolUIPart;
    const toolName = (dynamic.toolName ||
      (toolPart as any).toolName ||
      toolPart.type) as string;
    const input = (dynamic.input ?? (toolPart as any).input) as any;
    const output = (dynamic.output ?? (toolPart as any).output) as any;
    const approval = (dynamic as any).approval as
      | { id: string; approved?: boolean; reason?: string; requestReason?: string }
      | undefined;
    const isRunning =
      toolPart.state === "input-streaming" ||
      toolPart.state === "input-available";

    // 1. Dynamic Plan Rendering using official <Plan> AI Element
    if (toolName === "createExecutionPlan") {
      const planSteps = output?.steps ?? input?.steps ?? [];
      const planGoal =
        output?.goal ?? input?.goal ?? "Operational Execution Plan";
      return (
        <Plan
          key={key}
          className="my-2 border border-brand-accent/20 bg-brand-card/60 rounded-xl"
          isStreaming={isRunning}
        >
          <PlanHeader>
            <div className="flex items-center gap-2">
              <Layers className="size-4 text-brand-accent" />
              <div>
                <PlanTitle>{planGoal}</PlanTitle>
                <PlanDescription>
                  Autonomous Multi-Agent Task Orchestration
                </PlanDescription>
              </div>
            </div>
            <PlanAction>
              <PlanTrigger />
            </PlanAction>
          </PlanHeader>
          <PlanContent className="pt-2">
            <div className="space-y-2">
              {planSteps.map((step: any, sIdx: number) => (
                <div
                  key={step.id || sIdx}
                  className="flex items-center justify-between rounded-lg border border-brand-rule/60 bg-brand-cream/30 px-3 py-2 text-xs"
                >
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="size-3.5 text-emerald-500" />
                    <span className="font-medium text-brand-ink">
                      {step.title}
                    </span>
                  </div>
                  <span className="rounded-md bg-brand-accent/10 px-2 py-0.5 text-[10px] font-medium text-brand-accent">
                    {step.assignedAgent}
                  </span>
                </div>
              ))}
            </div>
          </PlanContent>
        </Plan>
      );
    }

    // 2. Book Load & Draft Load — with Confirmation approval workflow & Load Card
    if (toolName === "bookLoad" || toolName === "draftLoad") {
      const loadData = output ?? input;
      const isApproved =
        toolPart.state === "output-available" || approval?.approved === true;
      const isRejected =
        toolPart.state === "output-denied" || approval?.approved === false;

      return (
        <div key={key} className="my-2 space-y-2">
          {isApproved && (
            <Checkpoint className="my-2">
              <CheckpointIcon className="text-emerald-500" />
              <span className="text-[11px] font-semibold text-emerald-600 dark:text-emerald-400 uppercase tracking-wider">
                Load Confirmed & Booked ({loadData?.loadNumber ?? loadData?.draftId})
              </span>
            </Checkpoint>
          )}

          <div className="rounded-xl border border-brand-accent/25 bg-gradient-to-br from-brand-accent/5 to-transparent p-3.5 text-xs space-y-2.5 max-w-xl">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Truck className="size-4 text-brand-accent" />
                <span className="font-semibold text-brand-ink">
                  Load #{loadData?.loadNumber ?? loadData?.draftId ?? "Pending"} · {loadData?.customerName || "Customer"}
                </span>
              </div>
              <span
                className={cn(
                  "rounded-full px-2 py-0.5 text-[10px] font-medium",
                  isApproved
                    ? "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400"
                    : isRejected
                      ? "bg-rose-500/15 text-rose-600"
                      : "bg-amber-500/15 text-amber-600"
                )}
              >
                {isApproved
                  ? "Booked & Synced"
                  : isRejected
                    ? "Rejected"
                    : "Requires Dispatch Approval"}
              </span>
            </div>

            <div className="flex items-center justify-between rounded-lg bg-brand-card p-2.5 border border-brand-rule">
              <div>
                <div className="text-[9px] text-brand-muted-soft uppercase tracking-wider">
                  Origin
                </div>
                <div className="font-semibold text-xs text-brand-ink">
                  {loadData?.originCity ? `${loadData.originCity}, ${loadData.originState || ""}` : loadData?.origin || "Origin"}
                </div>
              </div>
              <ArrowRight className="size-3.5 text-brand-muted-soft" />
              <div>
                <div className="text-[9px] text-brand-muted-soft uppercase tracking-wider">
                  Destination
                </div>
                <div className="font-semibold text-xs text-brand-ink">
                  {loadData?.destCity ? `${loadData.destCity}, ${loadData.destState || ""}` : loadData?.destination || "Destination"}
                </div>
              </div>
              <div className="text-right">
                <div className="text-[9px] text-brand-muted-soft uppercase tracking-wider">
                  Rate
                </div>
                <div className="font-semibold text-xs text-emerald-600 dark:text-emerald-400">
                  {typeof loadData?.rate === "number" ? `$${loadData.rate.toLocaleString()}` : loadData?.rate}
                </div>
              </div>
            </div>

            {loadData?.equipmentType && (
              <div className="flex items-center gap-2 pt-0.5 text-[11px] text-brand-muted-soft font-mono">
                <span className="rounded bg-brand-cream/80 px-2 py-0.5 border border-brand-rule">
                  {loadData.equipmentType}
                </span>
                {loadData?.commodity && <span>· {loadData.commodity}</span>}
              </div>
            )}
          </div>

          {approval && (
            <Confirmation approval={approval} state={toolPart.state}>
              <ConfirmationRequest>
                <ConfirmationTitle>
                  {approval.requestReason || "Book this freight load into active TMS database?"}
                </ConfirmationTitle>
              </ConfirmationRequest>
              <ConfirmationAccepted>
                <CheckIcon className="size-4 text-emerald-600" />
                <span>Load booking confirmed</span>
              </ConfirmationAccepted>
              <ConfirmationRejected>
                <XIcon className="size-4 text-destructive" />
                <span>Load booking rejected</span>
              </ConfirmationRejected>
              <ConfirmationActions>
                <ConfirmationAction
                  variant="outline"
                  onClick={() => respondToApproval?.({ id: approval.id, approved: false, source: "inline", toolName: String(toolPart.type) })}
                >
                  Reject
                </ConfirmationAction>
                <ConfirmationAction
                  variant="default"
                  onClick={() => respondToApproval?.({ id: approval.id, approved: true, source: "inline", toolName: String(toolPart.type) })}
                >
                  Approve & Book
                </ConfirmationAction>
              </ConfirmationActions>
            </Confirmation>
          )}
        </div>
      );
    }

    // 2b. Query Loads List
    if (toolName === "queryLoads") {
      const data = output ?? input;
      const loads = data?.loads || [];

      return (
        <div key={key} className="my-2 max-w-xl space-y-2">
          <div className="rounded-xl border border-brand-rule bg-brand-card p-3 shadow-2xs space-y-2 text-xs">
            <div className="flex items-center justify-between pb-1 border-b border-brand-rule/60">
              <span className="font-semibold text-brand-ink flex items-center gap-1.5 font-mono text-[11px] uppercase tracking-wider">
                <Truck className="size-3.5 text-brand-accent" />
                Freight Loads ({loads.length} found)
              </span>
              <span className="font-mono text-[10px] text-brand-muted-soft uppercase">
                Filter: {data?.statusFilter || "all"}
              </span>
            </div>
            <div className="space-y-1.5 max-h-56 overflow-y-auto divide-y divide-brand-rule/40">
              {loads.map((ld: any) => (
                <div key={ld.id} className="pt-1.5 first:pt-0 flex items-center justify-between gap-2">
                  <div>
                    <div className="font-semibold text-xs text-brand-ink">
                      #{ld.loadNumber} · {ld.customer}
                    </div>
                    <div className="text-[11px] text-brand-muted-soft">
                      {ld.lane}
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <div className="font-mono font-semibold text-emerald-600 text-xs">
                      {ld.rate}
                    </div>
                    <span className="text-[10px] font-mono capitalize px-1.5 py-0.5 rounded bg-brand-cream/60 border border-brand-rule">
                      {ld.status}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      );
    }

    // 2c. Dispatch Trip Card
    if (toolName === "dispatchTrip") {
      const tripData = output ?? input;
      const isApproved = toolPart.state === "output-available" || approval?.approved === true;

      return (
        <div key={key} className="my-2 space-y-2 max-w-xl">
          {isApproved && (
            <Checkpoint className="my-2">
              <CheckpointIcon className="text-emerald-500" />
              <span className="text-[11px] font-semibold text-emerald-600 uppercase tracking-wider">
                Trip Dispatched ({tripData?.tripNumber})
              </span>
            </Checkpoint>
          )}

          <div className="rounded-xl border border-emerald-500/30 bg-emerald-50/20 p-3.5 text-xs space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Route className="size-4 text-emerald-600" />
                <span className="font-semibold text-brand-ink">
                  Trip #{tripData?.tripNumber || "Pending"} · Load #{tripData?.loadNumber || ""}
                </span>
              </div>
              <span className="rounded-full px-2 py-0.5 text-[10px] font-medium bg-emerald-500/15 text-emerald-700">
                {isApproved ? "Dispatched" : "Pending Confirmation"}
              </span>
            </div>
            <p className="text-[11px] text-brand-muted-soft">
              Assigned Commercial Driver: <strong className="text-brand-ink">{tripData?.driverName || "Driver"}</strong>
            </p>
          </div>

          {approval && (
            <Confirmation approval={approval} state={toolPart.state}>
              <ConfirmationRequest>
                <ConfirmationTitle>
                  {approval.requestReason || "Confirm dispatch of this driver and equipment?"}
                </ConfirmationTitle>
              </ConfirmationRequest>
              <ConfirmationAccepted>
                <CheckIcon className="size-4 text-emerald-600" />
                <span>Trip dispatch authorized</span>
              </ConfirmationAccepted>
              <ConfirmationRejected>
                <XIcon className="size-4 text-destructive" />
                <span>Trip dispatch cancelled</span>
              </ConfirmationRejected>
              <ConfirmationActions>
                <ConfirmationAction
                  variant="outline"
                  onClick={() => respondToApproval?.({ id: approval.id, approved: false, source: "inline", toolName: String(toolPart.type) })}
                >
                  Cancel
                </ConfirmationAction>
                <ConfirmationAction
                  variant="default"
                  onClick={() => respondToApproval?.({ id: approval.id, approved: true, source: "inline", toolName: String(toolPart.type) })}
                >
                  Authorize Dispatch
                </ConfirmationAction>
              </ConfirmationActions>
            </Confirmation>
          )}
        </div>
      );
    }

    // 2d. Fleet & HOS Status Card
    if (toolName === "getFleetStatus") {
      const fleet = output ?? input;
      const drivers = fleet?.drivers || [];

      return (
        <div key={key} className="my-2 max-w-xl space-y-2">
          <div className="rounded-xl border border-brand-rule bg-brand-card p-3.5 shadow-2xs space-y-2.5 text-xs">
            <div className="flex items-center justify-between pb-1 border-b border-brand-rule/60">
              <span className="font-semibold text-brand-ink flex items-center gap-1.5 font-mono text-[11px] uppercase tracking-wider">
                <Users className="size-3.5 text-brand-accent" />
                Fleet & Driver Readiness
              </span>
              <span className="font-mono text-[10px] text-brand-muted-soft">
                {fleet?.totalDrivers || 0} Drivers · {fleet?.activeTractors || 0} Active Tractors
              </span>
            </div>

            <div className="space-y-1.5 max-h-56 overflow-y-auto">
              {drivers.map((d: any) => (
                <div
                  key={d.id}
                  className={`p-2 rounded-lg border flex items-center justify-between text-xs ${
                    d.cdlWarning
                      ? "bg-amber-50/40 border-amber-200"
                      : "bg-brand-cream/20 border-brand-rule/60"
                  }`}
                >
                  <div>
                    <div className="font-medium text-brand-ink flex items-center gap-1.5">
                      {d.name}
                      {d.cdlWarning && (
                        <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-amber-100 text-amber-800">
                          CDL Exp: {d.daysUntilExpiration}d
                        </span>
                      )}
                    </div>
                    <div className="text-[10px] text-brand-muted-soft font-mono">
                      {d.phone} · CDL: {d.cdlNumber}
                    </div>
                  </div>
                  <span
                    className={`font-mono text-[10px] px-2 py-0.5 rounded capitalize ${
                      d.status === "active"
                        ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                        : "bg-gray-100 text-gray-700"
                    }`}
                  >
                    {d.status}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      );
    }

    // 2e. Missing PODs Factoring Card
    if (toolName === "getMissingPods") {
      const data = output ?? input;
      const count = data?.missingCount || 0;
      const atRisk = data?.totalFactoringAtRisk || "$0.00";
      const loads = data?.loadsMissingPod || [];

      return (
        <div key={key} className="my-2 max-w-xl space-y-2">
          <div className="rounded-xl border border-amber-300 bg-amber-50/40 p-3.5 text-xs space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <FileWarning className="size-4 text-amber-600" />
                <span className="font-semibold text-brand-ink">
                  Factoring Alert: {count} Delivered Loads Missing PODs
                </span>
              </div>
              <span className="font-mono text-xs font-bold text-amber-900">
                {atRisk} At Risk
              </span>
            </div>
            <p className="text-[11px] text-brand-muted-soft">
              Factoring providers advance payment only after receiving signed proof of delivery.
            </p>
            <div className="space-y-1.5 pt-1">
              {loads.slice(0, 3).map((l: any) => (
                <div key={l.id} className="p-2 rounded bg-white/80 border border-amber-200 flex items-center justify-between text-xs">
                  <div>
                    <span className="font-semibold text-brand-ink">#{l.loadNumber}</span> · {l.customer}
                    <div className="text-[10px] text-brand-muted-soft">Delivered: {l.deliveredAt}</div>
                  </div>
                  <span className="font-mono font-semibold text-brand-ink">{l.unpaidAmount}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      );
    }

    // 2f. Invoices Financial Overview Card
    if (toolName === "queryInvoices") {
      const inv = output ?? input;
      const list = inv?.invoices || [];

      return (
        <div key={key} className="my-2 max-w-xl space-y-2">
          <div className="rounded-xl border border-brand-rule bg-brand-card p-3.5 shadow-2xs space-y-2 text-xs">
            <div className="flex items-center justify-between pb-1 border-b border-brand-rule/60">
              <span className="font-semibold text-brand-ink flex items-center gap-1.5 font-mono text-[11px] uppercase tracking-wider">
                <Receipt className="size-3.5 text-brand-accent" />
                Accounts Receivable Overview
              </span>
              <span className="font-mono text-[10px] text-brand-muted-soft">
                Pending: {inv?.pendingBalance || "$0"} · Overdue: {inv?.overdueBalance || "$0"}
              </span>
            </div>
            <div className="space-y-1.5 max-h-48 overflow-y-auto divide-y divide-brand-rule/40">
              {list.map((item: any) => (
                <div key={item.id} className="pt-1.5 first:pt-0 flex items-center justify-between text-xs">
                  <div>
                    <div className="font-semibold text-brand-ink">#{item.invoiceNumber} · {item.customer}</div>
                    <div className="text-[10px] text-brand-muted-soft">Due: {item.dueDate}</div>
                  </div>
                  <div className="text-right">
                    <div className="font-mono font-semibold text-brand-ink">{item.amount}</div>
                    <span className="text-[10px] font-mono capitalize px-1.5 py-0.2 rounded bg-brand-cream/80">
                      {item.status}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      );
    }

    // 2g. Send Invoice Email Card
    if (toolName === "sendInvoiceEmail") {
      const mailData = output ?? input;
      const isApproved = toolPart.state === "output-available" || approval?.approved === true;

      return (
        <div key={key} className="my-2 space-y-2 max-w-xl">
          {isApproved && (
            <Checkpoint className="my-2">
              <CheckpointIcon className="text-emerald-500" />
              <span className="text-[11px] font-semibold text-emerald-600 uppercase tracking-wider">
                Invoice #{mailData?.invoiceNumber} Emailed ({mailData?.sentTo})
              </span>
            </Checkpoint>
          )}

          {approval && (
            <Confirmation approval={approval} state={toolPart.state}>
              <ConfirmationRequest>
                <ConfirmationTitle>
                  {approval.requestReason || "Email customer invoice payment link via Resend?"}
                </ConfirmationTitle>
              </ConfirmationRequest>
              <ConfirmationAccepted>
                <CheckIcon className="size-4 text-emerald-600" />
                <span>Invoice email authorized</span>
              </ConfirmationAccepted>
              <ConfirmationRejected>
                <XIcon className="size-4 text-destructive" />
                <span>Invoice email cancelled</span>
              </ConfirmationRejected>
              <ConfirmationActions>
                <ConfirmationAction
                  variant="outline"
                  onClick={() => respondToApproval?.({ id: approval.id, approved: false, source: "inline", toolName: String(toolPart.type) })}
                >
                  Cancel
                </ConfirmationAction>
                <ConfirmationAction
                  variant="default"
                  onClick={() => respondToApproval?.({ id: approval.id, approved: true, source: "inline", toolName: String(toolPart.type) })}
                >
                  Send Invoice Email
                </ConfirmationAction>
              </ConfirmationActions>
            </Confirmation>
          )}
        </div>
      );
    }

    // 2h. Connected Integrations Status Card
    if (toolName === "checkIntegrations") {
      const data = output ?? input;
      const tele = data?.telematics || [];
      const loadboards = data?.loadboards || [];

      return (
        <div key={key} className="my-2 max-w-xl space-y-2">
          <div className="rounded-xl border border-brand-rule bg-brand-card p-3.5 shadow-2xs space-y-2 text-xs">
            <div className="flex items-center justify-between pb-1 border-b border-brand-rule/60">
              <span className="font-semibold text-brand-ink flex items-center gap-1.5 font-mono text-[11px] uppercase tracking-wider">
                <Cable className="size-3.5 text-brand-accent" />
                Connected Logistics Integrations
              </span>
              <span className="font-mono text-[10px] text-emerald-600 font-bold">● Operational</span>
            </div>
            <div className="grid grid-cols-2 gap-2 pt-1">
              {[...tele, ...loadboards].slice(0, 4).map((p: any, idx: number) => (
                <div key={idx} className="p-2 rounded-lg bg-brand-cream/30 border border-brand-rule/60 flex items-center justify-between">
                  <span className="font-medium text-brand-ink text-[11px]">{p.platform}</span>
                  <span className="font-mono text-[10px] text-emerald-600 bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-200">
                    {p.latencyMs ? `${p.latencyMs}ms` : p.status}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      );
    }

    // 2i. Update Load Card
    if (toolName === "updateLoad") {
      const loadData = output ?? input;
      const isApproved = toolPart.state === "output-available" || approval?.approved === true;

      return (
        <div key={key} className="my-2 space-y-2 max-w-xl">
          {isApproved && (
            <Checkpoint className="my-2">
              <CheckpointIcon className="text-emerald-500" />
              <span className="text-[11px] font-semibold text-emerald-600 uppercase tracking-wider">
                Load #{loadData?.loadNumber || "LD"} Updated ({loadData?.status || "Active"})
              </span>
            </Checkpoint>
          )}

          <div className="rounded-xl border border-brand-rule bg-brand-card p-3.5 shadow-2xs space-y-2 text-xs">
            <div className="flex items-center justify-between">
              <span className="font-semibold text-brand-ink flex items-center gap-1.5 font-mono text-[11px] uppercase tracking-wider">
                <Truck className="size-3.5 text-brand-accent" />
                Load #{loadData?.loadNumber || "LD"} Details
              </span>
              <span className="font-mono text-[10px] px-2 py-0.5 rounded-full font-semibold uppercase bg-brand-cream/80 text-brand-ink">
                {loadData?.status || "Modified"}
              </span>
            </div>
            {loadData?.rate && (
              <p className="text-[11px] text-brand-muted-soft">
                Updated Linehaul Rate: <strong className="font-mono text-brand-ink">${loadData.rate}</strong>
              </p>
            )}
            {loadData?.specialInstructions && (
              <p className="text-[10px] text-brand-muted-soft italic bg-brand-cream/30 p-2 rounded">
                Instructions: {loadData.specialInstructions}
              </p>
            )}
          </div>

          {approval && (
            <Confirmation approval={approval} state={toolPart.state}>
              <ConfirmationRequest>
                <ConfirmationTitle>
                  {approval.requestReason || "Confirm updates to active freight load?"}
                </ConfirmationTitle>
              </ConfirmationRequest>
              <ConfirmationAccepted>
                <CheckIcon className="size-4 text-emerald-600" />
                <span>Load updates authorized</span>
              </ConfirmationAccepted>
              <ConfirmationRejected>
                <XIcon className="size-4 text-destructive" />
                <span>Load updates cancelled</span>
              </ConfirmationRejected>
              <ConfirmationActions>
                <ConfirmationAction
                  variant="outline"
                  onClick={() => respondToApproval?.({ id: approval.id, approved: false, source: "inline", toolName: String(toolPart.type) })}
                >
                  Cancel
                </ConfirmationAction>
                <ConfirmationAction
                  variant="default"
                  onClick={() => respondToApproval?.({ id: approval.id, approved: true, source: "inline", toolName: String(toolPart.type) })}
                >
                  Authorize Changes
                </ConfirmationAction>
              </ConfirmationActions>
            </Confirmation>
          )}
        </div>
      );
    }

    // 2j. Create Driver Card
    if (toolName === "createDriver" || toolName === "updateDriver") {
      const dData = output ?? input;
      const isApproved = toolPart.state === "output-available" || approval?.approved === true;

      return (
        <div key={key} className="my-2 space-y-2 max-w-xl">
          {isApproved && (
            <Checkpoint className="my-2">
              <CheckpointIcon className="text-emerald-500" />
              <span className="text-[11px] font-semibold text-emerald-600 uppercase tracking-wider">
                Driver {dData?.name || `${dData?.firstName || ""} ${dData?.lastName || ""}`} Enrolled
              </span>
            </Checkpoint>
          )}

          <div className="rounded-xl border border-brand-rule bg-brand-card p-3.5 shadow-2xs space-y-2 text-xs">
            <div className="flex items-center justify-between">
              <span className="font-semibold text-brand-ink flex items-center gap-1.5 font-mono text-[11px] uppercase tracking-wider">
                <UserPlus className="size-3.5 text-brand-accent" />
                Commercial Driver Profile
              </span>
              <span className="font-mono text-[10px] text-emerald-600 font-bold">● Active Operator</span>
            </div>
            <div className="text-[11px] text-brand-ink font-semibold">
              {dData?.name || `${dData?.firstName || ""} ${dData?.lastName || ""}`}
            </div>
            <div className="flex items-center gap-4 text-[10px] text-brand-muted-soft font-mono">
              <span>CDL: {dData?.license || dData?.licenseNumber || "On File"}</span>
              <span>Expires: {dData?.expiration || dData?.licenseExpiration || "TBD"}</span>
            </div>
          </div>

          {approval && (
            <Confirmation approval={approval} state={toolPart.state}>
              <ConfirmationRequest>
                <ConfirmationTitle>
                  {approval.requestReason || "Authorize adding driver to commercial fleet directory?"}
                </ConfirmationTitle>
              </ConfirmationRequest>
              <ConfirmationAccepted>
                <CheckIcon className="size-4 text-emerald-600" />
                <span>Driver authorized</span>
              </ConfirmationAccepted>
              <ConfirmationRejected>
                <XIcon className="size-4 text-destructive" />
                <span>Driver enrollment cancelled</span>
              </ConfirmationRejected>
              <ConfirmationActions>
                <ConfirmationAction
                  variant="outline"
                  onClick={() => respondToApproval?.({ id: approval.id, approved: false, source: "inline", toolName: String(toolPart.type) })}
                >
                  Cancel
                </ConfirmationAction>
                <ConfirmationAction
                  variant="default"
                  onClick={() => respondToApproval?.({ id: approval.id, approved: true, source: "inline", toolName: String(toolPart.type) })}
                >
                  Confirm Driver
                </ConfirmationAction>
              </ConfirmationActions>
            </Confirmation>
          )}
        </div>
      );
    }

    // 2k. Create/Update Truck Asset Card
    if (toolName === "createTruck" || toolName === "updateTruck") {
      const tData = output ?? input;
      const isApproved = toolPart.state === "output-available" || approval?.approved === true;

      return (
        <div key={key} className="my-2 space-y-2 max-w-xl">
          {isApproved && (
            <Checkpoint className="my-2">
              <CheckpointIcon className="text-emerald-500" />
              <span className="text-[11px] font-semibold text-emerald-600 uppercase tracking-wider">
                Tractor #{tData?.unitNumber} Registered ({tData?.status || "Available"})
              </span>
            </Checkpoint>
          )}

          <div className="rounded-xl border border-brand-rule bg-brand-card p-3.5 shadow-2xs space-y-2 text-xs">
            <div className="flex items-center justify-between">
              <span className="font-semibold text-brand-ink flex items-center gap-1.5 font-mono text-[11px] uppercase tracking-wider">
                <Truck className="size-3.5 text-brand-accent" />
                Fleet Tractor Asset
              </span>
              <span className="font-mono text-[10px] text-emerald-600 font-bold uppercase">{tData?.status || "Available"}</span>
            </div>
            <div className="flex items-center justify-between text-xs">
              <span className="font-semibold text-brand-ink">Unit #{tData?.unitNumber}</span>
              <span className="font-mono text-brand-muted-soft text-[11px]">{tData?.makeModel || `${tData?.year || ""} ${tData?.make || ""}`}</span>
            </div>
            {tData?.odometer && (
              <p className="text-[10px] font-mono text-brand-muted-soft">Odometer: {tData.odometer}</p>
            )}
          </div>

          {approval && (
            <Confirmation approval={approval} state={toolPart.state}>
              <ConfirmationRequest>
                <ConfirmationTitle>
                  {approval.requestReason || "Register tractor unit in active fleet inventory?"}
                </ConfirmationTitle>
              </ConfirmationRequest>
              <ConfirmationAccepted>
                <CheckIcon className="size-4 text-emerald-600" />
                <span>Tractor registered</span>
              </ConfirmationAccepted>
              <ConfirmationRejected>
                <XIcon className="size-4 text-destructive" />
                <span>Tractor registration cancelled</span>
              </ConfirmationRejected>
              <ConfirmationActions>
                <ConfirmationAction
                  variant="outline"
                  onClick={() => respondToApproval?.({ id: approval.id, approved: false, source: "inline", toolName: String(toolPart.type) })}
                >
                  Cancel
                </ConfirmationAction>
                <ConfirmationAction
                  variant="default"
                  onClick={() => respondToApproval?.({ id: approval.id, approved: true, source: "inline", toolName: String(toolPart.type) })}
                >
                  Authorize Tractor
                </ConfirmationAction>
              </ConfirmationActions>
            </Confirmation>
          )}
        </div>
      );
    }

    // 2l. Create Customer Card
    if (toolName === "createCustomer") {
      const cData = output ?? input;
      const isApproved = toolPart.state === "output-available" || approval?.approved === true;

      return (
        <div key={key} className="my-2 space-y-2 max-w-xl">
          {isApproved && (
            <Checkpoint className="my-2">
              <CheckpointIcon className="text-emerald-500" />
              <span className="text-[11px] font-semibold text-emerald-600 uppercase tracking-wider">
                Customer '{cData?.name}' Added
              </span>
            </Checkpoint>
          )}

          <div className="rounded-xl border border-brand-rule bg-brand-card p-3.5 shadow-2xs space-y-2 text-xs">
            <div className="flex items-center justify-between">
              <span className="font-semibold text-brand-ink flex items-center gap-1.5 font-mono text-[11px] uppercase tracking-wider">
                <Building2 className="size-3.5 text-brand-accent" />
                Shipper / Broker Directory
              </span>
              <span className="font-mono text-[10px] text-brand-ink bg-brand-cream/80 px-2 py-0.5 rounded">
                {cData?.paymentTerms || "Net 30"}
              </span>
            </div>
            <div className="text-xs font-semibold text-brand-ink">{cData?.name}</div>
            <div className="flex items-center gap-3 text-[10px] font-mono text-brand-muted-soft">
              <span>Credit Limit: {cData?.creditLimit || "Standard"}</span>
              <span>Status: Active</span>
            </div>
          </div>

          {approval && (
            <Confirmation approval={approval} state={toolPart.state}>
              <ConfirmationRequest>
                <ConfirmationTitle>
                  {approval.requestReason || "Add customer to billing directory?"}
                </ConfirmationTitle>
              </ConfirmationRequest>
              <ConfirmationAccepted>
                <CheckIcon className="size-4 text-emerald-600" />
                <span>Customer added</span>
              </ConfirmationAccepted>
              <ConfirmationRejected>
                <XIcon className="size-4 text-destructive" />
                <span>Customer cancelled</span>
              </ConfirmationRejected>
              <ConfirmationActions>
                <ConfirmationAction
                  variant="outline"
                  onClick={() => respondToApproval?.({ id: approval.id, approved: false, source: "inline", toolName: String(toolPart.type) })}
                >
                  Cancel
                </ConfirmationAction>
                <ConfirmationAction
                  variant="default"
                  onClick={() => respondToApproval?.({ id: approval.id, approved: true, source: "inline", toolName: String(toolPart.type) })}
                >
                  Confirm Customer
                </ConfirmationAction>
              </ConfirmationActions>
            </Confirmation>
          )}
        </div>
      );
    }

    // 2m. Create Invoice & Mark Paid Cards
    if (toolName === "createInvoice") {
      const invData = output ?? input;
      const isApproved = toolPart.state === "output-available" || approval?.approved === true;

      return (
        <div key={key} className="my-2 space-y-2 max-w-xl">
          {isApproved && (
            <Checkpoint className="my-2">
              <CheckpointIcon className="text-emerald-500" />
              <span className="text-[11px] font-semibold text-emerald-600 uppercase tracking-wider">
                Invoice #{invData?.invoiceNumber} Created ({invData?.amount})
              </span>
            </Checkpoint>
          )}

          <div className="rounded-xl border border-brand-rule bg-brand-card p-3.5 shadow-2xs space-y-2 text-xs">
            <div className="flex items-center justify-between">
              <span className="font-semibold text-brand-ink flex items-center gap-1.5 font-mono text-[11px] uppercase tracking-wider">
                <Receipt className="size-3.5 text-brand-accent" />
                AR Freight Invoice Generated
              </span>
              <span className="font-mono text-xs font-bold text-brand-ink">{invData?.amount}</span>
            </div>
            <p className="text-[11px] text-brand-muted-soft">
              Bill to: <strong className="text-brand-ink">{invData?.customerName || "Customer"}</strong> · Due: {invData?.dueDate || "Net 30"}
            </p>
          </div>

          {approval && (
            <Confirmation approval={approval} state={toolPart.state}>
              <ConfirmationRequest>
                <ConfirmationTitle>
                  {approval.requestReason || "Generate accounts receivable invoice?"}
                </ConfirmationTitle>
              </ConfirmationRequest>
              <ConfirmationAccepted>
                <CheckIcon className="size-4 text-emerald-600" />
                <span>Invoice generated</span>
              </ConfirmationAccepted>
              <ConfirmationRejected>
                <XIcon className="size-4 text-destructive" />
                <span>Invoice cancelled</span>
              </ConfirmationRejected>
              <ConfirmationActions>
                <ConfirmationAction
                  variant="outline"
                  onClick={() => respondToApproval?.({ id: approval.id, approved: false, source: "inline", toolName: String(toolPart.type) })}
                >
                  Cancel
                </ConfirmationAction>
                <ConfirmationAction
                  variant="default"
                  onClick={() => respondToApproval?.({ id: approval.id, approved: true, source: "inline", toolName: String(toolPart.type) })}
                >
                  Generate Invoice
                </ConfirmationAction>
              </ConfirmationActions>
            </Confirmation>
          )}
        </div>
      );
    }

    if (toolName === "markInvoicePaid") {
      const pData = output ?? input;
      return (
        <div key={key} className="my-2 max-w-xl">
          <Checkpoint className="my-2">
            <CheckpointIcon className="text-emerald-500" />
            <span className="text-[11px] font-semibold text-emerald-600 uppercase tracking-wider">
              Invoice #{pData?.invoiceNumber} Marked Paid ({pData?.amount} on {pData?.paidDate || "Today"})
            </span>
          </Checkpoint>
        </div>
      );
    }

    // 2n. Log Trip Expense Card
    if (toolName === "logTripExpense") {
      const eData = output ?? input;
      const isApproved = toolPart.state === "output-available" || approval?.approved === true;

      return (
        <div key={key} className="my-2 space-y-2 max-w-xl">
          {isApproved && (
            <Checkpoint className="my-2">
              <CheckpointIcon className="text-emerald-500" />
              <span className="text-[11px] font-semibold text-emerald-600 uppercase tracking-wider">
                Expense Logged: {eData?.category} ({eData?.amount})
              </span>
            </Checkpoint>
          )}

          <div className="rounded-xl border border-brand-rule bg-brand-card p-3.5 shadow-2xs space-y-2 text-xs">
            <div className="flex items-center justify-between">
              <span className="font-semibold text-brand-ink flex items-center gap-1.5 font-mono text-[11px] uppercase tracking-wider">
                <CircleDollarSign className="size-3.5 text-brand-accent" />
                Trip AP Expense
              </span>
              <span className="font-mono text-xs font-bold text-brand-ink">{eData?.amount}</span>
            </div>
            <p className="text-[11px] text-brand-muted-soft">
              Vendor: <strong className="text-brand-ink">{eData?.vendor || "Vendor"}</strong> · Category: <span className="capitalize">{eData?.category}</span>
            </p>
          </div>

          {approval && (
            <Confirmation approval={approval} state={toolPart.state}>
              <ConfirmationRequest>
                <ConfirmationTitle>
                  {approval.requestReason || "Log AP expense for financial settlement?"}
                </ConfirmationTitle>
              </ConfirmationRequest>
              <ConfirmationAccepted>
                <CheckIcon className="size-4 text-emerald-600" />
                <span>Expense logged</span>
              </ConfirmationAccepted>
              <ConfirmationRejected>
                <XIcon className="size-4 text-destructive" />
                <span>Expense cancelled</span>
              </ConfirmationRejected>
              <ConfirmationActions>
                <ConfirmationAction
                  variant="outline"
                  onClick={() => respondToApproval?.({ id: approval.id, approved: false, source: "inline", toolName: String(toolPart.type) })}
                >
                  Cancel
                </ConfirmationAction>
                <ConfirmationAction
                  variant="default"
                  onClick={() => respondToApproval?.({ id: approval.id, approved: true, source: "inline", toolName: String(toolPart.type) })}
                >
                  Confirm Expense
                </ConfirmationAction>
              </ConfirmationActions>
            </Confirmation>
          )}
        </div>
      );
    }

    // 2j. Invite Workspace Member Tool Card
    if (toolName === "inviteWorkspaceMember") {
      const email = input?.email || "team@company.com";
      const role = input?.role || "member";
      return (
        <div className="rounded-xl border border-brand-warm-border/60 bg-white/80 dark:bg-zinc-900/80 p-3 shadow-sm mb-3">
          <div className="flex items-center justify-between pb-2 border-b border-brand-warm-border/40 mb-2">
            <span className="font-semibold text-brand-ink flex items-center gap-1.5 font-mono text-[11px] uppercase tracking-wider">
              <UserPlus className="size-3.5 text-brand-accent" />
              Invite Team Member
            </span>
            <span className="font-mono text-[10px] px-2 py-0.5 rounded-full font-semibold uppercase bg-brand-cream/80 text-brand-ink">
              {role}
            </span>
          </div>
          <div className="text-xs text-brand-ink/90 space-y-1 mb-2">
            <div><span className="text-brand-muted-soft">Invitee:</span> <span className="font-medium">{email}</span></div>
            <div><span className="text-brand-muted-soft">Assigned Role:</span> <span className="font-medium capitalize">{role}</span></div>
          </div>
          {output && (
            <div className="text-xs text-emerald-600 dark:text-emerald-400 font-medium bg-emerald-500/10 px-2.5 py-1.5 rounded-md">
              ✓ {output.message || `Invitation email sent to ${email}.`}
            </div>
          )}
          {approval && (
            <Confirmation approval={approval} state={toolPart.state}>
              <ConfirmationRequest>
                <ConfirmationTitle>
                  Send official workspace invitation email to {email} as {role}?
                </ConfirmationTitle>
              </ConfirmationRequest>
              <ConfirmationAccepted>
                <CheckIcon className="size-4 text-emerald-600" />
                <span>Invitation authorized</span>
              </ConfirmationAccepted>
              <ConfirmationRejected>
                <XIcon className="size-4 text-destructive" />
                <span>Invitation cancelled</span>
              </ConfirmationRejected>
              <ConfirmationActions>
                <ConfirmationAction
                  variant="outline"
                  onClick={() => respondToApproval?.({ id: approval.id, approved: false, source: "inline", toolName: String(toolPart.type) })}
                >
                  Cancel
                </ConfirmationAction>
                <ConfirmationAction
                  variant="default"
                  onClick={() => respondToApproval?.({ id: approval.id, approved: true, source: "inline", toolName: String(toolPart.type) })}
                >
                  Confirm & Send
                </ConfirmationAction>
              </ConfirmationActions>
            </Confirmation>
          )}
        </div>
      );
    }

    // 2k. Update Member Role Tool Card
    if (toolName === "updateMemberRole") {
      const memberId = input?.memberId;
      const newRole = input?.role;
      const suspend = input?.suspend;
      return (
        <div className="rounded-xl border border-brand-warm-border/60 bg-white/80 dark:bg-zinc-900/80 p-3 shadow-sm mb-3">
          <div className="flex items-center justify-between pb-2 border-b border-brand-warm-border/40 mb-2">
            <span className="font-semibold text-brand-ink flex items-center gap-1.5 font-mono text-[11px] uppercase tracking-wider">
              <Users className="size-3.5 text-brand-accent" />
              Member Access Update
            </span>
            {newRole && (
              <span className="font-mono text-[10px] px-2 py-0.5 rounded-full font-semibold uppercase bg-brand-cream/80 text-brand-ink">
                {newRole}
              </span>
            )}
          </div>
          <div className="text-xs text-brand-ink/90 space-y-1 mb-2">
            <div><span className="text-brand-muted-soft">Member ID:</span> <span className="font-mono">{memberId}</span></div>
            {newRole && <div><span className="text-brand-muted-soft">New Role:</span> <span className="font-medium capitalize">{newRole}</span></div>}
            {suspend !== undefined && (
              <div><span className="text-brand-muted-soft">Status Action:</span> <span className="font-medium text-amber-600 dark:text-amber-400">{suspend ? "Suspend Access" : "Reinstate Access"}</span></div>
            )}
          </div>
          {output && (
            <div className="text-xs text-emerald-600 dark:text-emerald-400 font-medium bg-emerald-500/10 px-2.5 py-1.5 rounded-md">
              ✓ {output.message || "Member permissions updated."}
            </div>
          )}
          {approval && (
            <Confirmation approval={approval} state={toolPart.state}>
              <ConfirmationRequest>
                <ConfirmationTitle>
                  Confirm updating access permissions for member {memberId}?
                </ConfirmationTitle>
              </ConfirmationRequest>
              <ConfirmationAccepted>
                <CheckIcon className="size-4 text-emerald-600" />
                <span>Permission change authorized</span>
              </ConfirmationAccepted>
              <ConfirmationRejected>
                <XIcon className="size-4 text-destructive" />
                <span>Permission change rejected</span>
              </ConfirmationRejected>
              <ConfirmationActions>
                <ConfirmationAction
                  variant="outline"
                  onClick={() => respondToApproval?.({ id: approval.id, approved: false, source: "inline", toolName: String(toolPart.type) })}
                >
                  Cancel
                </ConfirmationAction>
                <ConfirmationAction
                  variant="default"
                  onClick={() => respondToApproval?.({ id: approval.id, approved: true, source: "inline", toolName: String(toolPart.type) })}
                >
                  Confirm Update
                </ConfirmationAction>
              </ConfirmationActions>
            </Confirmation>
          )}
        </div>
      );
    }

    // 3. Delegate Subtask — rendered with Task + Sub-Agent Child Bot
    if (toolName === "delegateSubtask") {
      const rawRole = (input?.agentRole || "Specialist").toLowerCase();
      const subtaskTitle = input?.subtaskTitle || "Task Execution";
      const findings = output?.findings;
      const objective = input?.objective;

      const childRole = rawRole.includes("rate") || rawRole.includes("audit")
        ? "rate_auditor"
        : rawRole.includes("driver") || rawRole.includes("fleet") || rawRole.includes("hos")
          ? "fleet_guardian"
          : rawRole.includes("route") || rawRole.includes("corridor")
            ? "route_planner"
            : rawRole.includes("safety") || rawRole.includes("fmcsa")
              ? "safety_compliance"
              : "dispatcher";

      return (
        <Task key={key} defaultOpen={isRunning}>
          <TaskTrigger title={`Sub-agent: ${input?.agentRole || "Specialist"} — ${subtaskTitle}`}>
            <div className="flex w-full cursor-pointer items-center gap-2 text-muted-foreground text-sm transition-colors hover:text-foreground">
              <MuvxBot
                variant="child"
                role={childRole}
                size="xs"
                mood={isRunning ? "think" : "happy"}
              />
              <p className="flex-1 text-left font-medium text-xs text-brand-ink">
                {input?.agentRole || "Specialist"}: {subtaskTitle}
              </p>
            </div>
          </TaskTrigger>
          <TaskContent>
            {isRunning && (
              <TaskItem>
                <div className="flex items-center gap-2 py-0.5">
                  <MuvxBot
                    variant="child"
                    role={childRole}
                    size="xs"
                    mood="think"
                  />
                  <Shimmer duration={2}>Sub-agent analyzing operational parameters…</Shimmer>
                </div>
              </TaskItem>
            )}
            {findings && (
              <TaskItem>
                {/* Single face: the sub-agent avatar owns the row. The
                    collapsible below renders bare (no headerIcon) so it does
                    not draw a second one. */}
                <div className="flex-1 space-y-1.5">
                  <div className="flex items-center gap-2">
                    <MuvxBot
                      variant="child"
                      role={childRole}
                      size="xs"
                      mood="happy"
                      className="shrink-0"
                    />
                    <p className="font-medium text-xs text-brand-ink">
                      {subtaskTitle || "Sub-agent analysis"}
                    </p>
                  </div>
                  <ChainOfThought defaultOpen className="border-none bg-transparent">
                    <ChainOfThoughtHeader headerIcon={null} />
                    <ChainOfThoughtContent>
                      <ChainOfThoughtStep
                        status="complete"
                        icon={CheckCircle2}
                        label={objective || "Operational verification"}
                        description="Sub-agent completed cross-check"
                      >
                          {findings.verdict && (
                            <div className="mt-1 text-xs font-semibold text-emerald-600 dark:text-emerald-400">
                              {findings.verdict}
                            </div>
                          )}
                          <ChainOfThoughtSearchResults className="mt-2">
                            {Object.entries(findings)
                              .filter(([k]) => k !== "availableDrivers" && k !== "verdict")
                              .map(([k, v]) => (
                                <ChainOfThoughtSearchResult key={k}>
                                  <span className="font-medium text-brand-ink capitalize">
                                    {k.replace(/([A-Z])/g, " $1")}:
                                  </span>{" "}
                                  {typeof v === "object" ? JSON.stringify(v) : String(v)}
                                </ChainOfThoughtSearchResult>
                              ))}
                          </ChainOfThoughtSearchResults>
                          {findings.recommendation && (
                            <p className="mt-2 text-xs text-brand-muted-soft italic">
                              {findings.recommendation}
                            </p>
                          )}
                        </ChainOfThoughtStep>
                      </ChainOfThoughtContent>
                    </ChainOfThought>
                </div>
              </TaskItem>
            )}
            {output?.result && (
              <TaskItem>{output.result}</TaskItem>
            )}
          </TaskContent>
        </Task>
      );
    }

    // 4. Interactive Questions to Dispatcher via <Question> AI Element
    if (toolName === "askDispatcher") {
      const data = output ?? input;
      const prompt = data?.prompt || "Select an option:";
      const description = data?.description;
      const options = (data?.options || []) as { label: string; value: string }[];
      const selectionMode = (data?.selectionMode || "single") as "single" | "multiple";

      return (
        <div key={key} className="my-3 max-w-xl">
          <Question
            selectionMode={selectionMode}
            onSubmit={(response) => {
              const selectedValues = response.selectedValues;
              const selectedLabels = options
                .filter((o) => selectedValues.includes(o.value))
                .map((o) => o.label);
              const answerText =
                selectedLabels.length > 0
                  ? selectedLabels.join(", ")
                  : selectedValues.join(", ");
              const extra = response.text ? ` (${response.text})` : "";
              onSendMessage?.(`I choose: ${answerText}${extra}`);
            }}
            className="rounded-xl border border-brand-accent/25 bg-brand-card/90 shadow-2xs space-y-3 p-4"
          >
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <HelpCircle className="size-4 text-brand-accent" />
                <QuestionPrompt className="font-medium text-xs text-brand-ink">
                  {prompt}
                </QuestionPrompt>
              </div>
              {description && (
                <QuestionDescription className="text-xs text-brand-muted-soft pl-6">
                  {description}
                </QuestionDescription>
              )}
            </div>
            <QuestionOptions className="pt-1">
              {options.map((opt) => (
                <QuestionOption
                  key={opt.value}
                  value={opt.value}
                  className="text-xs border-brand-rule hover:border-brand-accent/50"
                >
                  {opt.label}
                </QuestionOption>
              ))}
            </QuestionOptions>
            <QuestionActions className="pt-2">
              <QuestionSubmit className="h-8 px-3 text-xs bg-brand-accent hover:bg-brand-accent/90 text-white">
                Submit Response
              </QuestionSubmit>
            </QuestionActions>
          </Question>
        </div>
      );
    }

    // 5. Regulatory & Market Documentation via <Sources> AI Element
    if (toolName === "searchFreightKnowledge") {
      const data = output ?? input;
      const summary = data?.summary;
      const sources = (data?.sources || []) as { title: string; href: string }[];

      return (
        <div key={key} className="my-2 max-w-xl space-y-2">
          {summary && (
            <div className="rounded-xl border border-brand-rule/80 bg-brand-card/70 p-3 text-xs text-brand-ink leading-relaxed">
              <p className="font-semibold text-brand-accent mb-1 text-[11px] uppercase tracking-wide">
                Regulatory & Market Intelligence
              </p>
              <p>{summary}</p>
            </div>
          )}
          {sources.length > 0 && (
            <Sources className="mt-2 text-xs">
              <SourcesTrigger count={sources.length} />
              <SourcesContent>
                {sources.map((s, idx) => (
                  <Source
                    key={idx}
                    href={s.href}
                    title={s.title}
                    className="text-xs text-brand-accent hover:underline flex items-center gap-1.5"
                  />
                ))}
              </SourcesContent>
            </Sources>
          )}
        </div>
      );
    }

    // 5b. Coworker Driver Task Assignment
    if (toolName === "assignDriverTask") {
      const task = output?.task || input;
      return (
        <div key={key} className="my-2 p-3.5 rounded-xl border border-brand-accent/30 bg-gradient-to-br from-brand-accent/5 to-transparent text-xs space-y-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Truck className="size-4 text-brand-accent" />
              <span className="font-semibold text-brand-ink">
                Driver Task: {input?.targetDriverName || "Fleet Driver"}
              </span>
            </div>
            <span className="rounded-full bg-emerald-500/15 px-2 py-0.5 text-[10px] font-medium text-emerald-600 font-mono uppercase">
              {output ? "Dispatched" : "Pending"}
            </span>
          </div>
          <div className="p-2.5 rounded-lg bg-brand-card border border-brand-rule text-brand-ink/90 space-y-1">
            <div className="font-medium text-xs text-brand-ink">{input?.title}</div>
            {input?.description && (
              <div className="text-brand-muted-soft text-[11px] leading-relaxed">
                {input.description}
              </div>
            )}
            {input?.targetDriverPhone && (
              <div className="text-[10.5px] font-mono text-brand-muted-soft pt-1">
                Dispatch Phone: {input.targetDriverPhone}
              </div>
            )}
          </div>
          {approval && (
            <Confirmation approval={approval} state={toolPart.state} className="mt-2">
              <ConfirmationRequest>
                <ConfirmationTitle>
                  {approval.requestReason || `Dispatch task to driver ${input?.targetDriverName}?`}
                </ConfirmationTitle>
              </ConfirmationRequest>
              <ConfirmationAccepted>
                <CheckIcon className="size-4 text-emerald-600" />
                <span>Driver task dispatched</span>
              </ConfirmationAccepted>
              <ConfirmationRejected>
                <XIcon className="size-4 text-destructive" />
                <span>Driver task cancelled</span>
              </ConfirmationRejected>
              <ConfirmationActions>
                <ConfirmationAction
                  variant="outline"
                  onClick={() => respondToApproval?.({ id: approval.id, approved: false, source: "inline", toolName: String(toolPart.type) })}
                >
                  Cancel
                </ConfirmationAction>
                <ConfirmationAction
                  variant="default"
                  onClick={() => respondToApproval?.({ id: approval.id, approved: true, source: "inline", toolName: String(toolPart.type) })}
                >
                  Confirm & Dispatch
                </ConfirmationAction>
              </ConfirmationActions>
            </Confirmation>
          )}
        </div>
      );
    }

    // 5c. Coworker Driver Question
    if (toolName === "askDriverQuestion") {
      return (
        <div key={key} className="my-2 p-3.5 rounded-xl border border-indigo-500/30 bg-indigo-500/5 text-xs space-y-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Mail className="size-4 text-indigo-600" />
              <span className="font-semibold text-brand-ink">
                Driver Query: {input?.targetDriverName || "Commercial Driver"}
              </span>
            </div>
            <span className="text-[10px] font-mono text-indigo-600 uppercase bg-indigo-500/10 px-2 py-0.5 rounded">
              {input?.channel || "SMS"}
            </span>
          </div>
          <div className="p-2.5 rounded-lg bg-brand-card border border-brand-rule text-brand-ink/90 italic">
            &ldquo;{input?.question}&rdquo;
          </div>
          {output && (
            <div className="text-[11px] font-mono text-emerald-600 flex items-center gap-1.5 pt-0.5">
              <CheckCircle2 className="size-3.5" />
              <span>{output.message || "Question transmitted to driver cab"}</span>
            </div>
          )}
        </div>
      );
    }

    // 5d. Coworker Automated Task Scheduler
    if (toolName === "scheduleCoworkerTask") {
      return (
        <div key={key} className="my-2 p-3.5 rounded-xl border border-amber-500/30 bg-amber-500/5 text-xs space-y-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Clock className="size-4 text-amber-600" />
              <span className="font-semibold text-brand-ink">
                Coworker Task Scheduled
              </span>
            </div>
            <span className="text-[10px] font-mono text-amber-700 uppercase bg-amber-500/10 px-2 py-0.5 rounded">
              {input?.scheduleType || "once"}
            </span>
          </div>
          <div className="p-2.5 rounded-lg bg-brand-card border border-brand-rule text-brand-ink/90 space-y-1">
            <div className="font-medium text-xs">{input?.title}</div>
            <div className="text-[11px] text-brand-muted-soft font-mono">
              Run time: {input?.runAt || "As scheduled"} · Specialist: {input?.specialist || "dispatcher"}
            </div>
          </div>
          {output && (
            <div className="text-[11px] font-mono text-emerald-600 flex items-center gap-1.5 pt-0.5">
              <CheckCircle2 className="size-3.5" />
              <span>{output.message}</span>
            </div>
          )}
        </div>
      );
    }

    // 5e. Save Copilot Enterprise Memory
    if (toolName === "saveCopilotMemory") {
      return (
        <div key={key} className="my-2 p-3 rounded-xl border border-emerald-500/30 bg-emerald-500/5 text-xs space-y-1">
          <div className="flex items-center gap-1.5 font-semibold text-emerald-700 dark:text-emerald-400 font-mono text-[11px] uppercase">
            <ShieldCheck className="size-3.5" />
            Enterprise Memory Persisted
          </div>
          <div className="text-brand-ink font-mono text-[11px]">
            [{input?.key}] ({input?.category}): {input?.content}
          </div>
        </div>
      );
    }

    // 6. All other tool calls rendered via ToolCallsSection
    const toolCategory = toolName.includes("rate")
      ? "rate_auditor"
      : toolName.includes("driver") || toolName.includes("fleet")
        ? "fleet"
        : toolName.includes("plan")
          ? "plan"
          : toolName.includes("draft")
            ? "dispatch"
            : toolName.includes("email")
              ? "gmail"
              : toolName.includes("calendar")
                ? "calendar"
                : toolName.includes("search")
                  ? "search"
                  : "general";

    const entry: ToolCallEntry = {
      tool_name: toolName,
      tool_category: toolCategory,
      // Past-tense summary. Raw camelCase ("Executed query loads") reads like
      // a log line, so reuse the same verb vocabulary the progress steps use.
      message: `${toolStatusVerb(toolName)}`,
      inputs: input,
      output:
        output?.findings || output?.result || output?.message || output,
    };

    return (
      <div key={key} className="my-2 space-y-2">
        <ToolCallsSection
          toolCalls={[entry]}
          defaultExpanded={isRunning}
        />
        {approval && (
          <Confirmation approval={approval} state={toolPart.state} className="mt-2">
            <ConfirmationRequest>
              <ConfirmationTitle>
                {approval.requestReason ||
                  `Authorize ${toolStatusVerb(toolName).toLowerCase()}?`}
              </ConfirmationTitle>
            </ConfirmationRequest>
            <ConfirmationAccepted>
              <CheckIcon className="size-4 text-emerald-600" />
              <span>Action confirmed</span>
            </ConfirmationAccepted>
            <ConfirmationRejected>
              <XIcon className="size-4 text-destructive" />
              <span>Action cancelled</span>
            </ConfirmationRejected>
            <ConfirmationActions>
              <ConfirmationAction
                variant="outline"
                onClick={() => respondToApproval?.({ id: approval.id, approved: false, source: "inline", toolName: String(toolPart.type) })}
              >
                Reject
              </ConfirmationAction>
              <ConfirmationAction
                variant="default"
                onClick={() => respondToApproval?.({ id: approval.id, approved: true, source: "inline", toolName: String(toolPart.type) })}
              >
                Approve & Execute
              </ConfirmationAction>
            </ConfirmationActions>
          </Confirmation>
        )}
      </div>
    );
  }

  return null;
}

export default function ChatInterface() {
  const [provider, setProvider] = useState<string>(DEFAULT_PROVIDER);
  const [availableModels, setAvailableModels] = useState<AIModelItem[]>([]);
  const [selectedModel, setSelectedModel] = useState("");
  const [botCoat, setBotCoat] = useState<BotCoat>("ink");
  const [currentChatId, setCurrentChatId] = useState<string | null>(null);
  const [allowAll, setAllowAll] = useState(true); // Fully autonomous — no approval gates
  const [recentFinish, setRecentFinish] = useState(false);

  const { messages, setMessages, sendMessage, status, error, stop } = useChat({
    id: "ai-chat",
  });

  // Stub — approvals disabled, but keep signature so Confirmation components don't break
  const respondToApproval = useCallback(() => {}, []);

  const prevStatusRef = useRef(status);

  // Upload lifecycle surfaced to the input bar so the user gets feedback
  // while bytes move browser → S3.
  const [uploadState, setUploadState] = useState<"idle" | "uploading" | "error">(
    "idle"
  );
  const [uploadError, setUploadError] = useState<string | null>(null);

  // Load chat and settings from PostgreSQL on mount
  useEffect(() => {
    fetch("/api/copilot/chats")
      .then((r) => r.json())
      .then(async (data) => {
        if (data.chat?.id) {
          setCurrentChatId(data.chat.id);
        }
        if (Array.isArray(data.messages) && data.messages.length > 0) {
          // Presigned GET URLs expire after an hour. Refresh every stored
          // attachment so a reopened chat still renders previews and
          // downloads keep working.
          const reSigned = await Promise.all(
            data.messages.map(async (m: UIMessage) => ({
              ...m,
              parts: await Promise.all(
                (m.parts ?? []).map((p) =>
                  isFileUIPart(p) ? refreshAttachmentUrl(p) : p
                )
              ),
            }))
          );
          setMessages(reSigned);
        }
      })
      .catch((err) => console.error("Failed to load chat session:", err));

    fetch("/api/copilot/settings")
      .then((r) => r.json())
      .then((data) => {
        if (data.settings?.coat) setBotCoat(data.settings.coat);
        if (data.settings?.allowAll !== undefined) setAllowAll(data.settings.allowAll);
      })
      .catch((err) => console.error("Failed to load copilot settings:", err));
  }, [setMessages]);

  // Persist conversation messages to database
  useEffect(() => {
    if (!currentChatId || messages.length === 0) return;
    const timer = setTimeout(() => {
      fetch("/api/copilot/chats", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ chatId: currentChatId, messages }),
      }).catch((err) => console.error("Error saving chat:", err));
    }, 1200);
    return () => clearTimeout(timer);
  }, [currentChatId, messages]);

  // Track completion transition to joyful bounce
  useEffect(() => {
    // Stream lifecycle: this is where "response stopped" becomes visible as a
    // distinct status transition rather than a silent stall.
    if (prevStatusRef.current !== status) {
      traceInfo("chat:status", { from: prevStatusRef.current, to: status });
    }
    if (prevStatusRef.current === "streaming" && status === "ready") {
      traceInfo("chat:stream-complete");
      setRecentFinish(true);
      const timer = setTimeout(() => setRecentFinish(false), 2000);
      return () => clearTimeout(timer);
    }
    prevStatusRef.current = status;
  }, [status]);

  // Report which parts actually landed on the last assistant message — the
  // fastest way to tell "streaming stopped" from "server sent nothing".
  useEffect(() => {
    const last = messages[messages.length - 1];
    if (!last || last.role !== "assistant") return;
    traceDebug("chat:parts", {
      messageId: last.id,
      parts: last.parts.map((p) => describePart(p)),
      textLength: last.parts
        .filter(isTextUIPart)
        .reduce((n, p) => n + p.text.length, 0),
    });
  }, [messages]);



  // Calculate real-time dynamic bot mood
  const isAnyToolRunning = messages.some((m) =>
    m.parts?.some(
      (p) =>
        isToolUIPart(p) &&
        ((p as any).state === "input-streaming" || (p as any).state === "input-available")
    )
  );

  const copilotMood: BotMood = isAnyToolRunning
    ? "tool"
    : status === "submitted"
      ? "think"
      : status === "streaming"
        ? "stream"
        : recentFinish
          ? "happy"
          : "idle";

  // Fetch all dynamically available models from provider on mount
  useEffect(() => {
    fetch("/api/models")
      .then((r) => r.json())
      .then((data: { provider?: string; models: AIModelItem[] }) => {
        if (data.provider) {
          setProvider(data.provider);
        }
        if (Array.isArray(data.models) && data.models.length > 0) {
          setAvailableModels(data.models);
          // Default to Claude 3.5 Sonnet, GPT-4o Mini, or first model in list
          const preferred =
            data.models.find((m) => m.id.includes("claude-3.5-sonnet"))?.id ||
            data.models.find((m) => m.id.includes("gpt-4o-mini"))?.id ||
            data.models[0].id;
          setSelectedModel(preferred);
        }
      })
      .catch((err) => {
        console.error("Failed to load models:", err);
      });
  }, []);

  const sendWithProvider = async (
    text: string,
    options: { webSearch: boolean; model: string | null; files?: File[] }
  ) => {
    // No text and no files — nothing to send.
    if (!text.trim() && !options.files?.length) {
      traceDebug("send:skipped-empty");
      return;
    }

    const endSend = traceGroup("chat:send", {
      chars: text.length,
      fileCount: options.files?.length ?? 0,
      model: options.model ?? selectedModel,
      webSearch: options.webSearch,
    });

    const requestBody = {
      provider,
      model: options.model ?? selectedModel,
      webSearch: options.webSearch,
      chatId: currentChatId,
      allowAll,
    };

    let fileParts: FileUIPart[] | undefined;
    if (options.files && options.files.length > 0) {
      setUploadState("uploading");
      try {
        // Browser → S3 direct. The server only signs.
        fileParts = await uploadFilesToS3(options.files);
        traceInfo("upload:ok", {
          count: fileParts.length,
          files: fileParts.map((f) => f.filename),
        });
      } catch (err) {
        traceError("upload:failed", {
          message: err instanceof Error ? err.message : String(err),
        });
        setUploadError(err instanceof Error ? err.message : "Upload failed");
        setUploadState("error");
        endSend();
        return;
      } finally {
        setUploadState("idle");
      }
    }

    if (fileParts && fileParts.length > 0) {
      sendMessage(
        {
          text:
            text.trim() ||
            "Please review and process the attached freight document(s).",
          files: fileParts,
        },
        { body: requestBody }
      );
    } else {
      sendMessage({ text }, { body: requestBody });
    }
    endSend();
  };

  if (messages.length === 0) {
    return (
      <div className="relative flex h-full w-full flex-col items-center justify-center overflow-hidden bg-[#f7f3ec]">
        {/* Radial brand-accent glow — sets the calm, premium mood without
            competing with the input. Sits behind everything and fades out
            toward the edges so the page stays read-friendly. */}
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0"
          style={{
            backgroundImage:
              "radial-gradient(60% 50% at 50% 38%, rgba(217,98,43,0.10) 0%, rgba(217,98,43,0.04) 35%, rgba(247,243,236,0) 70%)",
          }}
        />

        <div className="relative z-10 w-full max-w-2xl px-6 flex flex-col items-center">
          {error && (
            <div className="mb-6 w-full rounded-xl border border-destructive/20 bg-destructive/10 px-4 py-3 text-sm text-destructive">
              {error.message}
            </div>
          )}

          {/* Small decorative orb */}
          <div className="relative mb-3">
            <MuvxBot
              size="sm"
              coat={botCoat}
              mood={copilotMood}
              showDots={status === "submitted"}
              className="relative"
            />
          </div>

          {/* Hero headline — Gemini style: Where should we start? */}
          <h1 className="font-serif text-[clamp(28px,4vw,38px)] leading-[1.15] tracking-tight text-brand-ink text-center">
            Where should we start?
          </h1>

          {/* Hero input — pure custom Gemini-style capsule */}
          <div className="mt-7 w-full">
            <AI_Input_Search
              models={availableModels}
              selectedModel={selectedModel}
              onModelChange={setSelectedModel}
              onSubmit={sendWithProvider}
              isLoading={status === "submitted" || status === "streaming"}
              onStop={stop}
              placeholder="Ask Muvx anything…"
            />
          </div>

          {/* Gemini-style whisper starter prompts below input */}
          <div className="mt-7 flex w-full max-w-xl flex-col gap-2">
            {[
              {
                icon: Truck,
                text: "Show active loads and current transit status",
                prompt: "Show me all loads active today with their current status.",
              },
              {
                icon: FileText,
                text: "Audit delivered loads missing signed POD documents",
                prompt: "Find delivered loads from the last 7 days that are still missing a signed POD.",
              },
              {
                icon: Users,
                text: "Check tractor and driver availability for dispatch",
                prompt: "Which tractors and drivers are available for dispatch right now?",
              },
            ].map((hint, idx) => (
              <button
                key={idx}
                type="button"
                onClick={() =>
                  sendWithProvider(hint.prompt, {
                    webSearch: false,
                    model: selectedModel,
                  })
                }
                className="group flex items-center gap-3 rounded-2xl border border-brand-rule/60 bg-brand-card/70 px-4 py-2.5 text-left transition-all hover:border-brand-accent/40 hover:bg-brand-card"
              >
                <hint.icon className="size-4 shrink-0 text-brand-muted-soft transition-colors group-hover:text-brand-accent" />
                <span className="text-[13px] font-medium text-brand-ink/80 transition-colors group-hover:text-brand-ink">
                  {hint.text}
                </span>
              </button>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-full w-full flex-col overflow-hidden">
      {/* Error display */}
      {error && (
        <div className="mx-4 mt-3 shrink-0 rounded-xl border border-destructive/30 bg-destructive/8 px-4 py-3 text-sm text-destructive">
          <div className="flex items-start gap-2">
            <FileWarning className="mt-0.5 size-4 shrink-0" />
            <div className="min-w-0">
              <div className="font-medium">Connection issue</div>
              <div className="mt-0.5 text-[13px] text-destructive/80 break-words">{error.message}</div>
            </div>
          </div>
        </div>
      )}

      {/* Message list with auto-scroll.
          NOTE: Do NOT wrap <Conversation> in another overflow-y-auto
          container. Conversation is a StickToBottom root that manages its own
          scroll; a competing scroll container steals the scroll and breaks
          auto-scroll. `min-h-0` keeps it shrinkable inside the flex column. */}
      <Conversation className="flex-1 min-h-0">
          <ConversationContent className="max-w-4xl mx-auto w-full px-4 py-4 gap-4">
            {messages
              .filter(
                (m) =>
                  m.role === "user" ||
                  (m.role === "assistant" &&
                    m.parts.some(
                      (p) =>
                        (isTextUIPart(p) && p.text.trim().length > 0) ||
                        isToolUIPart(p) ||
                        (isDataUIPart(p) && p.type === "data-cot-step")
                    ))
              )
              .map((message, mIdx) => {
              const isLastMessage = mIdx === messages.length - 1;
              const isAssistant = message.role === "assistant";
              const rowMood: BotMood = isLastMessage ? copilotMood : "idle";
              const isStreamingNow =
                isLastMessage && (status === "submitted" || status === "streaming");
              // Translate the AI-SDK UIMessage into the agentic renderer
              // schema. Identity translate only — duration is reconstructed
              // from `parts.length` for memoisation.
              const streamingMsg = isAssistant
                ? fromUIMessage(message, isStreamingNow)
                : null;
              return (
                <Message key={message.id} from={message.role} className="gap-1.5">
                  {isAssistant && (
                    <div className="flex items-center gap-2 mb-0.5 select-none">
                      <MuvxBot size="xs" coat={botCoat} mood={rowMood} />
                    </div>
                  )}
                  <MessageContent>
                    {isAssistant && streamingMsg ? (
                      <StreamingAssistantMessage
                        message={streamingMsg}
                        isLoading={isStreamingNow}
                        onRespondToApproval={respondToApproval}
                      />
                    ) : (
                      renderMessageParts(
                        message,
                        respondToApproval,
                        (text) =>
                          sendWithProvider(text, {
                            webSearch: false,
                            model: selectedModel,
                          }),
                        botCoat,
                        isLastMessage && status === "streaming"
                      )
                    )}
                  </MessageContent>
                  {isAssistant && message.parts.some((p) => isTextUIPart(p) && p.text.trim().length > 0) && (
                    <MessageToolbar>
                      <MessageActions>
                        <CopyButton message={message} />
                      </MessageActions>
                    </MessageToolbar>
                  )}
                </Message>
              );
            })}

            {/* Instant "alive" feedback before first chunk arrives */}
            {(status === "submitted" || status === "streaming") &&
              !messages.some(
                (m) =>
                  m.role === "assistant" &&
                  m.parts.some(
                    (p) =>
                      (isTextUIPart(p) && p.text.trim().length > 0) ||
                      isToolUIPart(p) ||
                      (isDataUIPart(p) && p.type === "data-cot-step")
                  )
              ) && (
                <Message from="assistant" className="gap-1.5">
                  <div className="flex items-center gap-2 mb-0.5 select-none">
                    <MuvxBot
                      size="xs"
                      coat={botCoat}
                      mood={copilotMood}
                      showDots
                      isActive
                    />
                  </div>
                  <MessageContent>
                    <div className="flex items-center gap-2.5 py-1.5 px-1">
                      <div className="flex gap-1.5 items-center">
                        <span className="size-2 rounded-full bg-brand-accent/70 animate-pulse [animation-delay:0ms]" />
                        <span className="size-2 rounded-full bg-brand-accent/70 animate-pulse [animation-delay:150ms]" />
                        <span className="size-2 rounded-full bg-brand-accent/70 animate-pulse [animation-delay:300ms]" />
                      </div>
                      <Shimmer duration={1.6} className="text-[13px] font-medium text-brand-accent">
                        {status === "submitted"
                          ? "Connecting to Muvx Brain…"
                          : isAnyToolRunning
                            ? "Searching live operational data…"
                            : "Thinking through freight records…"}
                      </Shimmer>
                    </div>
                  </MessageContent>
                </Message>
              )}
          </ConversationContent>
          <ConversationScrollButton />
      </Conversation>

      {/* Upload feedback — the browser pushes bytes straight to S3, so surface
          progress and any storage rejection above the input bar. */}
      {uploadState !== "idle" && (
        <div className="max-w-4xl mx-auto w-full px-4 pb-1.5">
          <div
            className={cn(
              "flex items-center gap-2 text-xs",
              uploadState === "error"
                ? "text-destructive"
                : "text-brand-muted-soft"
            )}
          >
            {uploadState === "uploading" ? (
              <>
                <Shimmer duration={1.4}>Uploading to secure storage…</Shimmer>
              </>
            ) : (
              <>
                <FileWarning className="size-3.5 shrink-0" />
                <span>{uploadError ?? "Upload failed"}</span>
              </>
            )}
          </div>
        </div>
      )}

      {/* Input bar at bottom with file attachment */}
      <div className="p-3 sm:p-4 max-w-4xl mx-auto w-full shrink-0">
        <AI_Input_Search
          models={availableModels}
          selectedModel={selectedModel}
          onModelChange={setSelectedModel}
          onSubmit={sendWithProvider}
          isLoading={status === "submitted" || status === "streaming"}
          onStop={stop}
          placeholder="Ask Muvx anything…"
        />
      </div>
    </div>
  );
}
