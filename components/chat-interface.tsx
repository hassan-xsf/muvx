"use client";

import { useChat } from "@ai-sdk/react";
import {
  isTextUIPart,
  isReasoningUIPart,
  isFileUIPart,
  isToolUIPart,
  type DynamicToolUIPart,
  type FileUIPart,
  type UIMessage,
} from "ai";
import { useEffect, useRef, useState } from "react";
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
import { Attachments, Attachment } from "@/components/ai-elements/attachments";
import { Shimmer } from "@/components/ai-elements/shimmer";
import { Suggestions, Suggestion } from "@/components/ai-elements/suggestion";
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

export function getAdaptiveSuggestions(
  lastMessage: UIMessage | undefined,
  activeSpecialist: BotRole = "main"
): { title: string; prompt: string }[] {
  if (!lastMessage) {
    if (activeSpecialist === "dispatcher") {
      return [
        { title: "Find available loads", prompt: "Query active freight loads ready for dispatch" },
        { title: "Match Midwest drivers", prompt: "Find available drivers in the Midwest corridor" },
        { title: "Calculate lane margin", prompt: "Calculate break-even cost per mile for 600-mile haul" },
        { title: "Draft load for dispatch", prompt: "Draft new freight load with Chicago pickup" },
      ];
    }
    if (activeSpecialist === "fleet_guardian") {
      return [
        { title: "Expiring CDLs (<30d)", prompt: "Check fleet drivers with CDL expiring within 30 days" },
        { title: "FMCSA 34-hr restart", prompt: "Explain FMCSA 34-hour restart rules for drivers" },
        { title: "Driver HOS duty logs", prompt: "Check driver availability and HOS driving limits" },
        { title: "Pre-trip DVIR audits", prompt: "Inspect pre-trip vehicle maintenance inspection logs" },
      ];
    }
    if (activeSpecialist === "rate_auditor") {
      return [
        { title: "Audit missing PODs", prompt: "Check delivered loads with missing signed POD receipts" },
        { title: "Query overdue invoices", prompt: "Query accounts receivable invoices that are overdue" },
        { title: "Factoring cashflow", prompt: "Review factorable freight receivables and credit limits" },
        { title: "Review pending expenses", prompt: "Review pending AP trip expenses awaiting approval" },
      ];
    }
    if (activeSpecialist === "safety_compliance") {
      return [
        { title: "Check Samsara GPS sync", prompt: "Check Samsara telematics GPS location sync status" },
        { title: "Test DAT One rate feed", prompt: "Test DAT One loadboard rate-fetch connection" },
        { title: "Verify Motive ELD logs", prompt: "Verify Motive ELD duty logs synchronization" },
        { title: "Inspect Resend status", prompt: "Check Resend invoice email transmission latency" },
      ];
    }
    return [
      { title: "Draft load from rate con", prompt: "Draft a new load from rate confirmation details" },
      { title: "Audit missing PODs", prompt: "Check delivered loads with missing signed POD receipts" },
      { title: "Fleet driver HOS", prompt: "Check driver availability and FMCSA HOS status" },
      { title: "Overdue invoices", prompt: "Query overdue accounts receivable invoices" },
    ];
  }

  // Check tool parts
  const toolParts = lastMessage.parts.filter(isToolUIPart) as any[];
  for (const part of toolParts) {
    const toolName = part.toolName || part.type;

    if (toolName === "getMissingPods") {
      return [
        { title: "Generate factoring batch", prompt: "Generate factoring invoice batch for delivered loads" },
        { title: "Email carrier for POD", prompt: "Request signed proof of delivery from delivery carrier" },
        { title: "Query active loads", prompt: "Query active freight loads in the system" },
        { title: "Check overdue invoices", prompt: "Review customer accounts receivable overdue balances" },
      ];
    }

    if (toolName === "queryLoads") {
      return [
        { title: "Dispatch next load", prompt: "Dispatch the first available load to an available driver" },
        { title: "Check Midwest trucks", prompt: "Check available drivers and tractors in the Midwest" },
        { title: "Calculate lane margin", prompt: "Calculate estimated break-even cost and margin for these loads" },
        { title: "Audit missing PODs", prompt: "Check delivered loads with missing signed PODs" },
      ];
    }

    if (toolName === "bookLoad") {
      return [
        { title: "Assign driver & tractor", prompt: "Find available driver and tractor to dispatch this load" },
        { title: "Calculate route tolls", prompt: "Calculate estimated mileage, tolls, and fuel cost" },
        { title: "View active loads", prompt: "Query all active freight loads" },
        { title: "Email rate confirmation", prompt: "Prepare load tender confirmation for customer" },
      ];
    }

    if (toolName === "getFleetStatus") {
      return [
        { title: "Alert expiring CDLs", prompt: "Notify dispatch about drivers with expiring CDL licenses" },
        { title: "FMCSA 34-hr restart", prompt: "Explain FMCSA 34-hour restart rules for drivers on duty" },
        { title: "Assign truck to load", prompt: "Find available loads matching these tractors" },
        { title: "Check Samsara telematics", prompt: "Check live GPS and telematics integration status" },
      ];
    }

    if (toolName === "dispatchTrip") {
      return [
        { title: "Send driver instructions", prompt: "Send route instructions and pickup details to assigned driver" },
        { title: "Track GPS telemetry", prompt: "Monitor live GPS telemetry for this dispatched trip" },
        { title: "Review trip advance", prompt: "Review driver fuel advances and trip expense limits" },
        { title: "Check active loads", prompt: "Query remaining available loads" },
      ];
    }

    if (toolName === "queryInvoices") {
      return [
        { title: "Email overdue reminders", prompt: "Send payment reminder emails to customers with overdue balances" },
        { title: "Review factorable freight", prompt: "Check factoring eligibility for pending invoices" },
        { title: "Check missing POD receipts", prompt: "Find delivered loads missing POD receipts for factoring" },
        { title: "View AP expenses", prompt: "Review pending AP expenses awaiting manager approval" },
      ];
    }

    if (toolName === "sendInvoiceEmail") {
      return [
        { title: "Check delivery status", prompt: "Verify Resend email delivery status for this invoice" },
        { title: "Review remaining invoices", prompt: "Query remaining unpaid customer invoices" },
        { title: "Check missing PODs", prompt: "Audit missing proof of delivery receipts" },
        { title: "View fleet status", prompt: "Check driver and tractor fleet availability" },
      ];
    }

    if (toolName === "checkIntegrations") {
      return [
        { title: "Test Samsara GPS sync", prompt: "Check Samsara telematics real-time location sync" },
        { title: "Check DAT One feed", prompt: "Test DAT One loadboard rate-fetch connection" },
        { title: "Verify Motive ELD logs", prompt: "Check Motive ELD duty logs synchronization" },
        { title: "Audit fleet status", prompt: "Check fleet driver HOS and tractor availability" },
      ];
    }

    if (toolName === "reviewPendingExpenses" || toolName === "approveExpense") {
      return [
        { title: "Export settlements", prompt: "Export weekly driver settlement deductions summary" },
        { title: "Check fuel receipts", prompt: "Audit driver fuel purchase receipts" },
        { title: "Query customer invoices", prompt: "Query accounts receivable invoices" },
        { title: "Check fleet status", prompt: "Check driver and tractor fleet availability" },
      ];
    }
  }

  // Keyword analysis
  const fullText = lastMessage.parts
    .filter(isTextUIPart)
    .map((p: any) => p.text.toLowerCase())
    .join(" ");

  if (fullText.includes("driver") || fullText.includes("hos") || fullText.includes("cdl") || fullText.includes("hours of service")) {
    return [
      { title: "FMCSA 34-hr restart rules", prompt: "What are the FMCSA 34-hour restart rules?" },
      { title: "Alert expiring CDLs", prompt: "Check fleet drivers with CDL expiring within 30 days" },
      { title: "Assign driver to load", prompt: "Find available loads matching these drivers" },
      { title: "Check telematics sync", prompt: "Check telematics integration status" },
    ];
  }

  if (fullText.includes("rate") || fullText.includes("broker") || fullText.includes("margin") || fullText.includes("mile")) {
    return [
      { title: "Calculate break-even RPM", prompt: "Calculate break-even cost per mile for a 500-mile haul" },
      { title: "Audit rate confirmation", prompt: "Audit rate confirmation for detention and accessorial terms" },
      { title: "Book load into system", prompt: "Book load into Muvx TMS" },
      { title: "Check market spot rates", prompt: "Compare contract vs DAT spot rates for this corridor" },
    ];
  }

  if (fullText.includes("invoice") || fullText.includes("factoring") || fullText.includes("pod") || fullText.includes("paid")) {
    return [
      { title: "Email invoice reminder", prompt: "Send invoice payment reminder to customer via Resend" },
      { title: "Audit missing PODs", prompt: "Check delivered loads missing signed POD receipts" },
      { title: "Factoring cashflow check", prompt: "Review factoring credit eligibility" },
      { title: "Review pending expenses", prompt: "Review pending AP expenses" },
    ];
  }

  return [
    { title: "Audit missing PODs", prompt: "Check delivered loads with missing signed POD receipts" },
    { title: "Find available loads", prompt: "Query active freight loads in the system" },
    { title: "Check fleet availability", prompt: "Check driver and tractor fleet availability" },
    { title: "Review overdue invoices", prompt: "Query overdue accounts receivable invoices" },
  ];
}

/**
 * Convert raw File[] (from the kokonutui file picker) into FileUIPart[]
 * that the AI SDK uses for message attachments.
 *
 * This mirrors the official `convertFileListToFileUIParts` helper that the
 * AI SDK uses internally when a `FileList` is passed to `sendMessage`.
 */
async function filesToFileUIParts(files: File[]): Promise<FileUIPart[]> {
  return Promise.all(
    files.map(async (file) => {
      const url = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = reject;
        reader.readAsDataURL(file);
      });
      return {
        type: "file" as const,
        mediaType: file.type || "application/octet-stream",
        filename: file.name,
        url,
      };
    })
  );
}

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

/** Render a single UIMessagePart using the appropriate AI Element component. */
function renderPart(
  message: UIMessage,
  part: UIMessage["parts"][number],
  index: number,
  addToolApprovalResponse?: (options: { id: string; approved: boolean; reason?: string }) => void,
  onSendMessage?: (text: string) => void
): React.ReactNode {
  if (isTextUIPart(part)) {
    return (
      <MessageResponse key={`${message.id}-${index}`}>{part.text}</MessageResponse>
    );
  }

  if (isReasoningUIPart(part)) {
    return (
      <Reasoning
        key={`${message.id}-reasoning-${index}`}
        isStreaming={part.state === "streaming"}
        className="my-1.5"
      >
        <ReasoningTrigger />
        <ReasoningContent>{part.text}</ReasoningContent>
      </Reasoning>
    );
  }

  if (isFileUIPart(part)) {
    return (
      <Attachments key={`${message.id}-file-${index}`}>
        <Attachment data={{ ...part, id: `${message.id}-${index}` }} />
      </Attachments>
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
                  onClick={() => addToolApprovalResponse?.({ id: approval.id, approved: false })}
                >
                  Reject
                </ConfirmationAction>
                <ConfirmationAction
                  variant="default"
                  onClick={() => addToolApprovalResponse?.({ id: approval.id, approved: true })}
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
                  onClick={() => addToolApprovalResponse?.({ id: approval.id, approved: false })}
                >
                  Cancel
                </ConfirmationAction>
                <ConfirmationAction
                  variant="default"
                  onClick={() => addToolApprovalResponse?.({ id: approval.id, approved: true })}
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
                  onClick={() => addToolApprovalResponse?.({ id: approval.id, approved: false })}
                >
                  Cancel
                </ConfirmationAction>
                <ConfirmationAction
                  variant="default"
                  onClick={() => addToolApprovalResponse?.({ id: approval.id, approved: true })}
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
                  onClick={() => addToolApprovalResponse?.({ id: approval.id, approved: false })}
                >
                  Cancel
                </ConfirmationAction>
                <ConfirmationAction
                  variant="default"
                  onClick={() => addToolApprovalResponse?.({ id: approval.id, approved: true })}
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
                  onClick={() => addToolApprovalResponse?.({ id: approval.id, approved: false })}
                >
                  Cancel
                </ConfirmationAction>
                <ConfirmationAction
                  variant="default"
                  onClick={() => addToolApprovalResponse?.({ id: approval.id, approved: true })}
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
                  onClick={() => addToolApprovalResponse?.({ id: approval.id, approved: false })}
                >
                  Cancel
                </ConfirmationAction>
                <ConfirmationAction
                  variant="default"
                  onClick={() => addToolApprovalResponse?.({ id: approval.id, approved: true })}
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
                  onClick={() => addToolApprovalResponse?.({ id: approval.id, approved: false })}
                >
                  Cancel
                </ConfirmationAction>
                <ConfirmationAction
                  variant="default"
                  onClick={() => addToolApprovalResponse?.({ id: approval.id, approved: true })}
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
                  onClick={() => addToolApprovalResponse?.({ id: approval.id, approved: false })}
                >
                  Cancel
                </ConfirmationAction>
                <ConfirmationAction
                  variant="default"
                  onClick={() => addToolApprovalResponse?.({ id: approval.id, approved: true })}
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
                  onClick={() => addToolApprovalResponse?.({ id: approval.id, approved: false })}
                >
                  Cancel
                </ConfirmationAction>
                <ConfirmationAction
                  variant="default"
                  onClick={() => addToolApprovalResponse?.({ id: approval.id, approved: true })}
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
                  onClick={() => addToolApprovalResponse?.({ id: approval.id, approved: false })}
                >
                  Cancel
                </ConfirmationAction>
                <ConfirmationAction
                  variant="default"
                  onClick={() => addToolApprovalResponse?.({ id: approval.id, approved: true })}
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
                  onClick={() => addToolApprovalResponse?.({ id: approval.id, approved: false })}
                >
                  Cancel
                </ConfirmationAction>
                <ConfirmationAction
                  variant="default"
                  onClick={() => addToolApprovalResponse?.({ id: approval.id, approved: true })}
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
                <div className="flex items-start gap-2.5">
                  <MuvxBot
                    variant="child"
                    role={childRole}
                    size="sm"
                    mood="happy"
                    className="mt-0.5 shrink-0"
                  />
                  <div className="flex-1">
                    <ChainOfThought defaultOpen className="p-0 border-0 space-y-2">
                      <ChainOfThoughtStep
                        status="complete"
                        icon={CheckCircle2}
                        label={subtaskTitle}
                        description={objective || "Sub-agent verification and analysis complete"}
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
                    </ChainOfThought>
                  </div>
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
      message:
        toolName === "checkFleetAvailability"
          ? `Checked fleet trucks in ${input?.location || "target corridor"}`
          : `Executed ${toolName.replace(/([A-Z])/g, " $1").toLowerCase()}`,
      inputs: input,
      output:
        output?.findings || output?.result || output?.message || output,
    };

    return (
      <ToolCallsSection
        key={key}
        toolCalls={[entry]}
        defaultExpanded={isRunning}
      />
    );
  }

  return null;
}

export default function ChatInterface() {
  const [provider, setProvider] = useState<string>(DEFAULT_PROVIDER);
  const [availableModels, setAvailableModels] = useState<AIModelItem[]>([]);
  const [selectedModel, setSelectedModel] = useState("");
  const [interactiveMood, setInteractiveMood] = useState<BotMood>("idle");
  const [botCoat, setBotCoat] = useState<BotCoat>("ink");
  const [activeSpecialist, setActiveSpecialist] = useState<BotRole>("main");

  const { messages, sendMessage, status, error, addToolApprovalResponse } = useChat({
    id: "ai-chat",
  });

  const [responseJustCompleted, setResponseJustCompleted] = useState(false);
  const wasBusyRef = useRef(false);

  // Tool calls can be present in an earlier assistant message during multi-step agent runs.
  // Inspect all assistant messages so the orb stays in tool mode until the tool part reaches a terminal state.
  const isToolRunning = messages.some(
    (message) =>
      message.role === "assistant" &&
      message.parts.some(
        (part) =>
          isToolUIPart(part) &&
          (part.state === "input-streaming" ||
            part.state === "input-available" ||
            part.state === "approval-responded")
      )
  );

  useEffect(() => {
    if (status === "submitted" || status === "streaming") {
      wasBusyRef.current = true;
      setResponseJustCompleted(false);
      return;
    }

    if (status === "error") {
      wasBusyRef.current = false;
      return;
    }

    if (status === "ready" && wasBusyRef.current) {
      wasBusyRef.current = false;
      setResponseJustCompleted(true);
      const timeoutId = window.setTimeout(() => {
        setResponseJustCompleted(false);
      }, 1100);

      return () => window.clearTimeout(timeoutId);
    }
  }, [status]);

  const copilotMood: BotMood =
    status === "error"
      ? "wow"
      : status === "submitted"
        ? "think"
        : isToolRunning
          ? "tool"
          : status === "streaming"
            ? "listen"
            : responseJustCompleted
              ? "happy"
              : interactiveMood;

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
    let fileParts: FileUIPart[] | undefined;
    if (options.files && options.files.length > 0) {
      fileParts = await filesToFileUIParts(options.files);
    }

    if (fileParts && fileParts.length > 0) {
      sendMessage(
        {
          text: text.trim() || "Please review and process the attached freight document(s).",
          files: fileParts,
        },
        {
          body: {
            provider,
            model: options.model ?? selectedModel,
            webSearch: options.webSearch,
          },
        }
      );
    } else if (text.trim()) {
      sendMessage(
        { text },
        {
          body: {
            provider,
            model: options.model ?? selectedModel,
            webSearch: options.webSearch,
          },
        }
      );
    }
  };

  const handleFiles = (files: File[]) => {
    filesToFileUIParts(files).then((fileParts) => {
      sendMessage(
        { text: "Please review and process the attached freight document(s).", files: fileParts },
        {
          body: {
            provider,
            model: selectedModel,
          },
        }
      );
    });
  };

  const handleSuggestionClick = (text: string) => {
    sendWithProvider(text, { webSearch: false, model: selectedModel });
  };

  const handleSelectSpecialist = (sp: BotSpecialist) => {
    setActiveSpecialist(sp.id);
    setBotCoat(sp.coat);
    setInteractiveMood("happy");
    setTimeout(() => setInteractiveMood("idle"), 1200);
  };

  const lastAssistantMessage = [...messages].reverse().find((m) => m.role === "assistant");
  const adaptiveSuggestions = getAdaptiveSuggestions(lastAssistantMessage, activeSpecialist);
  const emptyStateSuggestions = getAdaptiveSuggestions(undefined, activeSpecialist);

  if (messages.length === 0) {
    return (
      <div className="flex h-full w-full flex-col items-center justify-center p-4 sm:p-6 overflow-y-auto">
        {error && (
          <div className="mb-4 w-full max-w-2xl rounded-xl border border-destructive/20 bg-destructive/10 px-4 py-2 text-xs text-destructive">
            {error.message}
          </div>
        )}

        <div className="w-full max-w-2xl text-center mb-5 space-y-2">
          {/* Muvx Copilot Master Bot with Pointer Tracking and Mood Expressions */}
          <MuvxBot
            size="lg"
            coat={botCoat}
            role={activeSpecialist}
            mood={copilotMood}
            showDots={copilotMood === "think"}
            className="mb-1 mx-auto"
          />

          {/* Interactive Mood Selector & Color Swatches */}
          <div className="flex flex-wrap items-center justify-center gap-2 pt-1">
            <div className="flex items-center gap-1">
              {(["idle", "listen", "think", "happy", "wow", "sleep"] as BotMood[]).map(
                (m) => (
                  <button
                    key={m}
                    type="button"
                    onClick={() => setInteractiveMood(m)}
                    className={cn(
                      "rounded-full px-2.5 py-0.5 text-[11px] font-medium transition-all capitalize",
                      interactiveMood === m && status !== "submitted" && status !== "streaming"
                        ? "bg-brand-ink text-brand-cream shadow-2xs"
                        : "bg-brand-card/80 border border-brand-rule text-brand-muted-soft hover:text-brand-ink hover:border-brand-accent/40"
                    )}
                  >
                    {m}
                  </button>
                )
              )}
            </div>

            <div className="h-4 w-px bg-brand-rule hidden sm:block" />

            {/* Coat Palette Swatches */}
            <div className="flex items-center gap-1.5">
              {[
                { id: "ink", label: "Obsidian Ink", bg: "#141414" },
                { id: "cream", label: "Warm Cream", bg: "#fff6ea" },
                { id: "peach", label: "Coral Peach", bg: "#ffb199" },
                { id: "grove", label: "Forest Grove", bg: "#163d36" },
              ].map((c) => (
                <button
                  key={c.id}
                  type="button"
                  title={c.label}
                  aria-label={c.label}
                  onClick={() => setBotCoat(c.id as BotCoat)}
                  className={cn(
                    "size-4 rounded-full border transition-transform",
                    botCoat === c.id
                      ? "ring-2 ring-brand-accent ring-offset-1 scale-110 border-transparent"
                      : "border-brand-rule hover:scale-105 opacity-80"
                  )}
                  style={{ backgroundColor: c.bg }}
                />
              ))}
            </div>
          </div>

          <h1 className="font-serif text-2xl sm:text-3xl font-medium tracking-tight text-brand-ink pt-1">
            What can I help you dispatch today?
          </h1>
          <p className="text-xs text-brand-muted-soft max-w-md mx-auto">
            Autonomous freight intelligence, rate confirmation analysis, FMCSA safety checks, and load dispatching.
          </p>
        </div>

        {/* Grok Bot Teams Concept: Specialist Team Bar */}
        <div className="w-full max-w-2xl mb-4">
          <div className="flex items-center justify-between pb-2 px-1 text-xs text-brand-muted-soft">
            <span className="font-mono text-[10px] uppercase tracking-wider font-semibold text-brand-ink/80 flex items-center gap-1.5">
              <Sparkles className="size-3 text-brand-accent" />
              Logistics Specialist Team
            </span>
            <span className="text-[10px] text-brand-muted-soft hidden sm:inline">
              Select specialist to focus AI agency
            </span>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-1.5">
            {SPECIALIST_TEAMS.map((sp) => {
              const isSelected = activeSpecialist === sp.id;
              return (
                <button
                  key={sp.id}
                  type="button"
                  onClick={() => handleSelectSpecialist(sp)}
                  className={cn(
                    "flex flex-col items-start p-2.5 rounded-xl text-left border transition-all duration-150 cursor-pointer",
                    isSelected
                      ? "border-brand-ink bg-brand-cream/80 shadow-xs ring-1 ring-brand-ink/30"
                      : "border-brand-rule bg-brand-card/70 hover:border-brand-accent/40 hover:bg-brand-cream/30 text-brand-muted-soft"
                  )}
                >
                  <div className="flex items-center gap-1.5 w-full">
                    <div
                      className="size-2 rounded-full shrink-0"
                      style={{
                        backgroundColor:
                          sp.coat === "ink"
                            ? "#141414"
                            : sp.coat === "indigo"
                              ? "#4f46e5"
                              : sp.coat === "emerald"
                                ? "#059669"
                                : sp.coat === "amber"
                                  ? "#d97706"
                                  : "#163d36",
                      }}
                    />
                    <span className="text-[11px] font-semibold text-brand-ink truncate">
                      {sp.name}
                    </span>
                  </div>
                  <span className="text-[9.5px] text-brand-muted-soft mt-0.5 line-clamp-1">
                    {sp.tagline}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Centered AI Input with Live Model Picker */}
        <div className="w-full max-w-2xl">
          <AI_Input_Search
            models={availableModels}
            selectedModel={selectedModel}
            onModelChange={setSelectedModel}
            onSubmit={sendWithProvider}
            onFilesSelected={handleFiles}
            placeholder={`Ask ${SPECIALIST_TEAMS.find((s) => s.id === activeSpecialist)?.name || "Muvx"}, draft a load, or paste rate con...`}
            searchLabel="Web Search"
          />
        </div>

        {/* Dynamic Contextual Suggestion Chips tailored to current specialist */}
        <div className="mt-4 max-w-2xl px-2">
          <Suggestions className="justify-center flex-wrap gap-1.5">
            {emptyStateSuggestions.map((item, idx) => (
              <Suggestion
                key={`${item.title}-${idx}`}
                suggestion={item.title}
                onClick={() => sendWithProvider(item.prompt, { webSearch: false, model: selectedModel })}
                className="border-brand-rule bg-brand-card text-brand-muted-soft hover:border-brand-accent/40 hover:text-brand-ink hover:bg-brand-cream/50 shadow-2xs"
              />
            ))}
          </Suggestions>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-full w-full flex-col overflow-hidden">
      {/* Grok Bot Teams Header Dots */}
      <div className="shrink-0 border-b border-brand-rule/60 bg-brand-card/40 px-4 py-2 flex items-center justify-between text-xs">
        <div className="flex items-center gap-2">
          <MuvxBot
            size="sm"
            coat={botCoat}
            role={activeSpecialist}
            mood={copilotMood}
            showDots={copilotMood === "think"}
            interactive={false}
            className="shrink-0"
          />
          <span className="font-mono text-[10px] uppercase tracking-wider text-brand-muted-soft">Team:</span>
          <div className="flex items-center gap-1.5 flex-wrap">
            {SPECIALIST_TEAMS.map((sp) => {
              const isSelected = activeSpecialist === sp.id;
              return (
                <button
                  key={sp.id}
                  type="button"
                  title={`${sp.name} · ${sp.title}`}
                  onClick={() => handleSelectSpecialist(sp)}
                  className={cn(
                    "flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10.5px] font-medium transition-all cursor-pointer",
                    isSelected
                      ? "bg-brand-ink text-brand-cream shadow-2xs"
                      : "text-brand-muted-soft hover:text-brand-ink hover:bg-brand-cream/60 border border-brand-rule/50"
                  )}
                >
                  <span
                    className="size-1.5 rounded-full"
                    style={{
                      backgroundColor:
                        sp.coat === "ink"
                          ? "#141414"
                          : sp.coat === "indigo"
                            ? "#6366f1"
                            : sp.coat === "emerald"
                              ? "#10b981"
                              : sp.coat === "amber"
                                ? "#f59e0b"
                                : "#14b8a6",
                    }}
                  />
                  <span>{sp.name}</span>
                </button>
              );
            })}
          </div>
        </div>
        <span className="font-mono text-[10px] text-brand-muted-soft hidden sm:inline">
          {SPECIALIST_TEAMS.find((s) => s.id === activeSpecialist)?.title}
        </span>
      </div>

      {/* Error display */}
      {error && (
        <div className="px-4 py-2 text-sm text-destructive shrink-0">
          {error.message}
        </div>
      )}

      {/* Message list with auto-scroll */}
      <div className="flex-1 overflow-y-auto min-h-0">
        <Conversation>
          <ConversationContent className="max-w-4xl mx-auto w-full px-4 py-4 gap-4">
            {messages.map((message, mIdx) => {
              const isLastMessage = mIdx === messages.length - 1;
              const isAssistant = message.role === "assistant";
              return (
                <Message key={message.id} from={message.role} className="gap-1.5">
                  {isAssistant && (
                    <div className="flex items-center gap-2 mb-0.5 select-none">
                      <MuvxBot
                        size="xs"
                        coat={botCoat}
                        role={activeSpecialist}
                        mood={isLastMessage ? copilotMood : "idle"}
                      />
                      <span className="text-xs font-medium text-brand-ink/90">
                        {SPECIALIST_TEAMS.find((s) => s.id === activeSpecialist)?.name || "Muvx"}
                      </span>
                    </div>
                  )}
                  <MessageContent>
                    {message.parts.map((part, i) =>
                      renderPart(
                        message,
                        part,
                        i,
                        addToolApprovalResponse,
                        (text) => sendWithProvider(text, { webSearch: false, model: selectedModel })
                      )
                    )}
                  </MessageContent>
                  {isAssistant && (
                    <MessageToolbar className="mt-1">
                      <MessageActions>
                        <CopyButton message={message} />
                      </MessageActions>
                    </MessageToolbar>
                  )}
                </Message>
              );
            })}

            {/* Thinking indicator while the model is preparing a response */}
            {status === "submitted" && (
              <Message from="assistant" className="gap-1.5">
                <div className="flex items-center gap-2 mb-0.5 select-none">
                  <MuvxBot
                    size="xs"
                    coat={botCoat}
                    role={activeSpecialist}
                    mood={copilotMood}
                    showDots={copilotMood === "think"}
                    interactive={false}
                  />
                  <span className="text-xs font-medium text-brand-ink/90">
                    {SPECIALIST_TEAMS.find((s) => s.id === activeSpecialist)?.name || "Muvx"}
                  </span>
                </div>
                <MessageContent>
                  <Shimmer duration={2}>Thinking…</Shimmer>
                </MessageContent>
              </Message>
            )}

            {/* Contextual Suggestion Chips dynamically derived from latest response */}
            {status === "ready" && messages.length > 0 && adaptiveSuggestions.length > 0 && (
              <div className="py-2 animate-in fade-in slide-in-from-bottom-2 duration-200">
                <div className="text-[10px] font-mono uppercase tracking-wider text-brand-muted-soft mb-1.5 flex items-center gap-1.5">
                  <Sparkles className="size-3 text-brand-accent" />
                  Suggested Next Steps
                </div>
                <Suggestions className="justify-start flex-wrap gap-1.5">
                  {adaptiveSuggestions.map((item, idx) => (
                    <Suggestion
                      key={`${item.title}-${idx}`}
                      suggestion={item.title}
                      onClick={() => sendWithProvider(item.prompt, { webSearch: false, model: selectedModel })}
                      className="text-xs border-brand-rule bg-brand-card/80 text-brand-muted-soft hover:text-brand-ink hover:border-brand-accent/40 hover:bg-brand-cream/50 shadow-2xs transition-all cursor-pointer"
                    />
                  ))}
                </Suggestions>
              </div>
            )}
          </ConversationContent>
          <ConversationScrollButton />
        </Conversation>
      </div>

      {/* Input container: clean, compact, centered */}
      <div className="shrink-0 max-w-2xl mx-auto w-full px-4 pb-4 pt-1">
        <AI_Input_Search
          models={availableModels}
          selectedModel={selectedModel}
          onModelChange={setSelectedModel}
          onSubmit={sendWithProvider}
          onFilesSelected={handleFiles}
          placeholder={`Message ${SPECIALIST_TEAMS.find((s) => s.id === activeSpecialist)?.name || "Muvx"}...`}
          searchLabel="Web Search"
        />
      </div>
    </div>
  );
}
