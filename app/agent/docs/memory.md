# Memory - Official AI SDK Documentation

Source: https://ai-sdk.dev/docs/agents/memory

## Three Approaches

| Approach | Effort | Flexibility | Provider Lock-in |
|----------|--------|-------------|-----------------|
| Provider-Defined Tools | Low | Medium | Yes |
| Memory Providers | Low | Low | Depends |
| Custom Tool | High | High | No |

## Custom Tool (Most Flexible)

Building your own memory tool from scratch gives you full control over storage format, interface, and retrieval logic.

```ts
import { ToolLoopAgent, tool } from 'ai';
import { z } from 'zod';

// Custom memory tool
const memoryTool = tool({
  description: 'Store and retrieve information',
  inputSchema: z.object({
    action: z.enum(['store', 'retrieve']),
    key: z.string(),
    value: z.string().optional(),
  }),
  execute: async ({ action, key, value }) => {
    if (action === 'store') {
      await memoryStore.set(key, value);
      return { stored: true };
    }
    return { value: await memoryStore.get(key) };
  },
});

const agent = new ToolLoopAgent({
  model: "anthropic/claude-sonnet-5.5",
  tools: { memory: memoryTool },
});
```
