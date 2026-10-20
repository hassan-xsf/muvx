# Loop Control - Official AI SDK Documentation

Source: https://ai-sdk.dev/docs/agents/loop-control

## Stop Conditions

The `stopWhen` parameter controls when to stop execution when there are tool results in the last step.

The loop continues until:
- A finish reasoning other than tool-calls is returned, or
- A tool that is invoked does not have an execute function, or
- A tool call needs approval, or
- A stop condition is met

### Built-in Conditions

- `isStepCount(count)` — stops after a specified number of steps
- `hasToolCall(...toolNames)` — stops when any of the specified tools is called
- `isLoopFinished()` — never triggers, letting the loop run until naturally finished

### Run Up to a Maximum Number of Steps

```ts
import { ToolLoopAgent, isStepCount } from 'ai';

const agent = new ToolLoopAgent({
  model: "anthropic/claude-sonnet-5.5",
  tools: { /* your tools */ },
  stopWhen: isStepCount(50),
});
```

### Run Until Finished

```ts
import { ToolLoopAgent, isLoopFinished } from 'ai';

const agent = new ToolLoopAgent({
  model: "anthropic/claude-sonnet-5.5",
  tools: { /* your tools */ },
  stopWhen: isLoopFinished(), // No maximum step limit.
});
```

### Combine Multiple Conditions

```ts
import { ToolLoopAgent, isStepCount, hasToolCall } from 'ai';

const agent = new ToolLoopAgent({
  model: "anthropic/claude-sonnet-5.5",
  tools: { /* your tools */ },
  stopWhen: [
    isStepCount(20),
    hasToolCall('someTool', 'done'),
  ],
});
```

### Create Custom Conditions

```ts
import { ToolLoopAgent, StopCondition, ToolSet } from 'ai';

const tools = { /* your tools */ } satisfies ToolSet;

const hasAnswer: StopCondition<typeof tools> = ({ steps }) => {
  return steps.some(step => step.text?.includes('ANSWER:')) ?? false;
};

const agent = new ToolLoopAgent({
  model: "anthropic/claude-sonnet-5.5",
  tools,
  stopWhen: hasAnswer,
});
```

## Prepare Step

The `prepareStep` callback runs before each step in the loop.

### Dynamic Model Selection

```ts
import { ToolLoopAgent } from 'ai';

const agent = new ToolLoopAgent({
  model: 'openai/gpt-6-luna',
  tools: { /* your tools */ },
  prepareStep: async ({ stepNumber, messages }) => {
    if (stepNumber > 2 && messages.length > 10) {
      return { model: "anthropic/claude-sonnet-5.5" };
    }
    return {};
  },
});
```

### Context Management

```ts
import { ToolLoopAgent, pruneMessages, type ModelMessage } from 'ai';

const COMPACTION_THRESHOLD = 100_000;
const estimateTokens = (messages: ModelMessage[]) => JSON.stringify(messages).length / 4;

const agent = new ToolLoopAgent({
  model: "anthropic/claude-sonnet-5.5",
  tools: { /* your tools */ },
  prepareStep: async ({ messages }) => {
    if (estimateTokens(messages) > COMPACTION_THRESHOLD) {
      return {
        messages: pruneMessages({
          messages,
          reasoning: 'all',
          toolCalls: 'before-last-3-messages',
          emptyMessages: 'remove',
        }),
      };
    }
  },
});
```

### Tool Selection

```ts
import { ToolLoopAgent } from 'ai';

const agent = new ToolLoopAgent({
  model: "anthropic/claude-sonnet-5.5",
  tools: { search: searchTool, analyze: analyzeTool, summarize: summarizeTool },
  prepareStep: async ({ stepNumber }) => {
    if (stepNumber <= 2) return { activeTools: ['search'], toolChoice: 'required' };
    if (stepNumber <= 5) return { activeTools: ['analyze'] };
    return { activeTools: ['summarize'], toolChoice: 'required' };
  },
});
```

## Forced Tool Calling

```ts
import { ToolLoopAgent, tool } from 'ai';
import { z } from 'zod';

const agent = new ToolLoopAgent({
  model: "anthropic/claude-sonnet-5.5",
  tools: {
    search: searchTool,
    analyze: analyzeTool,
    done: tool({
      description: 'Signal that you have finished your work',
      inputSchema: z.object({
        answer: z.string().describe('The final answer'),
      }),
      // No execute function - stops the agent when called
    }),
  },
  toolChoice: 'required',
});
```
