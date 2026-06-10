# ADR-007: System Prompt Propagation (mergeSystem)

## Status

Accepted

## Date

2025-06-10

## Context

The `system` option in `PatternOptions` was intended to let users provide custom system prompt context. However, most patterns silently ignored it — they passed their own hardcoded system prompts (e.g., `PLAN_SYSTEM`, `ANALYSIS_SYSTEM`) to `ask()`, which completely replaced the user's `system` value.

Only `fleet.ts` partially respected it via `opts.system ?? FLEET_SYSTEM` — but this was a "replace" not "augment" pattern: the user's prompt fully replaced the pattern's default.

## Decision

Add a shared `mergeSystem()` helper that prepends the user's system prompt to the pattern's default:

```typescript
export function mergeSystem(
  userSystem: string | undefined,
  patternSystem: string
): string {
  if (!userSystem) return patternSystem
  return `${userSystem}\n\n${patternSystem}`
}
```

Every `system:` override in every pattern is wrapped with `mergeSystem(opts.system, ...)`:

```typescript
// Before: user's system silently replaced
system: ANALYSIS_SYSTEM

// After: user's system prepended
system: mergeSystem(opts.system, ANALYSIS_SYSTEM)
```

### Behavior

- If the user provides no `system` option (`undefined`), the pattern's default prompt is used unchanged.
- If the user provides `system`, it is prepended with a blank line separator: `"user prompt\n\n[pattern prompt]"`.
- This is additive — the user's context is always included, and the pattern's instructions follow.

### Why prepend, not append?

The user's system prompt sets the overall persona and context. The pattern's prompt adds task-specific instructions. Ordering the user's prompt first means the model sees the high-level context before the specific instructions, which generally produces better results.

## Alternatives Considered

### Replace (the original broken behavior)

`opts.system ?? PATTERN_SYSTEM`

- Pros: Simple
- Cons: User either gets their prompt or the pattern prompt, never both. If the user wants both, they must manually include the pattern's prompt text.
- Rejected: This was the broken behavior we fixed.

### Append (pattern first, user second)

`${patternSystem}\n\n${userSystem}`

- Pros: Pattern instructions stay immediately before the user's message
- Cons: Pattern instructions override the user's persona/context. The user's "You are a security expert" would come after "You are a planning specialist."
- Rejected: Prepending respects the user's intent as the primary directive.

### Prompt merging with deduplication

- Pros: Could avoid duplicate instructions
- Cons: Complex, fragile, and the LLM handles duplicates fine
- Rejected: Over-engineered for a simple prompt augmentation.

### Non-merge — expose the system prompt as a separate hook

```typescript
system: 'You are a security expert',
appendSystem: true  // or prependSystem
```

- Pros: Explicit control
- Cons: Yet another option to configure. The "always merge" approach is simpler and covers 95% of use cases.
- Rejected: Keep it simple — always merge.

## Consequences

- **Positive**: `system` option now works as users expect. All 15 patterns respect it.
- **Positive**: Zero configuration — merging happens automatically.
- **Positive**: Backward compatible — existing scripts that didn't use `system` are unchanged.
- **Negative**: Slightly longer system prompts (maybe +100 tokens max). Negligible cost increase.
- **Negative**: Users cannot *replace* a pattern's default prompt — only augment. If a user wants to completely replace a pattern's instructions, they still can't. This is an intentional design choice: pattern defaults define the pattern's behavior.
