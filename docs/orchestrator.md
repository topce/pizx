# Ω (Omega) — Orchestrator

High-level orchestration: **plan → dispatch → synthesize**. The most sophisticated pattern.

## Flow

1. **Plan** — A senior architect creates a detailed plan with specific sub-tasks
2. **Dispatch** — Sub-tasks execute in parallel via worker agents (bounded by concurrency)
3. **Synthesize** — A delivery manager combines worker results into a final deliverable

## Usage

```js
// Default: 3 workers
await Ω`build a complete authentication system for the project`

// More workers for larger scope
await Ω({ workers: 5 })`refactor the entire codebase`

// Control concurrency
await Ω({ workers: 6, concurrency: 3 })`design and implement a CI/CD pipeline`

// Quiet mode
await Ω.quiet`migrate from CommonJS to ESM across all modules`

// Per-phase model routing
await Ω({
  plannerModel: 'deepseek/deepseek-v4-pro',   // plan + synthesize
  workerModel: 'deepseek/deepseek-v4-flash',  // worker execution
})`design a comprehensive notification system`
```

## Options

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `model` | `string` | Pi default | Fallback model |
| `plannerModel` | `string` | — | Model for planning & synthesis |
| `workerModel` | `string` | — | Model for worker execution |
| `thinkingLevel` | `ThinkingLevel` | `'medium'` | Reasoning depth |
| `quiet` | `boolean` | `false` | Suppress output |
| `maxTokens` | `number` | `4096` | Max tokens per call |
| `system` | `string` | — | System prompt |
| `workers` | `number` | `3` | Number of worker agents |
| `concurrency` | `number` | `3` | Max parallel worker execution |

## Output

```ts
class OrchestratorOutput extends PatternOutput {
  text: string                              // Summary
  plan: string                              // The original execution plan
  synthesis: string                         // Final synthesized deliverable
  workerResults: OrchestratorWorkerResult[] // Individual worker outputs
  duration: number
}

class OrchestratorWorkerResult {
  task: string
  output: string
  success: boolean
}
```

## When to Use

- Large, complex projects requiring coordinated execution
- Multi-module refactoring or migrations
- Full-stack feature implementation
- Anything where planning + parallel work + synthesis is the right pattern
