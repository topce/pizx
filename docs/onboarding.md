# Onboarding Guide

Get productive with pizx in your first session.

---

## What Is pizx?

pizx is a [zx](https://github.com/google/zx) fork with native AI integration. Think of it as "shell scripting with AI superpowers":

- **`$`** — shell commands (unchanged from zx)
- **`π`** — AI text generation via pi-ai
- **`Π`** — Pi coding agent with file editing tools
- **15 pattern tags** — higher-level AI workflows (parallel tasks, debates, pipelines, etc.)
- **All the usual zx APIs** — `cd`, `echo`, `fetch`, `question`, `chalk`, etc.

---

## Setup

### Prerequisites

- Node.js >= 22.19.0
- [Pi AI](https://github.com/earendil-works/pi-ai) installed: `npm install -g @earendil-works/pi-ai`

### Install

```bash
npm install @topce/pizx
```

### Configure

```bash
pi auth login           # One-time: authenticate with an AI provider
pi models               # See available models
```

Pi supports multiple providers: Anthropic, OpenAI, Google, DeepSeek, and more. See the [Pi AI docs](https://github.com/earendil-works/pi-ai) for setup.

---

## Your First Script

Create `hello.mjs`:

```js
#!/usr/bin/env pizx

const name = await question('What is your name? ')
const greeting = await π`write a friendly greeting for ${name}`
echo(greeting)
```

Run it:

```bash
chmod +x hello.mjs
./hello.mjs

# Or:
pizx hello.mjs
```

### What Happened?

1. `question()` — zx API that prompts the user (from stdin)
2. `π\`...\`` — calls an AI model with your prompt, returns the response
3. `echo()` — zx API that prints to stdout

---

## The Three Core Tags

### `$` — Shell commands (from zx)

```js
const files = await $`ls src/`
console.log(files.stdout)     // → list of files
```

### `π` — AI text generation

```js
const answer = await π`explain async/await in simple terms`
console.log(answer)
```

### `Π` — AI coding agent with tools

```js
await Π`fix the TypeScript errors in src/`
```

The agent has access to `read`, `bash`, `edit`, `write`, `grep`, `ls` tools. It can read files, run commands, and make changes.

---

## Pattern Tags Overview

Patterns are where pizx really shines. They orchestrate multiple AI calls into structured workflows.

### Quick Comparison

| Tag | Name | Best For |
|-----|------|----------|
| `Ρ` | Ralph Loop | Iterative code improvement (read → analyze → edit → review ↺) |
| `Φ` | Fleet | Many independent tasks in parallel |
| `Σ` | Subagents | Complex task → decompose → sub-tasks → synthesize |
| `Δ` | Debate | Decisions with competing perspectives |
| `Λ` | Pipeline | Sequential processing (stage₁ → stage₂ → stage₃) |
| `Ψ` | Critique | Generate → review → improve (for content, not code) |
| `Ω` | Orchestrator | Plan → dispatch workers → synthesize (most sophisticated) |
| `Θ` | Thread | Multi-agent conversation |
| `Μ` | Memory | Shared blackboard — agents write/read findings |
| `Β` | Broadcast | One question → many specialists → synthesized answer |
| `Α` | Adaptive | Self-adjusting workflow with quality feedback |
| `Γ` | Graph | DAG-based execution with dependencies |
| `Ν` | Nu | Self-organizing teams (auto-negotiate roles) |
| `Χ` | Chi | Analyze execution traces → extract learning patterns |
| `Τ` | Tau | Tool-mediated KV store coordination |

### The Simplest Starting Pattern

`Φ` (Fleet) is the easiest to get started with:

```js
await Φ`
  list 3 benefits of TypeScript
  list 3 best practices for error handling
  list 3 popular testing frameworks
`
```

This runs three independent LLM calls in parallel and collects the results.

---

## Common Patterns of Use

### 1. Shell + AI = Automation

```js
const diff = await $`git diff --name-only`
const review = await π`review these changed files:\n${diff}`
echo(review)
```

### 2. AI → Shell → AI

```js
const plan = await π`what files should I create for a CLI tool?`
await $`mkdir -p src/cli`
await $`touch src/cli/index.ts`
const written = await $`ls src/cli/`
echo(`Created: ${written.stdout}`)
```

### 3. Pattern → Pattern

```js
// Analyze the codebase
const analysis = await Σ`analyze all source files for security issues`

// Critique the analysis
const polished = await Ψ`improve this analysis:\n${analysis}`
```

### 4. Quality-Checked Output

```js
const result = await Ω({ qualityCheck: true })`design the architecture`
console.log(`Quality: ${result.qualityReview?.score}`)
```

---

## Key Concepts

### Model Routing

Many patterns support two models:

```js
await Ω({
  plannerModel: 'deepseek/deepseek-v4-pro',   // planning, synthesis (expensive)
  workerModel: 'deepseek/deepseek-v4-flash',  // execution (cheaper)
})`design a system`
```

- **plannerModel**: High-level reasoning (planning, analysis, critique)
- **workerModel**: Execution (sub-tasks, parallel workers, perspectives)

If only `model` is set, it's used for both.

### Quiet Mode

Suppress streaming output:

```js
await Φ.quiet`analyze all files in src/`
```

### Option Chaining

Set options, then call:

```js
const tag = Ω({ plannerModel: '...', workers: 5, quiet: true })
const result = await tag`design the system`
```

---

## Running Examples

```bash
# Basic examples
npm run example:hello           # First script
npm run example:pi              # π text generation

# Pattern examples
npm run example:pattern-fleet   # Fleet parallel execution
npm run example:pattern-debate  # Multi-perspective debate
npm run example:pattern-all     # All patterns

# New feature demos
npm run test:quality            # Quality validation demo
npm run test:confirm            # Human-in-the-loop demo
npm run test:composition-fleet  # Pattern composition in Fleet
npm run test:new-features       # All feature demos
```

---

## Getting Help

- **Pattern docs**: See [`docs/`](docs/) — one file per pattern
- **Advanced features**: [`docs/advanced-features.md`](docs/advanced-features.md) — qualityCheck, confirm, composition, etc.
- **Architecture decisions**: [`docs/decisions/`](docs/decisions/) — ADRs explaining design rationale
- **Examples**: [`examples/`](examples/) — runnable scripts
- **Issues**: [GitHub Issues](https://github.com/topce/pizx/issues)
