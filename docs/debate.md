# Δ (Delta) — Debate

Multi-perspective debate: spawn agents with conflicting viewpoints, let them argue, then converge on a balanced conclusion.

## Behavior

Spawns multiple agents with pre-built role sets (Optimist, Pessimist, Pragmatist, etc.). All agents analyze the question in parallel (Round 1). In subsequent rounds, each agent sees all prior arguments and produces counter-arguments. A neutral moderator synthesizes a final conclusion.

## Usage

```js
// Default: 3 perspectives
await Δ`should we use microservices or a monolith for this project?`

// 2 perspectives with rebuttals
await Δ({ perspectives: 2, rounds: 2 })`evaluate switching from REST to GraphQL`

// Custom roles
await Δ({ roles: ['Security-first', 'Performance-first', 'DX-first'] })`
  which authentication approach should we choose?
`

// Quiet mode
await Δ.quiet`evaluate the trade-offs of this design decision`

// Per-phase model routing
await Δ({
  plannerModel: 'anthropic/claude-sonnet-4-5',
  workerModel: 'deepseek/deepseek-v4-flash',
})`what's the best state management strategy for this React app?`
```

## Options

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `model` | `string` | Pi default | Fallback model |
| `plannerModel` | `string` | — | Model for synthesis (moderator) |
| `workerModel` | `string` | — | Model for individual perspectives |
| `thinkingLevel` | `ThinkingLevel` | `'medium'` | Reasoning depth |
| `quiet` | `boolean` | `false` | Suppress output |
| `maxTokens` | `number` | `4096` | Max tokens per call |
| `system` | `string` | — | System prompt |
| `perspectives` | `number` | `3` | Number of debate perspectives (2–5) |
| `roles` | `string[]` | auto | Custom perspective roles |
| `rounds` | `number` | `1` | Debate rounds (2+ adds rebuttals) |

### Pre-built Role Sets

| Count | Roles |
|-------|-------|
| 2 | Optimist, Pessimist |
| 3 | Optimist, Pessimist, Pragmatist |
| 4 | Optimist, Pessimist, Pragmatist, Innovator |
| 5 | All above + User Advocate |

## Output

```ts
class DebateOutput extends PatternOutput {
  text: string                         // Full text
  conclusion: string                   // The converged final answer
  perspectives: DebatePerspective[]    // All arguments from all rounds
  rounds: number                       // Number of rounds executed
  duration: number
}

class DebatePerspective {
  role: string
  argument: string
  round: number
}
```

## When to Use

- Architecture and design decisions
- Technology choices with trade-offs
- Risk assessment and mitigation planning
- Any decision where multiple viewpoints improve the outcome
