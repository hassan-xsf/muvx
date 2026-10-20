# Configuring Call Options - Official AI SDK Documentation

Source: https://ai-sdk.dev/docs/agents/configuring-call-options

## How It Works

1. **Define the schema** with `callOptionsSchema`
2. **Configure with `prepareCall`** to modify agent settings
3. **Pass options at runtime** when calling `generate()` or `stream()`

## Basic Example

```ts
import { ToolLoopAgent } from 'ai';
import { z } from 'zod';

const supportAgent = new ToolLoopAgent({
  model: "anthropic/claude-sonnet-5.5",
  callOptionsSchema: z.object({
    userId: z.string(),
    accountType: z.enum(['free', 'pro', 'enterprise']),
  }),
  instructions: 'You are a helpful customer support agent.',
  prepareCall: ({ options, ...settings }) => ({
    ...settings,
    instructions:
      settings.instructions +
      `\nUser context:
- Account type: ${options.accountType}
- User ID: ${options.userId}`,
  }),
});

const result = await supportAgent.generate({
  prompt: 'How do I upgrade my account?',
  options: {
    userId: 'user_123',
    accountType: 'free',
  },
});
```

## Dynamic Model Selection

```ts
const agent = new ToolLoopAgent({
  model: "anthropic/claude-sonnet-5.5",
  callOptionsSchema: z.object({
    complexity: z.enum(['simple', 'complex']),
  }),
  prepareCall: ({ options, ...settings }) => ({
    ...settings,
    model:
      options.complexity === 'simple'
        ? 'openai/gpt-6-luna'
        : 'openai/gpt-6-astra',
  }),
});
```

## Using with createAgentUIStreamResponse

```ts title="app/api/chat/route.ts"
import { createAgentUIStreamResponse } from 'ai';
import { myAgent } from '@/ai/agents/my-agent';

export async function POST(request: Request) {
  const { messages, userId, accountType } = await request.json();

  return createAgentUIStreamResponse({
    agent: myAgent,
    messages,
    options: { userId, accountType },
  });
}
```
