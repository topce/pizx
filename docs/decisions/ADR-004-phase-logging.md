# ADR-004: Structured Phase Logging (phaseLog)

## Status

Accepted

## Date

2025-06-10

## Context

Before phase logging, the only way to understand what happened during a pattern execution was:
1. The `text` summary on the output (unstructured, pattern-dependent)
2. The `trace: CallTrace[]` (per-LLM-call with tokens/cost/duration — but no semantic grouping)

Missing: a structured, queryable audit trail of what *phases* the pattern went through, how long each took, what model was used, and how many LLM calls each phase made.

## Decision

Add a `PhaseEntry` interface and `phaseLog: PhaseEntry[]` field to the base `PatternOutput` class:

```typescript
export interface PhaseEntry {
  phase: string        // 'plan', 'decompose', 'execute', 'synthesize', 'review'
  durationMs: number
  description: string
  modelUsed?: string
  callCount?: number
}

export class PatternOutput {
  public trace: CallTrace[] = []
  public phaseLog: PhaseEntry[] = []  // <-- new
  ...
}
```

Each pattern populates `phaseLog` from its `execute()` function by collecting phases in a local array and assigning it to the output before returning:

```typescript
// In Ω (Orchestrator) execute function:
const phases: PhaseEntry[] = []

// Phase 1: Plan
const planStart = Date.now()
const planText = await ask(request, { ... })
phases.push({ phase: 'plan', durationMs: Date.now() - planStart, description: `Generated plan`, modelUsed: plannerModel })

// ... more phases ...

const output = new OrchestratorOutput(...)
output.phaseLog = phases
return output
```

### Design rationale

- **On PatternOutput (base class)**: All patterns extend it, so phaseLog works everywhere without modifying individual output classes.
- **Public mutable array**: Consumers can push to it and patterns assign `output.phaseLog = phases` at the end.
- **Populated by patterns, not framework**: The framework couldn't know what constitutes a "phase" for each pattern. Adaptive has individual step phases, Debate has perspective rounds. Each pattern knows its own phases.

## Alternatives Considered

### Module-level collector (like CallTrace)

- Pros: Automatic, no pattern changes
- Cons: The `ask()` function only knows about LLM calls, not semantic phases. A module-level collector would need pattern-specific callbacks.
- Rejected: Over-engineered. Patterns know their phases best.

### Phase log on each output class individually

- Pros: Tighter typing per pattern
- Cons: Requires modifying all 15 output classes. The base class approach works universally.
- Rejected: Base class is simpler and still type-safe.

### Structured log output to stderr

- Pros: Can be consumed by external tooling (jq, etc.)
- Cons: Mixes with debug output, hard to query programmatically
- Rejected: phaseLog is for programmatic access.

## Consequences

- **Positive**: Every pattern output has a queryable execution timeline.
- **Positive**: Phase durations help identify bottlenecks — is planning slow? Execution?
- **Positive**: No extra LLM calls — phase timing is based on real execution timestamps.
- **Negative**: Patterns must be updated individually to populate phaseLog. Currently only 3 patterns (Ω, Σ, Δ) are populated.
- **Negative**: Phase naming is not standardized across patterns — 'synthesize' vs 'consolidate' vs 'conclusion' mean similar things. A future standardization pass could align these.
