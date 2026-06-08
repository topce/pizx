# Τ (Tau) — Tool-Mediated Orchestration

Shared structured key-value store: agents coordinate through writes and reads to a shared context, with no direct agent-to-agent communication.

**Category: Orchestration Topology** | **Communication: Tool-Mediated (shared structured context)**

## Flow

1. **Define Schema** — A coordinator defines shared context keys and assigns agents to specific keys (planner)
2. **Round 1 (Write)** — All agents write initial findings to their assigned keys (parallel)
3. **Round 2+ (Update)** — Agents read the full store and refine/update entries (parallel)
4. **Consolidate** — A director reads the final store and synthesizes the final answer

## Usage

```js
// Default: 3 agents, 1 round
await Τ`research the competitive landscape for this product`

// More agents, multiple rounds
await Τ({ agents: 5, rounds: 2 })`audit the codebase for security issues`

// Custom roles
await Τ({ roles: [
  'Reach Analyst',
  'Engagement Analyst',
  'Monetization Analyst',
  'Retention Analyst',
] })`analyze user growth metrics`

// Quiet mode
await Τ.quiet`gather requirements from multiple stakeholder perspectives`

// Per-phase model routing
await Τ({
  plannerModel: 'anthropic/claude-sonnet-4-5',
  workerModel: 'deepseek/deepseek-v4-flash',
})`conduct a comprehensive code review`
```

## Options

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `model` | `string` | Pi default | Fallback model |
| `plannerModel` | `string` | — | Model for schema definition & consolidation |
| `workerModel` | `string` | — | Model for agent writes/updates |
| `thinkingLevel` | `ThinkingLevel` | `'medium'` | Reasoning depth |
| `quiet` | `boolean` | `false` | Suppress output |
| `maxTokens` | `number` | `4096` | Max tokens per call |
| `system` | `string` | — | System prompt |
| `agents` | `number` | `3` | Number of worker agents |
| `rounds` | `number` | `1` | Read/write rounds |
| `roles` | `string[]` | auto | Custom agent roles |

## Shared Store Operations

Each agent performs KEY/VALUE writes to the shared store:

```
KEY: Market_Size
VALUE: The total addressable market is estimated at...

KEY: Competitors
VALUE: Key competitors include...
```

In subsequent rounds, agents can read all existing entries and update with refinements, gap-filling, or challenges.

## Output

```ts
class TauOutput extends PatternOutput {
  text: string
  entries: ToolMediatedEntry[]               // All read/write operations
  finalState: Record<string, string>         // Final key-value store
  synthesis: string                          // Consolidated final output
  duration: number
}

class ToolMediatedEntry {
  agent: string                              // Agent role
  round: number
  operation: 'write' | 'update'
  key: string                                // Store key
  content: string                            // Written content
}
```

## When to Use

- Structured research across multiple domains
- Audits where agents cover different categories
- Requirements gathering from multiple perspectives
- Any workflow that benefits from a structured, evolving shared context
