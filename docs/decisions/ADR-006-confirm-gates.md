# ADR-006: Human-in-the-Loop Approval Gates (confirm)

## Status

Accepted

## Date

2025-06-10

## Context

Patterns execute autonomously. Users reported wanting to "review the plan before the AI executes it." For example, before dispatching 10 worker agents in Orchestrator, or before running a multi-stage Pipeline, users want to see what will happen and confirm.

Key requirements:
- Must pause before the main execution phase and show a summary
- Must wait for user input (Y/n)
- Must abort cleanly when declined
- Must be opt-in — default behavior unchanged

## Decision

Add a `confirm?: boolean` option to `PatternOptions`. When `true`, each pattern pauses before its main execution phase via a shared `confirmPhase()` helper:

```typescript
export async function confirmPhase(
  description: string,
  opts: { confirm?: boolean; quiet?: boolean }
): Promise<boolean> {
  if (!opts.confirm) return true

  process.stderr.write(`\n  ── Confirm ──\n  ${description}\n  Proceed? [Y/n] `)
  
  const rl = createInterface({ input: process.stdin, output: process.stderr })
  const answer = await new Promise<string>((resolve) => {
    rl.question('', (ans) => resolve(ans))
  })
  rl.close()

  return ['', 'y', 'yes'].includes(answer.trim().toLowerCase())
}
```

### Integration points

Each pattern calls `confirmPhase()` at the natural decision point:

| Pattern | When confirmation fires | Example prompt |
|---------|------------------------|----------------|
| Ω Orchestrator | After plan, before dispatch | `Execute 3 sub-task(s) as planned?` |
| Σ Subagents | After decomposition, before execution | `Execute 3 sub-task(s)?` |
| Φ Fleet | After task list, before execution | `Execute 5 fleet task(s)?` |
| Λ Pipeline | After stage list, before first stage | `Run 3 pipeline stage(s)?` |

When the user declines, the pattern throws an error:

```typescript
throw new Error('pizx/Ω: Execution cancelled by user.')
```

### Design rationale

- **Single boolean**: No need for phase-specific confirmation (e.g., confirm only 'dispatch'). The single boolean covers the most common use case: "review before execution." Per-phase control can be added later if needed.
- **stderr for prompt**: stdout might be captured or piped. stderr is the correct channel for interactive prompts.
- **readline for input**: Simple, standard Node.js. No dependency added.

## Alternatives Considered

### Confirm at multiple points

- Pros: More granular control
- Cons: More complex UX, users don't want to confirm multiple times
- Rejected: Single confirmation point before execution is the highest-value default.

### Environment variable opt-out (PIZX_NO_CONFIRM)

- Pros: Can disable in CI without changing scripts
- Cons: External state makes behavior less predictable
- Rejected: deferring until there's demand.

### Confirm callback

```typescript
confirm: (summary: string) => Promise<boolean>
```

- Pros: Users could implement custom confirmation (Slack bot, email, etc.)
- Cons: Over-engineered. Can be added later without breaking the current API.
- Rejected: Simple boolean covers the immediate use case.

## Consequences

- **Positive**: Users can review plans before execution — catches mistakes early.
- **Positive**: Implementation is ~20 lines in a shared helper, minimal per-pattern cost.
- **Positive**: Cancel returns a clear error, easy to handle in scripts with try/catch.
- **Negative**: Only 4 patterns (Ω, Σ, Φ, Λ) have confirmation gates. Others need updates.
- **Negative**: readline from stdin doesn't work in all environments (e.g., some CI systems without TTY). Users should set `confirm: false` in CI.
- **Trade-off**: The prompt goes to stderr, which is correct for interactive use but means it won't appear if stderr is redirected.
