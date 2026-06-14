# pizx Onboarding Guide

> **A zx fork with native Pi AI integration** — 15 agent pattern tags (plus shell and AI core) for shell scripting, AI text generation, coding agents, agentic patterns, multi-agent communication, and orchestration topologies.

## Table of Contents

1. [Project Overview](#project-overview)
2. [Architecture Layers](#architecture-layers)
3. [Key Concepts](#key-concepts)
4. [Guided Tour](#guided-tour)
5. [File Map](#file-map)
6. [Complexity Hotspots](#complexity-hotspots)
7. [Getting Started](#getting-started)

---

## Project Overview

| Attribute | Value |
|---|---|
| **Name** | `@topce/pizx` |
| **Version** | 0.6.1 |
| **License** | MIT |
| **Languages** | TypeScript, JavaScript, JSON, Markdown, HTML, YAML, Shell |
| **Frameworks** | Pi AI, Pi Coding Agent, zx, Vitest, Biome, esbuild |
| **Files** | 129 (77 code, 16 config, 33 docs, 2 markup, 1 script) |
| **Lines of Code** | Moderate |
| **Repository** | [github.com/topce/pizx](https://github.com/topce/pizx) |
| **Prerequisites** | Node.js ≥ 22.19.0, Pi AI (`pi auth login`) |

**What is pizx?** pizx extends [zx](https://github.com/google/zx) (a shell scripting toolkit for JavaScript/TypeScript) with native integration of the [Pi AI](https://github.com/earendil-works/pi) ecosystem. It provides template tag functions (Greek letters and English aliases) that let you call LLMs, spawn coding agents, and orchestrate multi-agent workflows directly from shell scripts.

---

## Architecture Layers

The project is organized into 10 architectural layers:

### 1. Core AI Interface
The foundation — template tag implementations that wrap Pi AI API calls.

| File | Complexity | Purpose |
|---|---|---|
| `src/pi.ts` | **Complex** | Core `π` (pi) tag — low-level AI query interface with `configurePi` |
| `src/pi-agent.ts` | **Complex** | Capital `Π` (Pi) tag — multi-turn coding agent sessions |
| `src/pi-output.ts` | Moderate | Type definitions for Pi AI output |
| `src/load-pi-auth.ts` | Moderate | Pi installation discovery and auth credential loading |
| `src/load-pi-settings.ts` | Moderate | Pi settings directory discovery |
| `src/model-picker.ts` | Moderate | AI model selection based on task context |
| `src/utils.ts` | Simple | Shared `getErrorMessage` utility |

### 2. Agent Patterns
The 15 agent interaction patterns — the heart of pizx's orchestration capabilities.

| Pattern | Greek Tag | English Alias | Complexity | Purpose |
|---|---|---|---|---|
| Ralph | `Ρ` | `ralph` | **Complex** | Iterative refinement through generation-critique cycles |
| Fleet | `Φ` | `fleet` | **Complex** | Parallel dispatch of independent agents |
| Subagent | `Σ` | `subagent` | **Complex** | Child agent delegation with dedicated context |
| Debate | `Δ` | `debate` | **Complex** | Multi-perspective reasoning with opposing viewpoints |
| Pipeline | `Λ` | `pipeline` | **Complex** | Sequential chaining of processing stages |
| Orchestrator | `Ω` | `orchestrator` | **Complex** | Central coordination of worker agents |
| Critique | `Ψ` | `critique` | Moderate | Structured content review and feedback |
| Thread | `Θ` | `thread` | Moderate | Multi-turn conversation history |
| Memory | `Μ` | `memory` | Moderate | Persistent state across invocations |
| Broadcast | `Β` | `broadcast` | Moderate | Fan-out message distribution |
| Adaptive | `Α` | `adaptive` | **Complex** | Self-improving strategy adjustment |
| Graph | `Γ` | `graph` | **Complex** | Dependency DAG with topological sorting |
| Nu | `Ν` | `nu` | **Complex** | Role-playing with specialized personas |
| Chi | `Χ` | `chi` | **Complex** | Learning and insight extraction |
| Tau | `Τ` | `tau` | **Complex** | Tool-mediated external API integration |

Shared infrastructure:
- `src/patterns/types.ts` — Core type definitions (`PatternOutput`, `PatternPromise`, `createPatternTag`, quality review)
- `src/patterns/index.ts` — Barrel re-exporting all patterns
- `src/patterns/role-sets.ts` — Predefined role configurations for debate, memory, thread, broadcast

### 3. CLI and Entry Points
The wiring layer — how users interact with pizx.

| File | Complexity | Purpose |
|---|---|---|
| `src/index.ts` | Moderate | Main barrel — re-exports all tags and types |
| `src/cli.ts` | **Complex** | CLI runner — argument parsing, print mode, script execution |
| `src/globals.ts` | Moderate | Global scope injection for shebang scripts |
| `src/skill-loader.ts` | Moderate | Agent skill markdown discovery and loading |
| `src/skill.sh` | Moderate | Shell CLI for skill management |

### 4. Test Suite
Comprehensive tests for reliability.

| File | Complexity | Lines | Purpose |
|---|---|---|---|
| `src/core.test.ts` | **Complex** | 1,428 | Core functionality tests |
| `src/patterns.test.ts` | **Complex** | 1,575 | Agent pattern behavior tests |
| `src/pizx.test.ts` | **Complex** | 987 | Integration tests |
| `src/model-picker.test.ts` | **Complex** | 313 | Model selection tests |
| `src/patterns.integration.test.ts` | **Complex** | 441 | End-to-end pattern integration tests |

### 5. Configuration
Project configuration files.

| File | Purpose |
|---|---|
| `package.json` | NPM manifest — dependencies, scripts, distribution |
| `tsconfig.json` | TypeScript strict mode configuration |
| `tsconfig.build.json` | Production build with declarations |
| `biome.json` | Linting and formatting rules |
| `vitest.config.ts` | Test runner configuration |

### 6. Build & Scripts
| File | Purpose |
|---|---|
| `scripts/build.mjs` | Custom esbuild-based compilation pipeline |

### 7. Documentation
21 documentation files covering:
- **Pattern docs** — One page per agent pattern (usage, options, output types)
- **Onboarding** — `docs/onboarding.md` and `docs/advanced-features.md`
- **README** — Project overview and quick-start

### 8. Architecture Decisions (ADRs)
7 Architecture Decision Records documenting key design choices.

### 9. Examples
38 example scripts demonstrating each pattern with practical code.

### 10. Graphify Output
20 generated files from Graphify knowledge graph analysis (cached data, reports, visualizations).

---

## Key Concepts

### Greek Letter Tags
Every agent pattern is available as a **Greek letter template tag**:

```js
const summary = await π`explain async/await`
await Π`fix the lint issues in src/`
await Φ`review all TypeScript files for errors`
```

### English Aliases
Every Greek tag has an English alternative for readability:

```js
import { pi, Pi, fleet, ralph, subagent } from '@topce/pizx'

const answer = await pi`explain async/await`
await fleet`review all files in src/`
```

### Shared Tag Factory
All pattern tags are created through `createPatternTag()` in `src/patterns/types.ts`. This ensures consistent behavior across all 15 patterns — same error handling, phase logging, and output formatting.

### Pattern Composition
Patterns can be composed (e.g., Pipeline → Fleet → Critique) for complex workflows. This is documented in ADR-005 and demonstrated in the composition examples.

### Quality Validation
Built-in quality review system (`Ψ`/`critique`) that evaluates outputs against configurable criteria with pass/fail scoring and actionable improvement suggestions.

### Confirm Gates
Optional confirmation step between pattern stages, allowing human-in-the-loop validation before proceeding (ADR-006).

### System Propagation
System messages propagate through pattern chains automatically, maintaining context across composed operations (ADR-007).

---

## Guided Tour

Follow these 15 steps to get familiar with the codebase:

### Step 1 — Project Overview
**Start with the README** to understand pizx as a zx-based shell scripting tool with native Pi AI integration.

**Files:** `README.md`

### Step 2 — Package Manifest & Configuration
**Review the project metadata.** Check `package.json` for dependencies (pi-ai, pi-coding-agent, zx), scripts, and the build pipeline. Then examine `tsconfig.json` for TypeScript strict mode configuration and `biome.json` for linting rules.

**Files:** `package.json`, `tsconfig.json`, `biome.json`

### Step 3 — Main Entry Point & CLI
**Explore the public API surface.** `src/index.ts` is the barrel entry point that re-exports all template tags and types. `src/cli.ts` is the CLI runner with argument parsing, `--print` mode for quick queries, and script execution logic.

**Files:** `src/index.ts`, `src/cli.ts`

### Step 4 — Global Scope Injection
**Understand shebang-mode scripts.** `src/globals.ts` injects all Greek letter template tags and English aliases into the global scope so `#!/usr/bin/env pizx` scripts work without explicit imports.

**Files:** `src/globals.ts`

### Step 5 — Core Pi AI Interface
**Deep-dive into the AI foundation.** `src/pi.ts` implements the low-level `π` (pi) tag for basic AI queries. `src/pi-agent.ts` implements `Π` (Pi) for multi-turn coding agent sessions. `src/pi-output.ts` defines the output type contracts.

**Files:** `src/pi.ts`, `src/pi-agent.ts`, `src/pi-output.ts`

### Step 6 — AI Setup & Utilities
**Learn the setup layer.** `src/load-pi-auth.ts` handles Pi installation discovery and credential loading. `src/model-picker.ts` selects appropriate AI models. `src/utils.ts` provides shared helpers.

**Files:** `src/load-pi-auth.ts`, `src/load-pi-settings.ts`, `src/model-picker.ts`, `src/utils.ts`

### Step 7 — Agent Pattern Types & Barrel
**Understand the shared type system.** `src/patterns/types.ts` defines `PatternOutput`, `PatternPromise`, `createPatternTag`, and quality review infrastructure used by all patterns. `src/patterns/index.ts` is the barrel that re-exports everything.

**Files:** `src/patterns/types.ts`, `src/patterns/index.ts`

### Step 8 — Core Agent Patterns
**Explore the fundamental patterns:**
- **Ralph** (`Ρ`) — Iterative refinement through generation-critique cycles
- **Fleet** (`Φ`) — Parallel dispatch of independent agents
- **Subagent** (`Σ`) — Child agent delegation
- **Debate** (`Δ`) — Multi-perspective reasoning

**Files:** `src/patterns/ralph.ts`, `src/patterns/fleet.ts`, `src/patterns/subagent.ts`, `src/patterns/debate.ts`

### Step 9 — Workflow & Coordination Patterns
**Examine the orchestration layer:**
- **Pipeline** (`Λ`) — Sequential processing stages
- **Orchestrator** (`Ω`) — Central coordination
- **Critique** (`Ψ`) — Structured review
- **Broadcast** (`Β`) — Fan-out dispatch

**Files:** `src/patterns/pipeline.ts`, `src/patterns/orchestrator.ts`, `src/patterns/critique.ts`, `src/patterns/broadcast.ts`

### Step 10 — State & Advanced Patterns
**Review the remaining patterns:** Thread (conversation history), Memory (persistent state), Adaptive (self-improving), Graph (dependency DAG), Nu (role-playing), Chi (learning insights), Tau (tool mediation).

**Files:** `src/patterns/thread.ts`, `src/patterns/memory.ts`, `src/patterns/adaptive.ts`, `src/patterns/graph.ts`, `src/patterns/nu.ts`, `src/patterns/chi.ts`, `src/patterns/tau.ts`

### Step 11 — Role Sets & Skill Loading
**Explore predefined role configurations** for debate, memory, thread, and broadcast patterns. Then see how the skill loader discovers agent skills dynamically.

**Files:** `src/patterns/role-sets.ts`, `src/skill-loader.ts`, `src/skill.sh`

### Step 12 — Test Suite
**Review the comprehensive tests.** The test suite covers core functionality, individual pattern behavior, integration scenarios, configuration management, and model selection.

**Files:** `src/core.test.ts`, `src/patterns.test.ts`, `src/pizx.test.ts`, `src/model-picker.test.ts`, `src/patterns.integration.test.ts`

### Step 13 — Pattern Documentation
**Read the docs for your use case.** Each pattern has dedicated documentation explaining options, output types, and usage examples.

**Files:** `docs/ralph.md`, `docs/fleet.md`, `docs/subagent.md`, `docs/debate.md`, `docs/pipeline.md`, `docs/orchestrator.md`

### Step 14 — Examples & Build Script
**Run the examples.** The `examples/` directory has runnable scripts for every pattern. The build script at `scripts/build.mjs` compiles TypeScript via esbuild.

**Files:** `scripts/build.mjs`

### Step 15 — Architecture Decision Records
**Understand why things are the way they are.** The ADRs document key architectural decisions: template tag DSL design, shared tag factory, quality validation, pattern composition, confirm gates, and system propagation.

**Files:** `docs/decisions/ADR-001-template-tag-dsl.md`, `docs/decisions/ADR-002-shared-tag-factory.md`, `docs/decisions/ADR-005-pattern-composition.md`

---

## File Map

### Source Code (`src/`)

| File | Type | Summary |
|---|---|---|
| `src/index.ts` | Entry Point | Re-exports all template tags and types |
| `src/cli.ts` | CLI Runner | Argument parsing, script execution, print mode |
| `src/globals.ts` | Globals | Global scope injection for shebang scripts |
| `src/pi.ts` | Core | `π` template tag — AI query interface |
| `src/pi-agent.ts` | Core | `Π` template tag — coding agent sessions |
| `src/pi-output.ts` | Types | Pi AI output type definitions |
| `src/load-pi-auth.ts` | Auth | Pi installation discovery and credential loading |
| `src/load-pi-settings.ts` | Settings | Pi configuration directory discovery |
| `src/model-picker.ts` | Utility | AI model selection by task context |
| `src/skill-loader.ts` | Utility | Agent skill content discovery |
| `src/utils.ts` | Utility | `getErrorMessage` helper |
| `src/patterns/types.ts` | Types | Core shared types for all patterns |
| `src/patterns/index.ts` | Barrel | Re-exports all 15 patterns |
| `src/patterns/role-sets.ts` | Config | Predefined role/persona configurations |
| `src/patterns/ralph.ts` | Pattern | Iterative refinement |
| `src/patterns/fleet.ts` | Pattern | Parallel dispatch |
| `src/patterns/subagent.ts` | Pattern | Child agent delegation |
| `src/patterns/debate.ts` | Pattern | Multi-perspective reasoning |
| `src/patterns/pipeline.ts` | Pattern | Sequential processing |
| `src/patterns/orchestrator.ts` | Pattern | Central coordination |
| `src/patterns/critique.ts` | Pattern | Structured review |
| `src/patterns/thread.ts` | Pattern | Conversation history |
| `src/patterns/memory.ts` | Pattern | Persistent state |
| `src/patterns/broadcast.ts` | Pattern | Fan-out dispatch |
| `src/patterns/adaptive.ts` | Pattern | Self-improving strategy |
| `src/patterns/graph.ts` | Pattern | Dependency DAG |
| `src/patterns/nu.ts` | Pattern | Role-playing |
| `src/patterns/chi.ts` | Pattern | Learning insights |
| `src/patterns/tau.ts` | Pattern | Tool mediation |

### Tests (`src/*.test.ts`)

| File | Lines | Tests |
|---|---|---|
| `src/core.test.ts` | 1,428 | Core functionality |
| `src/patterns.test.ts` | 1,575 | Pattern behavior |
| `src/pizx.test.ts` | 987 | Integration |
| `src/model-picker.test.ts` | 313 | Model selection |
| `src/patterns.integration.test.ts` | 441 | End-to-end patterns |

### Configuration

| File | Purpose |
|---|---|
| `package.json` | Package manifest with dependencies and scripts |
| `tsconfig.json` | TypeScript strict mode |
| `tsconfig.build.json` | Build-only TypeScript config |
| `biome.json` | Linting and formatting |
| `vitest.config.ts` | Test runner config |
| `.github/FUNDING.yml` | GitHub Sponsors |

### Documentation

| File | Audience | Content |
|---|---|---|
| `README.md` | Everyone | Project overview and quick-start |
| `docs/onboarding.md` | New users | Installation and first steps |
| `docs/advanced-features.md` | Users | Globals, CLI, programmatic API |
| `docs/<pattern>.md` | Users | Per-pattern documentation (18 files) |
| `docs/decisions/ADR-*.md` | Contributors | Architecture decisions (7 files) |

---

## Complexity Hotspots

These areas are the most complex and should be approached with care:

| File | Complexity | Lines | Why |
|---|---|---|---|
| `src/patterns/nu.ts` | **Complex** | 353 | Role-playing with dynamic persona assignment |
| `src/patterns/tau.ts` | **Complex** | 376 | Tool mediation — external API integration |
| `src/patterns/graph.ts` | **Complex** | 260 | Dependency graph with topological sorting |
| `src/patterns/orchestrator.ts` | **Complex** | 262 | Central coordination logic |
| `src/patterns/adaptive.ts` | **Complex** | 218 | Self-improving strategy adjustment |
| `src/patterns/debate.ts` | **Complex** | 220 | Multi-perspective agent coordination |
| `src/patterns/fleet.ts` | **Complex** | 234 | Parallel agent lifecycle management |
| `src/patterns/ralph.ts` | **Complex** | 232 | Iterative refinement loop |
| `src/patterns/pipeline.ts` | **Complex** | 235 | Stage chaining and data flow |
| `src/patterns/subagent.ts` | **Complex** | 243 | Child agent lifecycle |
| `src/patterns/chi.ts` | **Complex** | 203 | Learning insight extraction |
| `src/patterns/types.ts` | **Complex** | 484 | Shared types — the largest single file |
| `src/pi.ts` | **Complex** | 221 | Core AI query interface |
| `src/pi-agent.ts` | **Complex** | 261 | Coding agent session management |
| `src/cli.ts` | **Complex** | 299 | CLI argument parsing and execution |
| `src/core.test.ts` | **Complex** | 1,428 | Comprehensive core tests |
| `src/patterns.test.ts` | **Complex** | 1,575 | Largest test file |
| `src/pizx.test.ts` | **Complex** | 987 | Integration tests |

**Tips for working with complex files:**
- Start with the pattern docs (`docs/<pattern>.md`) before reading the source
- Focus on the shared types in `src/patterns/types.ts` first — understanding `PatternOutput` and `createPatternTag` unlocks all patterns
- Use the test files as runnable documentation of expected behavior
- Read the ADRs before making architectural changes

---

## Getting Started

### Installation

```bash
npm install @topce/pizx
pi auth login
```

### First Script

Create `hello.mjs`:

```js
#!/usr/bin/env pizx

const answer = await π`what is the capital of France?`
echo(answer)

const files = await $`ls src/`
const summary = await π`summarize these files: ${files}`
console.log(summary)
```

Run it:

```bash
chmod +x hello.mjs
./hello.mjs
# Or: pizx hello.mjs
```

### Quick Query

```bash
pizx -p "explain async/await"
```

### Learning Path

1. Read `README.md` for the full API reference
2. Try the examples in `examples/` — each demonstrates a pattern
3. Read a pattern's `.md` doc, then its `.ts` source, then its test
4. Review the ADRs for architectural context
5. Explore the pattern composition examples for advanced workflows

---

> **Note:** This onboarding guide was generated from the project's knowledge graph. To regenerate it, run `/understand` then `/understand-onboard`.
