# Σ (Sigma) — Subagents

Hierarchical task delegation: decompose a complex task into sub-tasks, execute each in parallel via sub-agents, then synthesize results.

## Flow

1. **Decompose** — A planner agent breaks the main task into independent sub-tasks
2. **Execute** — Each sub-task runs in parallel (bounded by concurrency)
3. **Synthesize** — A synthesis agent combines sub-results into a coherent final answer

## Usage

```js
// Auto-decomposition into sub-tasks
await Σ`analyze the full codebase for security vulnerabilities`

// Explicit sub-domains
await Σ({ subdomains: ['auth', 'database', 'frontend', 'api'] })`review each area`

// Control sub-task count and concurrency
await Σ({ maxSubTasks: 6, concurrency: 2 })`generate API docs for all endpoints`

// Quiet mode
await Σ.quiet`find optimization opportunities across all modules`

// Per-phase model routing
await Σ({
  plannerModel: 'anthropic/claude-sonnet-4-5',
  workerModel: 'deepseek/deepseek-v4-flash',
})`design a comprehensive testing strategy`
```

## Options

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `model` | `string` | Pi default | Fallback model |
| `plannerModel` | `string` | — | Model for decompose & synthesize |
| `workerModel` | `string` | — | Model for sub-agent execution |
| `thinkingLevel` | `ThinkingLevel` | `'medium'` | Reasoning depth |
| `quiet` | `boolean` | `false` | Suppress output |
| `maxTokens` | `number` | `4096` | Max tokens per call |
| `system` | `string` | — | System prompt |
| `subdomains` | `string[]` | — | Explicit sub-tasks (skip auto-decomposition) |
| `maxSubTasks` | `number` | `4` | Maximum auto-generated sub-tasks |
| `concurrency` | `number` | `4` | Max parallel sub-agent execution |

## Output

```ts
class SubagentOutput extends PatternOutput {
  text: string                     // Final synthesized text
  synthesis: string                // Same as text
  subResults: SubagentResult[]     // Individual sub-agent results
  duration: number
}

class SubagentResult {
  subTask: string
  text: string
  success: boolean
}
```

## When to Use

- Complex analysis requiring multiple domains of expertise
- Security audits across different attack surfaces
- Large codebase documentation generation
- Tasks that naturally decompose into independent sub-problems
