# Β (Beta) — Broadcast

One-to-many messaging: a lead agent broadcasts a question to all workers, who respond in parallel, then the lead synthesizes.

**Category: Communication Pattern** | **Communication: Broadcast + Manager Synthesis**

## Behavior

The template text is treated as the question. It's broadcast to all worker agents simultaneously. Each worker responds with their expert analysis. The lead (planner model) synthesizes all responses into a final recommendation.

## Usage

```js
// Default: 4 workers
await Β`gather feedback on this architecture proposal`

// More workers
await Β({ workers: 5 })`collect diverse perspectives on this database design`

// Custom roles
await Β({ roles: [
  'Database Performance Expert',
  'Security Auditor',
  'Frontend Architect',
  'DevOps Engineer',
] })`evaluate the tech stack proposal`

// Quiet mode
await Β.quiet`poll all specialists about this API design decision`

// Per-phase model routing
await Β({
  plannerModel: 'anthropic/claude-sonnet-4-5',
  workerModel: 'deepseek/deepseek-v4-flash',
})`review the Kubernetes deployment configuration`
```

## Options

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `model` | `string` | Pi default | Fallback model |
| `plannerModel` | `string` | — | Model for synthesis |
| `workerModel` | `string` | — | Model for worker responses |
| `thinkingLevel` | `ThinkingLevel` | `'medium'` | Reasoning depth |
| `quiet` | `boolean` | `false` | Suppress output |
| `maxTokens` | `number` | `4096` | Max tokens per call |
| `system` | `string` | — | System prompt |
| `workers` | `number` | `4` | Number of worker agents |
| `roles` | `string[]` | auto | Custom worker roles |

## Output

```ts
class BroadcastOutput extends PatternOutput {
  text: string
  synthesis: string                    // Synthesized recommendation
  responses: BroadcastResponse[]       // Individual responses
  duration: number
}

class BroadcastResponse {
  role: string
  response: string
  success: boolean
  error?: string
}
```

## When to Use

- Getting expert opinions on a single question
- Stakeholder-like feedback collection
- Quick polls across multiple domains
- When you want diverse perspectives on one focused question
