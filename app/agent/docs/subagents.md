# Subagents - Official AI SDK Documentation

Source: https://ai-sdk.dev/docs/agents/subagents

## Basic Subagent Without Streaming

```ts
import { ToolLoopAgent, tool } from 'ai';
import { z } from 'zod';

const researchSubagent = new ToolLoopAgent({
  model: "anthropic/claude-sonnet-5.5",
  instructions: `You are a research agent. Summarize your findings.`,
  tools: { read: readFileTool, search: searchTool },
});

const researchTool = tool({
  description: 'Research a topic in depth.',
  inputSchema: z.object({
    task: z.string().describe('The research task'),
  }),
  execute: async ({ task }, { abortSignal }) => {
    const result = await researchSubagent.generate({
      prompt: task,
      abortSignal,
    });
    return result.text;
  },
});

const mainAgent = new ToolLoopAgent({
  model: "anthropic/claude-sonnet-5.5",
  instructions: 'You are a helpful assistant.',
  tools: { research: researchTool },
});
```

## Streaming Subagent Progress

```ts
import { readUIMessageStream, toUIMessageStream, tool } from 'ai';
import { z } from 'zod';

const researchTool = tool({
  description: 'Research a topic in depth.',
  inputSchema: z.object({ task: z.string() }),
  execute: async function* ({ task }, { abortSignal }) {
    const result = await researchSubagent.stream({ prompt: task, abortSignal });

    for await (const message of readUIMessageStream({
      stream: toUIMessageStream({ stream: result.stream }),
    })) {
      yield message;
    }
  },
});
```

## Controlling What the Model Sees

```ts
const researchTool = tool({
  description: 'Research a topic in depth.',
  inputSchema: z.object({ task: z.string() }),
  execute: async function* ({ task }, { abortSignal }) {
    const result = await researchSubagent.stream({ prompt: task, abortSignal });

    for await (const message of readUIMessageStream({
      stream: toUIMessageStream({ stream: result.stream }),
    })) {
      yield message;
    }
  },
  toModelOutput: ({ output: message }) => {
    const lastTextPart = message?.parts.findLast(p => p.type === 'text');
    return {
      type: 'text',
      value: lastTextPart?.text ?? 'Task completed.',
    };
  },
});
```

## Subagent with Full History Access

```ts
execute: async ({ task }, { abortSignal, messages }) => {
  const result = await researchSubagent.generate({
    messages: [
      ...messages,
      { role: 'user', content: task },
    ],
    abortSignal,
  });
  return result.text;
},
```

## Caveats

- No tool approvals in subagents
- Subagent context is isolated from parent
- Streaming adds complexity
