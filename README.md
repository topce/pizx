# pizx

[![GitHub Sponsors](https://img.shields.io/github/sponsors/topce?style=social&logo=github)](https://github.com/sponsors/topce)

![pizx — zx fork with native Pi AI integration](github-social-banner.png)

> **zx fork with native Pi AI integration** — 15 agent pattern tags (plus shell and AI core) for shell scripting, AI text generation, coding agents, agentic patterns, multi-agent communication, and orchestration topologies.

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

**New to pizx?** Start with the [Onboarding Guide](docs/onboarding.md).

## Install

```bash
npm install @topce/pizx
```

**Prerequisites:**
- Node.js >= 22.19.0
- [Pi AI](https://github.com/earendil-works/pi) installed and configured (`pi auth login`)
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

// Greek letters work everywhere...
const output = await $`ls src/ | grep '.ts'`
console.log(output.stdout)

const review = await π`review this code for issues:\n${output.stdout}`
console.log(review.text)

// ...and so do English word aliases:
import { pi, Pi, ralph, fleet, subagent } from '@topce/pizx'

const answer = await pi`explain async/await`
await Pi`fix the TypeScript errors in src/`
await fleet`review all files in src/`
```

> **English word aliases**: Every Greek letter tag has an English alternative.
> `pi` (alias for `π`), `Pi` (alias for `Π`), `fleet` (alias for `Φ`), `ralph` (alias for `Ρ`),
> `pipeline` (alias for `Λ`), etc. — use whichever style you prefer. See [full mapping](#english-aliases) below.

### Global Access (pizx/globals)

Import the `pizx/globals` module to make **all tags and English aliases** available without explicit imports — matching the `#!/usr/bin/env pizx` shebang experience inside scripts loaded via `import()`:

```js
import '@topce/pizx/globals'

// All Greek tags are available without imports:
const answer = await π`explain async/await`
await Π`fix the lint issues`
await Φ`review all files`

// English aliases too:
const docs = await fleet`check all .ts files`
const plan = await orchestrator`design the architecture`

// Helpers:
configurePi({ model: 'anthropic/claude-sonnet-4-5' })
closeAgent()
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

### English Aliases

Every Greek letter tag has an equivalent English word. They're interchangeable — use whichever style you prefer.

| Greek | English | Greek | English |
|-------|---------|-------|---------|
| `π` | `pi` | `Π` | `Pi` |
| `Ρ` | `ralph` | `Φ` | `fleet` |
| `Σ` | `subagent` | `Δ` | `debate` |
| `Λ` | `pipeline` | `Ψ` | `critique` |
| `Ω` | `orchestrator` | `Ν` | `team` |
| `Θ` | `thread` | `Μ` | `memory` |
| `Β` | `broadcast` | `Α` | `adaptive` |
| `Γ` | `graph` | `Χ` | `learn` |
| `Τ` | `store` | | |

See [`english-examples/`](english-examples/) for runnable examples using all English aliases.

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

12 patterns support an optional `qualityCheck` flag. When enabled, the pattern runs a post-execution LLM review that scores the final output (0.0–1.0), provides an assessment, and recommends improvements:

Supported by: `Ω` (Orchestrator), `Φ` (Fleet), `Σ` (Subagents), `Δ` (Debate), `Λ` (Pipeline), `Θ` (Thread), `Μ` (Memory), `Β` (Broadcast), `Γ` (Graph), `Ν` (Nu/Team), `Χ` (Chi/Learn), `Τ` (Tau/Store).
Not applicable to: `Ρ` (Ralph Loop — has its own review phase), `Α` (Adaptive), `Ψ` (Critique).

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

Supported by: `Ω`, `Σ`, `Φ`, `Λ`.

### Agent Mode (File Tools for Any Pattern)

By default, all patterns (except `Pi` and `ralph`) use **text generation** — they can read files only if you pass content in via template interpolation. `ralph` already uses coding agent tools when `useTools: true` (default).

Set `mode: 'agent'` to give every subtask the same **coding agent tools** as `Pi`:

```js
// Fleet workers can read files
await fleet({ mode: 'agent' })`read package.json and analyze the project`

// Pipeline stages can edit code
await pipeline({ mode: 'agent' })`read src/ and refactor the error handling`

// Orchestrator workers can run commands
await orchestrator({ mode: 'agent' })`check the test coverage and report gaps`

// Debate perspectives can research the codebase
await debate({ mode: 'agent' })`read the architecture docs and debate the design`
```

Available tools: `read`, `bash`, `edit`, `write`, `grep`, `ls`.

Supported by: all patterns (`fleet`, `orchestrator`, `pipeline`, `debate`, `subagent`, `critique`, `thread`, `memory`, `broadcast`, `adaptive`, `graph`, `team`, `learn`, `store`).
Not applicable to: `pi`/`π` (always text), `Pi`/`Π` and `ralph` (already use coding agent).

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

### Timeout, Retry & API Key

All tags accept `timeoutMs` and `maxRetries` to control LLM call resilience. When unset, the provider SDK defaults apply (typically 10 min timeout, 2 retries).

```js
// Per-pattern
await Φ({ timeoutMs: 30000, maxRetries: 2 })`review all .ts files`

// Per-call on π
await π({ timeoutMs: 15000 })`summarize this document`

// Global defaults
configurePi({ timeoutMs: 60000, maxRetries: 3 })
```

Use `apiKey` to specify a provider API key directly, bypassing environment variable lookup:

```js
await π({ apiKey: 'sk-...' })`analyze this data`
await Ω({ apiKey: 'sk-...' })`design the system`
```

### Streaming (π.stream)

For real-time streaming, use `π.stream` as an async generator:

```js
for await (const chunk of π.stream`tell me a long story`) {
  process.stdout.write(chunk)
}
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

Fleet and Pipeline accept `TaskDescriptor` — either a plain string (for a standard LLM call) or a function that invokes another pattern as a sub-task. See [docs/advanced-features.md](docs/advanced-features.md#pattern-composition-taskdescriptor) for details.

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

### System Prompt Overrides

All tags accept `system` (replaces default) and `appendSystemPrompt` (appended after system).

```js
// π: custom system prompt
await π({ system: 'You are a security auditor' })`review this code`

// π: with appendSystemPrompt
await π({ appendSystemPrompt: 'Respond in JSON format' })`list all .ts files`

// Π: set system prompt and append extra instructions
await Π({ system: 'You are a test engineer', appendSystemPrompt: 'Write tests first' })`add tests for auth`

// Patterns: inject system context via mergeSystem
await Ω({ system: 'Prioritize security over performance' })`design login flow`
```

### closeAgent()

Dispose the shared Pi coding agent session (`Π`). Useful in long-running scripts or tests to reset state:

```js
import { closeAgent } from '@topce/pizx'
await closeAgent()  // dispose shared agent session
```

### Thinking Budgets

Fine-grained token budgets per reasoning level. Passes through to providers via `thinkingBudgets`.

```js
// Per-call
await π({ thinkingBudgets: { medium: 16384, high: 65536 } })`analyze`

// Global default
configurePi({ thinkingBudgets: { medium: 20480, high: 131072 } })

// Patterns support it too
await Ω({ thinkingBudgets: { high: 65536 } })`deep analysis task`
```

### Skill Integration

Load Pi agent skills from disk and inject them as system context. Skills are discovered from the same paths as `skill.sh`: `.pi/skills`, `.agents/skills`, `~/.pi/agent/skills`, etc.

```js
import { loadSkillContent, loadSkillContents } from '@topce/pizx'

// Load a single skill
const codeStyle = await loadSkillContent('code-simplification')
if (codeStyle) {
  await π({ system: codeStyle })`refactor auth.ts`
}

// Load multiple skills
const skills = await loadSkillContents(['test-driven-development', 'spec-driven-development'])

// Π and all patterns accept skills option
await Π({ skills: ['code-simplification'] })`clean up this file`
await Ω({ skills: ['spec-driven-development', 'incremental-implementation'] })`build the feature`
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
- `-q, --quiet` — Suppress status output
- `--system <text>` — System context for pi-ai (print mode only)

## Commands

```bash
npm run build                  # Build (JS + DTS)
npm run check                  # Lint and format with Biome
npm test                       # 311 unit tests (no network)
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
- [`quick-ask.mjs`](examples/quick-ask.mjs) — Quick π query
- [`ralph-loop.mjs`](examples/ralph-loop.mjs) — Ralph Loop (detailed)
- [`pattern-ralph.mjs`](examples/pattern-ralph.mjs) — Ralph Loop (concise)
- [`pattern-fleet.mjs`](examples/pattern-fleet.mjs) — Fleet parallel execution
- [`pattern-subagent.mjs`](examples/pattern-subagent.mjs) — Subagents delegation
- [`pattern-debate.mjs`](examples/pattern-debate.mjs) — Multi-perspective debate
- [`pattern-orchestrator.mjs`](examples/pattern-orchestrator.mjs) — Orchestrator
- [`pattern-pipeline.mjs`](examples/pattern-pipeline.mjs) — Pipeline chain
- [`pattern-critique.mjs`](examples/pattern-critique.mjs) — Critique loop
- [`pattern-thread.mjs`](examples/pattern-thread.mjs) — Thread conversation
- [`pattern-memory.mjs`](examples/pattern-memory.mjs) — Memory blackboard
- [`pattern-broadcast.mjs`](examples/pattern-broadcast.mjs) — Broadcast messaging
- [`pattern-adaptive.mjs`](examples/pattern-adaptive.mjs) — Adaptive workflow
- [`pattern-graph.mjs`](examples/pattern-graph.mjs) — DAG execution
- [`pattern-nu.mjs`](examples/pattern-nu.mjs) — Self-organizing teams
- [`pattern-chi.mjs`](examples/pattern-chi.mjs) — Cross-agent learning
- [`pattern-tau.mjs`](examples/pattern-tau.mjs) — Tool-mediated store
- [`pattern-five-whys.mjs`](examples/pattern-five-whys.mjs) — Five Whys analysis
- [`pattern-tracking.mjs`](examples/pattern-tracking.mjs) — Token/cost tracking
- [`pattern-quality.mjs`](examples/pattern-quality.mjs) — Quality check demo
- [`pattern-timeout-retry.mjs`](examples/pattern-timeout-retry.mjs) — Timeout & retry demo
- [`pattern-system-propagation.mjs`](examples/pattern-system-propagation.mjs) — System prompt propagation

### English Aliases Examples

See [`english-examples/`](english-examples/) for runnable examples using all English aliases:

- [`english-hello.mjs`](english-examples/english-hello.mjs) — Hello world with English aliases
- [`english-fleet.mjs`](english-examples/english-fleet.mjs) — Fleet via English aliases
- [`english-debate.mjs`](english-examples/english-debate.mjs) — Debate via English aliases
- [`english-orchestrator.mjs`](english-examples/english-orchestrator.mjs) — Orchestrator via English aliases
- [`english-pipeline.mjs`](english-examples/english-pipeline.mjs) — Pipeline via English aliases
- [`english-all-patterns.mjs`](english-examples/english-all-patterns.mjs) — All patterns via English aliases
- [`english-import-verify.mjs`](english-examples/english-import-verify.mjs) — Verify all imports

### New Feature Demos

- [`test-quality.mjs`](examples/test-quality.mjs) — `qualityCheck` + `system` + `phaseLog`
- [`test-confirm.mjs`](examples/test-confirm.mjs) — Human-in-the-loop approval gate
- [`test-composition-fleet.mjs`](examples/test-composition-fleet.mjs) — Pattern composition in Fleet
- [`test-composition-pipeline.mjs`](examples/test-composition-pipeline.mjs) — Pattern composition in Pipeline

## License

MIT

## Credits

Built on the shoulders of two outstanding tools:

- [**zx**](https://github.com/google/zx) by [Anton Medvedev](https://github.com/antonmedv) — the original shell scripting tool for Node.js that popularized template-tag ergonomics for command execution. pizx preserves every zx API (`$`, `cd`, `echo`, `fetch`, `chalk`, etc.) unchanged.
- [**Pi**](https://github.com/earendil-works/pi) by Mario Zechner / Earendil Works — the unified LLM API and coding agent harness that powers all `π`, `Π`, and pattern tags through `@earendil-works/pi-ai` and `@earendil-works/pi-coding-agent`.
