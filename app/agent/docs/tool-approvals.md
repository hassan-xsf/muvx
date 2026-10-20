# Tool Approvals - Official AI SDK Documentation

Source: https://ai-sdk.dev/docs/agents/tool-approvals

## Overview

Tool execution approval lets you require user confirmation before a server-side tool runs.

Use tool execution approval when you want to:
- Confirm sensitive operations (payments, deletions, external API calls)
- Let users review tool inputs before execution
- Add human oversight to automated workflows

## Server Setup

Enable approval with `toolApproval` on `streamText`:

```ts
import {
  createUIMessageStreamResponse,
  streamText,
  tool,
  toUIMessageStream,
} from 'ai';
import { z } from 'zod';

export async function POST(req: Request) {
  const { messages } = await req.json();

  const result = streamText({
    model: "anthropic/claude-sonnet-5.5",
    messages,
    tools: {
      getWeather: tool({
        description: 'Get the weather in a location',
        inputSchema: z.object({ city: z.string() }),
        execute: async ({ city }) => {
          const weather = await fetchWeather(city);
          return weather;
        },
      }),
    },
    toolApproval: {
      getWeather: 'user-approval',
    },
  });

  return createUIMessageStreamResponse({
    stream: toUIMessageStream({ stream: result.stream }),
  });
}
```

## How Manual Approval Works

When a tool requires manual approval, `generateText` and `streamText` don't pause execution. Instead, they complete and return `tool-approval-request` parts in the result content.

**Manual approval flow requires two calls to the model:**
1. Call `generateText` or `streamText` with `toolApproval`
2. The model generates a tool call → returns `tool-approval-request` parts
3. Your app requests approval and collects the user's decision
4. Add a `tool-approval-response` to the messages array
5. Call `generateText` or `streamText` again with the updated messages
6. If approved, the tool runs and returns a result

## Client-Side Approval UI

```tsx
'use client';

import { useChat } from '@ai-sdk/react';

export default function Chat() {
  const { messages, addToolApprovalResponse } = useChat();

  return (
    <>
      {messages.map(message => (
        <div key={message.id}>
          {message.parts.map(part => {
            if (part.type === 'tool-getWeather') {
              switch (part.state) {
                case 'approval-requested': {
                  if (part.approval.isAutomatic) {
                    return (
                      <div key={part.toolCallId}>
                        Checking approval for {part.input.city}...
                      </div>
                    );
                  }
                  return (
                    <div key={part.toolCallId}>
                      <p>Get weather for {part.input.city}?</p>
                      {part.approval.requestReason && (
                        <p>{part.approval.requestReason}</p>
                      )}
                      <button
                        onClick={() =>
                          addToolApprovalResponse({
                            id: part.approval.id,
                            approved: true,
                          })
                        }
                      >
                        Approve
                      </button>
                      <button
                        onClick={() =>
                          addToolApprovalResponse({
                            id: part.approval.id,
                            approved: false,
                          })
                        }
                      >
                        Deny
                      </button>
                    </div>
                  );
                }
              }
            }
          })}
        </div>
      ))}
    </>
  );
}
```

## Auto-Submit After Approval

Use `lastAssistantMessageIsCompleteWithApprovalResponses` to automatically continue:

```tsx
import { useChat } from '@ai-sdk/react';
import { lastAssistantMessageIsCompleteWithApprovalResponses } from 'ai';

const { messages, addToolApprovalResponse } = useChat({
  sendAutomaticallyWhen: lastAssistantMessageIsCompleteWithApprovalResponses,
});
```

## Tool Approval with ToolLoopAgent

```ts
const agent = new ToolLoopAgent({
  model: "anthropic/claude-sonnet-5.5",
  tools: {
    runCode: tool({
      description: 'Execute Python code',
      inputSchema: z.object({ code: z.string() }),
      execute: async ({ code }) => ({ output: code }),
    }),
  },
  toolApproval: {
    runCode: 'user-approval',
  },
});
```

## Per-tool Object Form

```ts
toolApproval: {
  runCommand: {
    type: 'user-approval',
    reason: 'filesystem changes require operator review',
  },
}
```

## Generic toolApproval Function

```ts
toolApproval: ({
  toolCall,
  tools,
  toolsContext,
  messages,
  runtimeContext,
}) => {
  if (toolCall.toolName === 'runCommand' && !toolCall.dynamic) {
    return 'user-approval';
  }
  return undefined;
},
```

## Dynamic Approval

```ts
const paymentTool = tool({
  description: 'Process a payment',
  inputSchema: z.object({
    amount: z.number(),
    recipient: z.string(),
  }),
  execute: async ({ amount, recipient }) => processPayment(amount, recipient),
});

const result = await generateText({
  model: "anthropic/claude-sonnet-5.5",
  tools: { processPayment: paymentTool },
  toolApproval: {
    processPayment: async ({ amount }) =>
      amount > 1000 ? 'user-approval' : undefined,
  },
  prompt: 'Send $1500 to the contractor',
});
```

## Securing Approvals

For tools that perform sensitive operations, add `experimental_toolApprovalSecret`:

```ts
const result = streamText({
  model: "anthropic/claude-sonnet-5.5",
  messages,
  tools: { deleteFile },
  toolApproval: { deleteFile: 'user-approval' },
  experimental_toolApprovalSecret: process.env.TOOL_APPROVAL_SECRET,
});
```

## Handling Approval Requests

After calling `generateText` or `streamText`, check `result.content` for `tool-approval-request` parts:

```ts
import { type ModelMessage, generateText } from 'ai';

const messages: ModelMessage[] = [{ role: 'user', content: 'Remove the most recent file' }];
const result = await generateText({
  model: "anthropic/claude-sonnet-5.5",
  tools: { runCommand },
  toolApproval: { runCommand: 'user-approval' },
  messages,
});

messages.push(...result.responseMessages);

for (const part of result.content) {
  if (part.type === 'tool-approval-request' && !part.isAutomatic) {
    console.log(part.approvalId);
    console.log(part.toolCall);
    console.log(part.reason);
  }
}
```

## Tool Execution Lifecycle Callbacks

```ts
const result = await generateText({
  onToolExecutionStart({ toolCall }) {
    console.log(`Tool call starting: ${toolCall.toolName}`, {
      toolCallId: toolCall.toolCallId,
      input: toolCall.input,
    });
  },
  onToolExecutionEnd({ toolCall, toolExecutionMs, toolOutput }) {
    if (toolOutput.type === 'tool-error') {
      console.error(
        `Tool ${toolCall.toolName} failed after ${toolExecutionMs}ms:`,
        toolOutput.error,
      );
    } else {
      console.log(
        `Tool ${toolCall.toolName} completed in ${toolExecutionMs}ms`,
        { output: toolOutput.output },
      );
    }
  },
});
```
