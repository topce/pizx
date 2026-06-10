# Φ (Phi) — Fleet

Parallel agent execution: run multiple tasks simultaneously with a concurrency limit.

## Behavior

Parses the prompt into individual tasks (one per line, bullet points, or explicit array), then executes each in parallel batches. Each task gets its own LLM call. Results are collected into a summary.

## Usage

```js
// One task per line
await Φ`
  review src/auth.ts for security issues
  review src/api.ts for performance issues
  review src/db.ts for SQL injection risks
`

// Bullet points
await Φ`
  - lint the entire src/ directory
  - check TypeScript types
  - run the test suite
`

// Explicit task array
await Φ({ tasks: ['lint src/', 'check types', 'run tests'] })`any text here is ignored`

// Control concurrency
await Φ({ concurrency: 10 })`
  analyze file1.ts
  analyze file2.ts
  ...many more...
`

// Quiet mode
await Φ.quiet`analyze all examples for best practices`

// Per-phase model routing
await Φ({ workerModel: 'deepseek/deepseek-v4-flash' })`
  review auth.ts
  review api.ts
`

// Quality check (optional)
await Φ({ qualityCheck: true })`review all source files for errors`

// Human-in-the-loop
await Φ({ confirm: true })`execute these batch tasks`

// Composition: patterns as sub-tasks
await Φ({ tasks: [
  'analyze the frontend',
  () => Σ\`analyze the backend\`,    // Subagents pattern as a fleet task
  () => Ψ\`review the API design\`,   // Critique pattern as a fleet task
] })`review everything`
```

## Options

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `model` | `string` | Pi default | Fallback model |
| `workerModel` | `string` | — | Model for all parallel tasks |
| `thinkingLevel` | `ThinkingLevel` | `'medium'` | Reasoning depth |
| `quiet` | `boolean` | `false` | Suppress output |
| `maxTokens` | `number` | `4096` | Max tokens per call |
| `system` | `string` | — | System prompt (merged with pattern default) |
| `tasks` | `TaskDescriptor[]` | — | Explicit task list (overrides template). Accepts strings or pattern-call functions |
| `concurrency` | `number` | `5` | Maximum parallel tasks at once |
| `qualityCheck` | `boolean` | `false` | Run a quality review on results |
| `confirm` | `boolean` | `false` | Pause and ask before execution |

## Output

```ts
class FleetOutput extends PatternOutput {
  text: string                  // Summary of all results
  members: FleetMemberOutput[]  // Individual results
  successCount: number          // Number of successful tasks
  failureCount: number          // Number of failed tasks
  duration: number
}

class FleetMemberOutput {
  task: string     // The task description
  text: string     // The result text
  success: boolean
  error?: string
}
```

## When to Use

- Many independent tasks that can run in parallel
- Batch code reviews, linting, or analysis
- Processing multiple files or modules simultaneously
- Any workload where tasks don't depend on each other
