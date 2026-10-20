# Workflow Patterns - Official AI SDK Documentation

Source: https://ai-sdk.dev/docs/agents/workflows

## Patterns

### Sequential Processing (Chains)

```ts
import { generateText, Output } from 'ai';
import { z } from 'zod';

async function generateMarketingCopy(input: string) {
  const model = "anthropic/claude-sonnet-5.5";

  const { text: copy } = await generateText({
    model,
    prompt: `Write persuasive marketing copy for: ${input}`,
  });

  const { output: qualityMetrics } = await generateText({
    model,
    output: Output.object({
      schema: z.object({
        hasCallToAction: z.boolean(),
        emotionalAppeal: z.number().min(1).max(10),
        clarity: z.number().min(1).max(10),
      }),
    }),
    prompt: `Evaluate this marketing copy: ${copy}`,
  });

  if (!qualityMetrics.hasCallToAction || qualityMetrics.emotionalAppeal < 7) {
    const { text: improvedCopy } = await generateText({
      model,
      prompt: `Rewrite with a clear call to action: ${copy}`,
    });
    return { copy: improvedCopy, qualityMetrics };
  }

  return { copy, qualityMetrics };
}
```

### Routing

```ts
import { generateText, Output } from 'ai';
import { z } from 'zod';

async function handleCustomerQuery(query: string) {
  const { output: classification } = await generateText({
    model: "anthropic/claude-sonnet-5.5",
    output: Output.object({
      schema: z.object({
        type: z.enum(['general', 'refund', 'technical']),
        complexity: z.enum(['simple', 'complex']),
      }),
    }),
    prompt: `Classify: ${query}`,
  });

  const { text: response } = await generateText({
    model: classification.complexity === 'simple'
      ? 'openai/gpt-6-luna'
      : 'openai/gpt-6-astra',
    instructions: {
      general: 'You are a general customer service agent.',
      refund: 'You specialize in refund requests.',
      technical: 'You are a technical support specialist.',
    }[classification.type],
    prompt: query,
  });

  return { response, classification };
}
```

### Parallel Processing

```ts
import { generateText, Output } from 'ai';

async function parallelCodeReview(code: string) {
  const model = "anthropic/claude-sonnet-5.5";
  const [security, performance, maintainability] = await Promise.all([
    generateText({
      model,
      instructions: 'You are a code security expert.',
      output: Output.object({
        schema: z.object({
          vulnerabilities: z.array(z.string()),
          riskLevel: z.enum(['low', 'medium', 'high']),
        }),
      }),
      prompt: `Review code for security: ${code}`,
    }),
    generateText({
      model,
      instructions: 'You are a code performance expert.',
      output: Output.object({
        schema: z.object({
          issues: z.array(z.string()),
          impact: z.enum(['low', 'medium', 'high']),
        }),
      }),
      prompt: `Review code for performance: ${code}`,
    }),
    generateText({
      model,
      instructions: 'You are a code quality expert.',
      output: Output.object({
        schema: z.object({
          qualityScore: z.number().min(1).max(10),
          recommendations: z.array(z.string()),
        }),
      }),
      prompt: `Review code for quality: ${code}`,
    }),
  ]);

  return { security, performance, maintainability };
}
```
