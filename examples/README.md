# pizx Examples

Run examples with `pizx <file>` or `npm run example:<name>`.

## Getting Started

```bash
pizx examples/hello-pizx.mjs          # basic pizx script
pizx examples/basic-pi.mjs            # π — text generation
pizx examples/basic-capital-pi.mjs    # Π — coding agent
pizx examples/quick-ask.mjs           # quick one-shot query
```

## Agent Patterns

Each pattern has a dedicated example showing its core workflow:

| Pattern | Example | Run |
|---------|---------|-----|
| Ρ Ralph Loop | `examples/pattern-ralph.mjs` | `npm run example:pattern-ralph` |
| Φ Fleet | `examples/pattern-fleet.mjs` | `npm run example:pattern-fleet` |
| Σ Subagents | `examples/pattern-subagent.mjs` | `npm run example:pattern-subagent` |
| Δ Debate | `examples/pattern-debate.mjs` | `npm run example:pattern-debate` |
| Λ Pipeline | `examples/pattern-pipeline.mjs` | `npm run example:pattern-pipeline` |
| Ψ Critique | `examples/pattern-critique.mjs` | `npm run example:pattern-critique` |
| Ω Orchestrator | `examples/pattern-orchestrator.mjs` | `npm run example:pattern-orchestrator` |
| Θ Thread | `examples/pattern-thread.mjs` | `npm run example:pattern-thread` |
| Μ Memory | `examples/pattern-memory.mjs` | `npm run example:pattern-memory` |
| Β Broadcast | `examples/pattern-broadcast.mjs` | `npm run example:pattern-broadcast` |
| Α Adaptive | `examples/pattern-adaptive.mjs` | `npm run example:pattern-adaptive` |
| Γ Graph | `examples/pattern-graph.mjs` | `npm run example:pattern-graph` |
| Ν Nu | `examples/pattern-nu.mjs` | `npm run example:pattern-nu` |
| Χ Chi | `examples/pattern-chi.mjs` | `npm run example:pattern-chi` |
| Τ Tau | `examples/pattern-tau.mjs` | `npm run example:pattern-tau` |

## Feature Demos

| Feature | Example | Run |
|---------|---------|-----|
| Skills | `examples/pattern-agent-with-skill.mjs` | `npm run example:agent-with-skill` |
| Quality review | `examples/pattern-quality.mjs` | `npm run example:quality` |
| Timeout & retry | `examples/pattern-timeout-retry.mjs` | `npm run example:timeout-retry` |
| System propagation | `examples/pattern-system-propagation.mjs` | `npm run example:system-propagation` |
| Five whys | `examples/pattern-five-whys.mjs` | `npm run example:five-whys` |
| Tracking | `examples/pattern-tracking.mjs` | `npm run example:tracking` |

## Execution Modes (hitl / semi / auto)

Demonstrates the three execution modes across all 9 supported patterns
(π, Π, Ω, Σ, Φ, Λ, Ρ, Δ, Ψ):

```bash
# All patterns, all modes
pizx examples/pattern-execution-modes.mjs

# Just Ralph Loop in semi mode
MODE=semi WHICH=Ρ pizx examples/pattern-execution-modes.mjs

# Just Debate in hitl mode
MODE=hitl WHICH=Δ pizx examples/pattern-execution-modes.mjs
```

**Modes:**
- `auto` — no gates, runs to completion (default)
- `semi` — gates at major decision points (backward-compatible with `confirm: true`)
- `hitl` — gates before EVERY phase, human approves each step

**Filter with env vars:** `MODE=auto|semi|hitl|all` `WHICH=π|Π|Ω|Σ|Φ|Λ|Ρ|Δ|Ψ|all`

> **Note:** Running without filters fires all 9 patterns × 3 modes = many LLM calls. Use `MODE` and `WHICH` to limit scope and avoid burning API credits. For a quick smoke test, try `MODE=semi WHICH=π`.

## Confirmation Gates

| Example | What |
|---------|------|
| `examples/test-confirm.mjs` | Basic `confirm: true` gate for π and Σ |
| `examples/test-confirm-all.mjs` | Comprehensive gate examples for π, Π, Ω, Σ, Φ, Λ |
| `examples/pattern-execution-modes.mjs` | Full hitl/semi/auto mode tour (9 patterns × 3 modes) |

## Pattern Composition

| Example | What |
|---------|------|
| `examples/test-composition-fleet.mjs` | Fleet with function stages (pattern inside pattern) |
| `examples/test-composition-pipeline.mjs` | Pipeline with function stages |

## Ralph Loop Variants

| Example | Pattern |
|---------|---------|
| `examples/ralph-loop.mjs` | Ralph Loop (legacy format) |
| `examples/pattern-ralph.mjs` | Ralph Loop (current pattern tag) |
