# Ρ (Rho) — Ralph Loop

Iterative self-correcting improvement loop: **Read → Analyze → Logic → Patch → Harden**.

## Flow

1. **Analyze** — π-ai analyzes the current state and identifies what needs to change
2. **Plan** — π-ai generates a minimal, actionable implementation plan
3. **Execute** — Π (coding agent) implements the plan with tools (read, bash, edit, write)
4. **Review** — π-ai reviews the result and decides whether to iterate again
5. Loop or exit based on quality criteria

## Usage

```js
// Iterative improvement with default settings (5 iterations max)
await Ρ`improve error handling across src/`

// Limit iterations
await Ρ({ maxIterations: 3 })`refactor the auth module`

// Tool-less mode (analysis only, no code changes)
await Ρ({ useTools: false })`analyze test coverage gaps`

// Anti-spin, streak mode, and budget cap (new in v0.9.0)
await Ρ({ antiSpin: true, streakMode: 3, budgetCapUsd: 2.50 })`fix all lint issues`

// Disable anti-spin to burn through all iterations
await Ρ({ antiSpin: false, maxIterations: 5 })`explore alternative approaches`

// Quiet mode
await Ρ.quiet`fix all lint issues`

// Per-phase model routing
await Ρ({
  plannerModel: 'deepseek/deepseek-v4-pro',
  workerModel: 'deepseek/deepseek-v4-flash',
})`optimize database queries`
```

## Options

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `model` | `string` | Pi default | Fallback model |
| `plannerModel` | `string` | — | Model for analyze/plan/review phases |
| `workerModel` | `string` | — | Model for execution phase |
| `thinkingLevel` | `ThinkingLevel` | `'medium'` | Reasoning depth |
| `quiet` | `boolean` | `false` | Suppress output |
| `maxTokens` | `number` | `4096` | Max tokens per call |
| `system` | `string` | — | System prompt |
| `maxIterations` | `number` | `5` | Maximum loop iterations |
| `useTools` | `boolean` | `true` | Whether execute phase uses coding agent tools |
| `maxAgentTurns` | `number` | `10` | Max agent turns per execution phase |
| `antiSpin` | `boolean` | `true` | Detect no-progress and flip-flop patterns; stop early instead of burning iterations |
| `streakMode` | `number` | `1` | Require N consecutive "DONE" reviews before stopping (1 = current behavior, 3-10 recommended for reliability) |
| `budgetCapUsd` | `number` | — | Stop when real accumulated API cost exceeds this USD amount |

All standard pattern options (`model`, `plannerModel`, `workerModel`, `quiet`, `maxTokens`, `thinkingLevel`, `system`, `timeoutMs`, `maxRetries`, `skills`, `confirm`, `apiKey`) are also supported.

## Output

```ts
class RalphOutput extends PatternOutput {
  text: string                    // Summary of all iterations
  iterationCount: number          // Number of iterations executed
  completed: boolean              // Whether quality threshold was met
  iterations: RalphIterationSummary[]  // Per-iteration details
  terminationReason?: string      // Why it stopped early (anti-spin, budget)
  duration: number
}

interface RalphIterationSummary {
  iteration: number
  plan: string
  result: string
  review: string
  shouldContinue: boolean
}
```

## When to Use

- Self-correcting code improvements
- Tasks where initial attempts may need refinement
- Automated refactoring with quality verification
- Any workflow that benefits from analyze→act→review cycles

## Anti-Spin, Streak Mode, and Budget Cap

### Anti-Spin (`antiSpin: true`, default)

Detects two failure modes and stops early instead of burning through all `maxIterations`:
- **No-progress:** Two consecutive reviews with >80% text similarity — the agent is stuck. Stops early.
- **Flip-flop:** Alternating ITERATE/DONE pattern across 4 reviews — the agent oscillates. Stops early.

```js
const result = await Ρ({ antiSpin: true, maxIterations: 10 })`fix the bug`

if (result.terminationReason) {
  console.log(`Stopped: ${result.terminationReason}`)  // e.g., "no-progress detected (review similarity: 87%)"
}
```

Disable with `antiSpin: false` when you want to run all iterations regardless.

### Streak Mode (`streakMode: N`)

Requires N consecutive "DONE" reviews before stopping, instead of stopping on the first one. One green run is luck; N consecutive is reliability.

```js
// Require 3 consecutive DONE reviews — moderate confidence
await Ρ({ streakMode: 3 })`implement the feature`

// Require 10 for production-critical work
await Ρ({ streakMode: 10 })`fix the security vulnerability`
```

Default: `1` (current behavior — stop on first DONE).

## Budget Cap

The budget cap uses **real API costs** from your LLM provider, summed from all LLM calls made during execution. Each response's token usage and cost is recorded in `result.trace` — the budget cap reads the accumulated cost mid-execution.

```js
await Ρ({ budgetCapUsd: 2.50, maxIterations: 20 })`refactor the entire codebase`
```

When the total real cost exceeds the cap, execution stops with `terminationReason: 'budget exceeded'`. Exact per-call costs are available in `result.trace` after execution.
