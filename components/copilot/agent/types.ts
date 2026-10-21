/**
 * Streaming-message event types for the Muvx Copilot.
 *
 * This is a focused subset of AI-Agent's `useStream-events` schema, kept
 * small enough to map 1:1 onto `@ai-sdk/react` UIMessage parts. The shapes
 * are deliberately a superset — extra fields are ignored — so when we
 * upgrade to a true SSE backend later, all of these types stay valid.
 *
 * Vocabulary mirrors VS Code's ChatResponseStream:
 *   vscode-copilot-chat/src/util/common/chatResponseStreamImpl.ts
 */

export type ToolCallState =
  | "calling"
  | "input-streaming"
  | "input-available"
  | "executing"
  | "output-available"
  | "output-error"
  /** Model asked the operator; waiting for a decision. */
  | "approval-requested"
  /** Operator answered; the SDK will execute on the next generation. */
  | "approval-responded";

/** The approval handshake as the SDK hands it to the UI. */
export interface ToolApproval {
  id: string;
  approved?: boolean;
  reason?: string;
  requestReason?: string;
}

/** Callback signature used by the approval card. */
export type ApprovalResponder = (options: {
  id: string;
  approved: boolean;
  reason?: string;
  toolName?: string;
  source?: string;
}) => void;

export interface ToolCallEvent {
  id: string;
  toolCallId: string;
  toolName: string;
  /** Discriminator for the StreamPart union; always starts with `tool-call-`. */
  type:
    | "tool-call-start"
    | "tool-call-input-streaming"
    | "tool-call-input-available"
    | "tool-call-execute"
    | "tool-call-output-available"
    | "tool-call-output-error";
  /** Present-tense status shown while running. */
  invocationMessage?: string;
  /** Past-tense status shown after completion. */
  pastTenseMessage?: string;
  args?: Record<string, unknown>;
  result?: unknown;
  errorText?: string;
  state: ToolCallState;
  /** Present when the tool is gated behind operator approval. */
  approval?: ToolApproval;
}

export interface ReasoningPartEvent {
  id: string;
  type: "reasoning-start" | "reasoning-delta" | "reasoning-end";
  text: string;
}

export interface TextDeltaEvent {
  id: string;
  type: "text-delta" | "text-end";
  text: string;
}

export interface SourceUrlEvent {
  id: string;
  type: "source-url";
  url: string;
  title?: string;
}

export interface WarningEvent {
  id: string;
  type: "warning";
  text: string;
}

export interface UsageEvent {
  id: string;
  type: "usage";
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
}

export interface StreamErrorEvent {
  id: string;
  type: "stream-error";
  message: string;
  provider?: string | null;
}

export interface ProgressEvent {
  id: string;
  type: "progress";
  label: string;
  status: "loading" | "complete" | "error";
  detail?: string;
}

export interface SubagentEvent {
  id: string;
  toolCallId?: string;
  type: "subagent-start" | "subagent-progress" | "subagent-stream-delta" | "subagent-result";
  agentName?: string;
  prompt?: string;
  status?: "loading" | "complete" | "error";
  text?: string;
  result?: unknown;
  runId?: string;
  logUrl?: string;
  kind?: string;
}

export interface MessageAttachment {
  url: string;
  name: string;
  mimeType: string;
}

export type StreamPart =
  | ReasoningPartEvent
  | ToolCallEvent
  | TextDeltaEvent
  | SourceUrlEvent
  | ProgressEvent
  | SubagentEvent
  | WarningEvent
  | UsageEvent
  | StreamErrorEvent;

export interface StreamingMessage {
  id: string;
  role: "user" | "assistant";
  orderedParts: StreamPart[];
  isComplete: boolean;
  isStreaming: boolean;
  attachments?: MessageAttachment[];
}

/**
 * Adapter: turn an `@ai-sdk/react` UIMessage into our own orderedParts
 * representation. Kept inside this file so the components can stay pure.
 */
import type { UIMessage } from "ai";
import { isFileUIPart, isReasoningUIPart, isTextUIPart, isToolUIPart, isDataUIPart } from "ai";

let _idCounter = 0;
const nid = (prefix: string) => `${prefix}-${++_idCounter}`;

export function fromUIMessage(message: UIMessage, isStreaming: boolean): StreamingMessage {
  const parts: StreamPart[] = [];
  let idx = 0;
  for (const part of message.parts) {
    idx++;
    if (isTextUIPart(part)) {
      parts.push({
        id: `${message.id}-text-${idx}`,
        type: part.text ? "text-delta" : "text-end",
        text: part.text ?? "",
      });
      continue;
    }
    if (isReasoningUIPart(part)) {
      parts.push({
        id: `${message.id}-reasoning-${idx}`,
        type: part.state === "streaming" ? "reasoning-delta" : "reasoning-end",
        text: part.text,
      });
      continue;
    }
    if (isToolUIPart(part)) {
      const toolPart = part as unknown as {
        toolCallId?: string;
        type?: string;
        toolName?: string;
        state?: string;
        input?: unknown;
        output?: unknown;
        approval?: { id?: string; approved?: boolean };
        errorText?: string;
      };
      const toolName =
        toolPart.toolName && toolPart.toolName !== "tool"
          ? toolPart.toolName
          : toolPart.type?.startsWith("tool-")
            ? toolPart.type.slice(5)
            : "tool";
      const mapState = (s?: string): ToolCallState => {
        if (s === "input-streaming" || s === "input-available") return s;
        if (s === "output-available" || s === "output-error") return s;
        // Approval states are kept verbatim — the renderer needs them to show
        // the Approve/Reject card. Collapsing them to "calling" (as an earlier
        // revision did) silently dropped the only interactive affordance in
        // the whole message, which is why clicking Approve did nothing.
        if (s === "approval-requested" || s === "approval-responded") return s;
        return "input-available";
      };
      const mapType = (s?: string): ToolCallEvent["type"] => {
        if (s === "input-streaming") return "tool-call-input-streaming";
        if (s === "input-available") return "tool-call-input-available";
        if (s === "output-available") return "tool-call-output-available";
        if (s === "output-error") return "tool-call-output-error";
        return "tool-call-start";
      };
      parts.push({
        id: nid("tool"),
        type: mapType(toolPart.state),
        toolCallId: toolPart.toolCallId ?? nid("call"),
        toolName,
        state: mapState(toolPart.state),
        args: (toolPart.input as Record<string, unknown>) ?? {},
        result: toolPart.output,
        errorText: toolPart.errorText,
        approval: toolPart.approval as ToolApproval | undefined,
      } satisfies ToolCallEvent);
      continue;
    }
    if (isFileUIPart(part)) {
      // Files attached to user messages are surfaced via attachments below.
      continue;
    }
    if (isDataUIPart(part)) {
      // We forward `data-cot-step` chains as progress so the CoT UI keeps
      // the live shimmer alive even after the assistant message ends.
      if (part.type === "data-cot-step") {
        const data = (part as { data?: unknown }).data as
          | { label?: string; description?: string; status?: "active" | "complete" | "pending"; error?: string }
          | undefined;
        const status = data?.status ?? "complete";
        parts.push({
          id: nid("progress"),
          type: "progress",
          label: data?.label?.trim() || data?.description?.trim() || "Working",
          status: status === "active" ? "loading" : status === "pending" ? "loading" : "complete",
          detail: data?.error,
        });
      }
    }
  }

  // Attachments are pulled from file parts and rendered alongside the user
  // bubble via FilePartList. We only emit them for user messages — for
  // assistant messages, file parts are inferred outputs.
  let attachments: MessageAttachment[] | undefined;
  if (message.role === "user") {
    const atts: MessageAttachment[] = [];
    for (const part of message.parts) {
      if (isFileUIPart(part)) {
        atts.push({
          url: part.url,
          name: part.filename ?? "Attachment",
          mimeType: part.mediaType ?? "application/octet-stream",
        });
      }
    }
    if (atts.length > 0) attachments = atts;
  }

  return {
    id: message.id,
    role: message.role as "user" | "assistant",
    orderedParts: parts,
    isComplete: !isStreaming,
    isStreaming,
    attachments,
  };
}
