# pizx

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

### Global Configuration

```js
import { configurePi, configureAgent } from '@topce/pizx'

configurePi({ model: 'anthropic/claude-sonnet-4-5', maxTokens: 8000 })
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
npm run build            # Build (JS + DTS)
npm run check            # Lint and format with Biome
npm test                 # 95 unit tests
npm run example:hello    # Run hello example
npm run example:π        # Run pi-ai example
npm run example:all      # Run all examples
```

## Examples

See [`examples/`](examples/) for runnable examples of every pattern:

- [`hello-pizx.mjs`](examples/hello-pizx.mjs) — Basic script with shell + AI
- [`basic-pi.mjs`](examples/basic-pi.mjs) — π text generation
- [`basic-capital-pi.mjs`](examples/basic-capital-pi.mjs) — Π coding agent
- [`pattern-ralph.mjs`](examples/pattern-ralph.mjs) — Ralph Loop
- [`pattern-fleet.mjs`](examples/pattern-fleet.mjs) — Fleet parallel execution
- [`pattern-debate.mjs`](examples/pattern-debate.mjs) — Multi-perspective debate
- ... and more for every pattern

## License

MIT
