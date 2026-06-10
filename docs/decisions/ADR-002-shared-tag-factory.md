# ADR-002: Shared Tag Factory (createPatternTag)

## Status

Accepted

## Date

2025-06-10

## Context

Every pattern tag (Ρ, Φ, Σ, Δ, Λ, Ψ, Ω, Θ, Μ, Β, Α, Γ, Ν, Χ, Τ) needs the same ~30 lines of boilerplate for:
- Option chaining (call with options returns a new callable function)
- `.quiet` variant (suppresses output)
- Template literal dispatch
- Trace collection (initializing, collecting, and attaching CallTrace[] to output)

With 15 patterns, this was ~450 lines of near-identical code. A bug in the chaining logic required fixing it in all 15 files.

## Decision

Create a single generic `createPatternTag(defaults, execute)` factory function in `types.ts` that every pattern uses in one line:

```typescript
export const Φ = createPatternTag(defaults, execute)
```

The factory handles:
1. Merging partial options with defaults
2. Detecting whether it's being called with options (currying) or a template literal (execution)
3. Creating the `.quiet` variant via a lazy getter
4. Setting up and collecting the execution trace

### Implementation

```typescript
export function createPatternTag<TOptions, TOutput>(
  defaults: TOptions,
  execute: (pieces: TemplateStringsArray, args: unknown[], opts: TOptions) => Promise<TOutput>
): PatternFn<TOptions, TOutput> {
  function make(opts: Partial<TOptions> = {}): PatternFn<TOptions, TOutput> {
    const merged = { ...defaults, ...opts }

    const fn = (pieces, ...args): PatternPromise<TOutput> | PatternFn<TOptions, TOutput> => {
      if (!Array.isArray(pieces)) return make({ ...merged, ...pieces })
      beginTrace()
      return new PatternPromise((resolve, reject) => {
        execute(pieces, args, merged).then(
          (output) => { output.trace = collectTrace(); resolve(output) },
          (err) => { collectTrace(); reject(err) }
        )
      })
    }

    let _quiet: PatternFn | undefined
    Object.defineProperty(fn, 'quiet', {
      get(): PatternFn { ... },
      enumerable: true,
    })

    return fn as PatternFn
  }

  return make()
}
```

### Trace management

Trace state is module-level (singleton `_trace: CallTrace[] | null`) managed by three functions:

- `beginTrace()` — initializes a new trace array
- `pushTrace(entry)` — appends a trace entry (called by `ask()`)
- `collectTrace()` — returns and clears the trace

This avoids passing trace state through every function call. The `createPatternTag` factory guarantees that every execute cycle starts with a fresh trace and ends with it attached to the output.

## Alternatives Considered

### Class-based pattern definition

Each pattern extends a base `Pattern` class:

```typescript
class FleetPattern extends Pattern<FleetOptions, FleetOutput> { ... }
```

- Pros: Familiar OOP, explicit lifecycle
- Cons: More verbose, requires `super()` calls, harder to tree-shake
- Rejected: Function-based is more tree-shakeable and aligns with the functional style of the codebase.

### Decorator-based

Each pattern is a plain function with a `@patternTag` decorator:

```typescript
@patternTag(defaults)
async function executeFleet(pieces, args, opts) { ... }
```

- Pros: Clean, separates concerns
- Cons: Decorators are still experimental in TypeScript, adds compilation complexity
- Rejected: Too fragile for the target Node.js version range.

### Manual duplication

Keep the ~30 lines duplicated in each of the 15 pattern files.

- Pros: Zero abstraction cost, each file is self-contained
- Cons: 450 lines of duplication, bugs propagate to all patterns
- Rejected: Violates DRY for no benefit. The abstraction is well-understood and stable.

## Consequences

- **Positive**: 450 lines removed. Each pattern file is ~30 lines shorter.
- **Positive**: Trace collection is centralized — token/cost tracking works for all patterns automatically.
- **Positive**: Adding a new pattern requires only `defaults` + `execute()` — zero boilerplate.
- **Positive**: Bundle size reduced by ~8% (89.7 KB → 82.5 KB).
- **Negative**: Module-level trace state is a minor design smell — but it's scoped to a single file, reset per execution cycle, and invisible to consumers.
- **Negative**: The factory's generic type parameters (`TOptions`, `TOutput`) make TypeScript errors slightly harder to read.
