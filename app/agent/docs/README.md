# Agent Documentation Index

Official AI SDK Agent Documentation sourced from https://ai-sdk.dev/docs/

## Core Agent Documentation

| Document | Description |
|----------|-------------|
| [building-agents.md](./building-agents.md) | ToolLoopAgent class, configuration, lifecycle callbacks |
| [loop-control.md](./loop-control.md) | stopWhen, prepareStep, custom stop conditions |
| [tool-approvals.md](./tool-approvals.md) | user-approval flow, auto-submit, ToolLoopAgent integration |
| [configuring-call-options.md](./configuring-call-options.md) | callOptionsSchema, prepareCall, dynamic configuration |
| [workflows.md](./workflows.md) | Sequential, parallel, routing, orchestrator patterns |
| [subagents.md](./subagents.md) | Subagent patterns, streaming, toModelOutput |
| [memory.md](./memory.md) | Memory approaches, custom tool implementation |

## Key Patterns

### ToolLoopAgent (In-Memory Agent)

```ts
import { ToolLoopAgent, tool, isStepCount } from 'ai';

const agent = new ToolLoopAgent({
  model: "anthropic/claude-sonnet-5.5",
  instructions: 'You are a helpful assistant.',
  tools: { /* your tools */ },
  stopWhen: isStepCount(20),
  toolApproval: { /* per-tool approval config */ },
});
```

### API Route Pattern

```ts
import { createAgentUIStreamResponse } from 'ai';

export async function POST(request: Request) {
  const { messages } = await request.json();

  return createAgentUIStreamResponse({
    agent: myAgent,
    uiMessages: messages,
  });
}
```

### Approval Flow

1. Tool requires `user-approval` in `toolApproval` config
2. First call → returns `tool-approval-request` parts
3. User approves via `addToolApprovalResponse({ id, approved })`
4. Second call → tool executes, returns result

## Important Notes

- **Two-call flow**: Manual approval requires TWO calls to streamText/generateText
- `execute` runs on the SECOND call after approval response is in messages
- Use `onToolExecutionStart`/`onToolExecutionEnd` callbacks for visibility
- `sendAutomaticallyWhen: lastAssistantMessageIsCompleteWithApprovalResponses` for auto-submit
