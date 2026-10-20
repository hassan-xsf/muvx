# Building Agents - Official AI SDK Documentation

Source: https://ai-sdk.dev/docs/agents/building-agents

## Why Use the ToolLoopAgent Class?

When building AI applications, you often need to:

- **Reuse configurations** - Same model settings, tools, and prompts across different parts of your application
- **Maintain consistency** - Ensure the same behavior and capabilities throughout your codebase
- **Simplify API routes** - Reduce boilerplate in your endpoints
- **Type safety** - Get full TypeScript support for your agent's tools and outputs

The ToolLoopAgent class provides a single place to define your agent's behavior.

## Creating an Agent

Define an agent by instantiating the ToolLoopAgent class with your desired configuration:

```ts
import { ToolLoopAgent } from 'ai';

const myAgent = new ToolLoopAgent({
  model: "anthropic/claude-sonnet-5.5",
  instructions: 'You are a helpful assistant.',
  tools: {
    // Your tools here
  },
});
```

## Configuration Options

### Model and System Instructions

```ts
import { ToolLoopAgent } from 'ai';

const agent = new ToolLoopAgent({
  model: "anthropic/claude-sonnet-5.5",
  instructions: 'You are an expert software engineer.',
});
```

### Tools

```ts
import { ToolLoopAgent, tool } from 'ai';
import { z } from 'zod';

const codeAgent = new ToolLoopAgent({
  model: "anthropic/claude-sonnet-5.5",
  tools: {
    runCode: tool({
      description: 'Execute Python code',
      inputSchema: z.object({
        code: z.string(),
      }),
      execute: async ({ code }) => {
        // Execute code and return result
        return { output: 'Code executed successfully' };
      },
    }),
  },
});
```

### Context and Agent State

```ts
import { ToolLoopAgent, tool } from 'ai';
import { z } from 'zod';

const agent = new ToolLoopAgent({
  model: "anthropic/claude-sonnet-5.5",
  tools: {
    searchTickets: tool({
      description: 'Search support tickets',
      inputSchema: z.object({
        query: z.string(),
      }),
      contextSchema: z.object({
        apiKey: z.string(),
        accountId: z.string(),
      }),
      execute: async ({ query }, { context }) =>
        searchTickets(query, context.accountId, context.apiKey),
    }),
  },
  runtimeContext: {
    requestId: 'req_abc',
    escalated: false,
  },
  toolsContext: {
    searchTickets: {
      apiKey: process.env.SUPPORT_API_KEY!,
      accountId: 'acct_123',
    },
  },
  prepareStep: async ({ runtimeContext }) => {
    if (runtimeContext.escalated) {
      return { temperature: 0.1 };
    }
    return {};
  },
});

const result = await agent.generate({
  prompt: 'Find open billing tickets for this account.',
});
```

### Loop Control

By default, agents run for 20 steps (`stopWhen: isStepCount(20)`).

```ts
import { ToolLoopAgent, isStepCount } from 'ai';

const agent = new ToolLoopAgent({
  model: "anthropic/claude-sonnet-5.5",
  stopWhen: isStepCount(50), // Increase default from 20 to 50.
});
```

## Using an Agent

### Stream Text

```ts
const result = await myAgent.stream({
  prompt: 'Tell me a story',
});

for await (const chunk of result.textStream) {
  console.log(chunk);
}
```

### Respond to UI Messages

```ts
// In your API route (e.g., app/api/chat/route.ts)
import { createAgentUIStreamResponse } from 'ai';

export async function POST(request: Request) {
  const { messages } = await request.json();

  return createAgentUIStreamResponse({
    agent: myAgent,
    uiMessages: messages,
  });
}
```

### Lifecycle Callbacks

```ts
const result = await myAgent.generate({
  prompt: 'Research and summarize the latest AI trends',

  onStart({ modelId }) {
    console.log('Agent started', { modelId });
  },

  onStepStart({ stepNumber, modelId }) {
    console.log(`Step ${stepNumber} starting`, { modelId });
  },

  onToolExecutionStart({ toolCall }) {
    console.log(`Tool call starting: ${toolCall.toolName}`);
  },

  onToolExecutionEnd({ toolCall, toolExecutionMs, toolOutput }) {
    console.log(
      `Tool call finished: ${toolCall.toolName} (${toolExecutionMs}ms)`,
      {
        success: toolOutput.type === 'tool-result',
      },
    );
  },

  onStepEnd({ stepNumber, usage, performance, finishReason, toolCalls }) {
    console.log(`Step ${stepNumber} completed:`, {
      inputTokens: usage.inputTokens,
      outputTokens: usage.outputTokens,
      outputTokensPerSecond: performance.effectiveOutputTokensPerSecond,
      stepTimeMs: performance.stepTimeMs,
      finishReason,
      toolsUsed: toolCalls?.map(tc => tc.toolName),
    });
  },

  onEnd({ usage, steps }) {
    console.log('Agent finished:', {
      totalSteps: steps.length,
      totalTokens: usage.totalTokens,
    });
  },
});
```

## End-to-end Type Safety

```ts
import { ToolLoopAgent, InferAgentUIMessage } from 'ai';

const myAgent = new ToolLoopAgent({
  // ... configuration
});

// Infer the UIMessage type for UI components or persistence
export type MyAgentUIMessage = InferAgentUIMessage<typeof myAgent>;
```

## Next Steps

- Explore [workflow patterns](/docs/agents/workflows) for structured patterns
- Learn about [loop control](/docs/agents/loop-control) for advanced execution control
