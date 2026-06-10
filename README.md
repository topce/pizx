# pizx

[![GitHub Sponsors](https://img.shields.io/github/sponsors/topce?style=social&logo=github)](https://github.com/sponsors/topce)

> **zx fork with native Pi AI integration** — 15 template tags for shell scripting, AI text generation, coding agents, agentic patterns, communication, and orchestration topologies.

## Quick Start

```bash
npm install @topce/pizx
pi auth login        # one-time: configure Pi AI credentials
```

Write a script (`hello.mjs`):

```js
#!/usr/bin/env pizx

// Simple AI query
const answer = await π`what is the capital of France?`
echo(answer)

// Agent patterns
const files = await $`ls src/`
const summary = await π`summarize these files in one sentence: ${files}`
console.log(summary)
```

Run it:

```bash
chmod +x hello.mjs
./hello.mjs

# Or:
pizx hello.mjs
```

## Install

```bash
npm install @topce/pizx
```

**Prerequisites:**
- Node.js >= 22.19.0
- [Pi AI](https://github.com/earendil-works/pi-ai) installed and configured (`pi auth login`)
- Shell commands from [zx](https://github.com/google/zx) (`$`, `cd`, `echo`, `fetch`, etc.)

## Writing Scripts

### Shebang

```js
#!/usr/bin/env pizx

const name = await question('What is your name? ')
const intro = await π`write a friendly greeting for ${name}`
echo(intro)
```

### Programmatic Import

```js
import { $, π, Π, Ρ, Φ, Σ } from '@topce/pizx'

const output = await $`ls src/ | grep '.ts'`
console.log(output.stdout)

const review = await π`review this code for issues:\n${output.stdout}`
console.log(review.text)

// Use the coding agent to fix issues
await Π`fix the TypeScript errors in src/`
```

### CLI Quick Queries

```bash
pizx -p "explain async/await in JavaScript"
pizx -p --model deepseek/deepseek-chat "summarize this code: @file.ts"
pizx --version
```

## Tags Reference

Each tag has detailed documentation in [`docs/`](docs/):

### Core

| Tag | Name | Description | Docs |
|---|---|---|---|
| `$` | Shell | Shell commands (unchanged from zx) | — |
| `π` | Pi | AI text generation via pi-ai | [docs/pi.md](docs/pi.md) |
| `Π` | Capital Pi | Pi coding agent with tools (read, bash, edit, write) | [docs/capital-pi.md](docs/capital-pi.md) |

### Agent Patterns (Ρ Φ Σ Δ Λ Ψ Ω Ν)

| Tag | Name | Flow | Docs |
|---|---|---|---|
| `Ρ` | Ralph Loop | analyze → plan → execute → review ↺ | [docs/ralph.md](docs/ralph.md) |
| `Φ` | Fleet | A, B, C in parallel → aggregate | [docs/fleet.md](docs/fleet.md) |
| `Σ` | Subagents | decompose → sub-agents → synthesize | [docs/subagent.md](docs/subagent.md) |
| `Δ` | Debate | perspectives → converge | [docs/debate.md](docs/debate.md) |
| `Λ` | Pipeline | stage₁ → stage₂ → stage₃ | [docs/pipeline.md](docs/pipeline.md) |
| `Ψ` | Critique | generate → critique → improve | [docs/critique.md](docs/critique.md) |
| `Ω` | Orchestrator | plan → dispatch → synthesize | [docs/orchestrator.md](docs/orchestrator.md) |
| `Ν` | Nu | analyze → negotiate roles → execute → synthesize | [docs/nu.md](docs/nu.md) |

### Communication Patterns (Θ Μ Β)

| Tag | Name | Pattern | Docs |
|---|---|---|---|
| `Θ` | Thread | Multi-agent conversation | [docs/thread.md](docs/thread.md) |
| `Μ` | Memory | Shared blackboard | [docs/memory.md](docs/memory.md) |
| `Β` | Broadcast | One-to-many messaging | [docs/broadcast.md](docs/broadcast.md) |

### Orchestration Topologies (Α Γ Χ Τ)

| Tag | Name | Pattern | Docs |
|---|---|---|---|
| `Α` | Adaptive | Self-adjusting workflow | [docs/adaptive.md](docs/adaptive.md) |
| `Γ` | Graph | DAG-based execution | [docs/graph.md](docs/graph.md) |
| `Χ` | Chi | Analyze traces → extract patterns | [docs/chi.md](docs/chi.md) |
| `Τ` | Tau | Define schema → write → refine → consolidate | [docs/tau.md](docs/tau.md) |

## Architecture

See [docs/decisions/](docs/decisions/) for Architecture Decision Records covering the key design choices:

- [ADR-001: Template-Tag DSL](docs/decisions/ADR-001-template-tag-dsl.md) — Why patterns are template tags with curried option chaining
- [ADR-002: Shared Tag Factory](docs/decisions/ADR-002-shared-tag-factory.md) — How `createPatternTag` eliminates 450 lines of boilerplate
- [ADR-003: Quality Validation](docs/decisions/ADR-003-quality-validation.md) — The `qualityCheck` design and `runQualityReview` helper
- [ADR-004: Phase Logging](docs/decisions/ADR-004-phase-logging.md) — Structured audit trails via `phaseLog` on every output
- [ADR-005: Pattern Composition](docs/decisions/ADR-005-pattern-composition.md) — How `TaskDescriptor` enables nested patterns
- [ADR-006: Confirm Gates](docs/decisions/ADR-006-confirm-gates.md) — Human-in-the-loop approval via `confirm` option
- [ADR-007: System Propagation](docs/decisions/ADR-007-system-propagation.md) — How `mergeSystem` propagates user prompts

## Advanced Features

### Per-Phase Model Selection

All patterns support `plannerModel` and `workerModel` for routing high-level reasoning vs execution to different models:

```js
await Ω({
  plannerModel: 'deepseek/deepseek-v4-pro',  // planning + synthesis
  workerModel: 'deepseek/deepseek-v4-flash',  // worker execution
})`design a notification system`
```

Without per-phase models, patterns fall back to `model` → Pi default.

### System Prompt Propagation

All patterns respect the `system` option. When you provide a custom system prompt, it is prepended to the pattern's default system prompt — your context is never silently discarded:

```js
await Ω({ system: 'You are a senior security architect.' })`design an auth system`
// → "You are a senior security architect.\n\n[PLANNER_SYSTEM]"
```

### Quality Validation

All 15 patterns support an optional `qualityCheck` flag. When enabled, the pattern runs a post-execution LLM review that scores the final output (0.0–1.0), provides an assessment, and recommends improvements:

```js
const result = await Ω({ qualityCheck: true })`design the system architecture`

if (result.qualityReview) {
  console.log(`Quality score: ${result.qualityReview.score}`)   // 0.0 – 1.0
  console.log(result.qualityReview.assessment)                   // 1-2 sentence assessment
  console.log(result.qualityReview.recommendation)               // improvement suggestion
}
```

### Human-in-the-Loop (Confirm Gates)

Set `confirm: true` to pause before the main execution phase and ask for approval. The pattern displays a summary of what it's about to do and waits for `[Y/n]` on stdin:

```js
await Ω({ confirm: true })`design the system`
// → "── Confirm ──"
// → "Execute 3 sub-task(s) as planned?"
// → "  1. Analyze requirements"
// → "  2. Design architecture"
// → "  3. Document decisions"
// → "Proceed? [Y/n] "
```

Supported by: `Ω`, `Σ`, `Φ`, `Λ` (more patterns coming).

### Option Chaining & Quiet Mode

All tags support option chaining and `.quiet` mode to suppress output:

```js
await π({ model: 'anthropic/claude-sonnet-4-5' })`explain this algorithm`
await Π.quiet`fix the lint issues in src/`
await Φ({ concurrency: 5 })`review all .ts files`
await Σ.quiet`analyze security across the codebase`
await Θ({ agents: 4, turns: 3 })`debate the architecture`
await Γ({ graph: { nodes: [...], edges: [...] } })`execute workflow`
```

### Timeout & Retry

All tags accept `timeoutMs` and `maxRetries` to control LLM call resilience. When unset, the provider SDK defaults apply (typically 10 min timeout, 2 retries).

```js
// Per-pattern
await Φ({ timeoutMs: 30000, maxRetries: 2 })`review all .ts files`

// Per-call on π
await π({ timeoutMs: 15000 })`summarize this document`

// Global defaults
configurePi({ timeoutMs: 60000, maxRetries: 3 })
```

### Token, Cost & Phase Tracking

Every pattern output and π call includes an execution trace with token usage, cost, and a structured phase log. All collected automatically — no extra flags needed.

```js
const result = await Ω`design a notification system`

// Per-call breakdown
for (const t of result.trace) {
  console.log(`Call ${t.call}: ${t.modelId} — ${t.totalTokens} tokens, $${t.cost.toFixed(6)}`)
}

// Aggregates (on both PatternOutput and PiOutput)
console.log(`Total: ${result.totalTokens} tokens`)
console.log(`Cost:  $${result.totalCost.toFixed(4)}`)
console.log(`Calls: ${result.callCount}`)

// Structured phase log — what happened during execution
for (const phase of result.phaseLog) {
  console.log(`${phase.phase}: ${phase.durationMs}ms — ${phase.description}`)
}
// → "plan: 1234ms — Generated plan with 3 workers"
// → "dispatch: 5678ms — Executed 3 worker(s), 3 succeeded"
// → "synthesize: 901ms — Synthesized worker results"

// Works with π too
const answer = await π`explain quantum computing`
console.log(`Input: ${answer.inputTokens}, Output: ${answer.outputTokens}`)
console.log(`Cost:  $${answer.totalCost.toFixed(6)}`)
```

Each `CallTrace` entry includes: call index, model id, prompt/output previews, input/output/cache tokens, cost (USD), and duration.

### Pattern Composition (Nesting)

Fleet and Pipeline accept `TaskDescriptor` — either a plain string (for a standard LLM call) or a function that invokes another pattern as a sub-task. This lets you compose patterns inside patterns.

**Fleet with mixed tasks:**

```js
await Φ({
  tasks: [
    'analyze the frontend',              // string: standard LLM call
    () => Σ\`analyze the backend\`,       // function: compose a Subagents pattern
    () => Ψ\`review the API design\`,     // function: compose a Critique pattern
  ],
})`review everything`
```

**Pipeline with composed stages:**

```js
await Λ({
  stages: [
    'generate product description',       // string: standard LLM call
    (prev) => Ψ\`critique this: ${prev}\`, // function: receives previous output
  ],
})`generate → improve`
```

### Global Configuration

```js
import { configurePi, configureAgent } from '@topce/pizx'

configurePi({ model: 'anthropic/claude-sonnet-4-5', maxTokens: 8000, timeoutMs: 60000 })
configureAgent({ maxTurns: 5, excludeTools: ['write'] })
```

## CLI Reference

```bash
pizx [options] <script>      # Run a pizx script
pizx -p <prompt>              # Quick pi-ai query
pizx --version                # Print version
pizx --help                   # Print help
```

**Options:**
- `-p, --prompt <text>` — Run a quick pi-ai query (no script needed)
- `-m, --model <id>` — Specify AI model to use
- `--quiet` — Suppress output except errors
- `--shell <path>` — Shell to use (default: auto-detect)

## Commands

```bash
npm run build                  # Build (JS + DTS)
npm run check                  # Lint and format with Biome
npm test                       # 223 unit tests (no network)
npm run test:integration       # Integration tests (requires Pi credentials)
npm run test:quality           # Run qualityCheck example
npm run test:confirm           # Run confirm gate example
npm run test:composition-fleet # Run pattern composition in Fleet example
npm run test:composition-pipeline # Run pattern composition in Pipeline example
npm run test:new-features      # Run all 4 feature examples
npm run example:hello          # Run hello example
npm run example:all            # Run all pattern examples
```

## Examples

See [`examples/`](examples/) for runnable examples of every pattern and feature:

### Pattern Examples

- [`hello-pizx.mjs`](examples/hello-pizx.mjs) — Basic script with shell + AI
- [`basic-pi.mjs`](examples/basic-pi.mjs) — π text generation
- [`basic-capital-pi.mjs`](examples/basic-capital-pi.mjs) — Π coding agent
- [`pattern-ralph.mjs`](examples/pattern-ralph.mjs) — Ralph Loop
- [`pattern-fleet.mjs`](examples/pattern-fleet.mjs) — Fleet parallel execution
- [`pattern-debate.mjs`](examples/pattern-debate.mjs) — Multi-perspective debate
- ... and more for every pattern

### New Feature Demos

- [`test-quality.mjs`](examples/test-quality.mjs) — `qualityCheck` + `system` + `phaseLog`
- [`test-confirm.mjs`](examples/test-confirm.mjs) — Human-in-the-loop approval gate
- [`test-composition-fleet.mjs`](examples/test-composition-fleet.mjs) — Pattern composition in Fleet
- [`test-composition-pipeline.mjs`](examples/test-composition-pipeline.mjs) — Pattern composition in Pipeline

## License

MIT
