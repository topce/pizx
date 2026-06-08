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

## Output

```ts
class RalphOutput extends PatternOutput {
  text: string                    // Summary of all iterations
  iterationCount: number          // Number of iterations executed
  completed: boolean              // Whether quality threshold was met
  iterations: RalphIterationSummary[]  // Per-iteration details
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
