# ADR-001: Template-Tag DSL for Agent Patterns

## Status

Accepted

## Date

2025-06-10

## Context

pizx is a zx fork that integrates Pi AI. The original zx provides `$` for shell commands as a template tag. We needed a way to invoke AI agents that feels as natural as shell commands.

Key requirements:
- AI calls should feel like shell commands — concise, chainable, pipeable
- Each pattern (Ralph Loop, Fleet, Debate, etc.) is a distinct tag with typed options
- Support option chaining: `Φ({ concurrency: 5 })` returns a callable tag
- Support `.quiet` to suppress streaming output
- All patterns must produce typed result objects (tokens, cost, duration)
- New patterns must be easy to add without boilerplate
- Must coerce to strings naturally for embedding in other contexts

## Decision

Use TypeScript template literal tags with a curried factory pattern. Each pattern is a function that can be invoked in three ways:

```typescript
// 1. Direct template literal call
const result = await Φ`review all .ts files`

// 2. With options — returns a callable tag
const tag = Φ({ concurrency: 5 })
const result = await tag`review all .ts files`

// 3. Quiet variant — suppresses stdout/stderr
const result = await Φ.quiet`review all .ts files`
```

### Implementation

The `PatternFn` interface defines this contract:

```typescript
export interface PatternFn<TOptions extends PatternOptions, TOutput extends PatternOutput> {
  (pieces: TemplateStringsArray, ...args: unknown[]): PatternPromise<TOutput>
  (opts: Partial<TOptions>): PatternFn<TOptions, TOutput>
  quiet: PatternFn<TOptions, TOutput>
}
```

The `PatternPromise` extends `Promise<TOutput>` for awaitability while maintaining typed results.

All patterns extend a shared `PatternOptions` interface and a common `PatternOutput` base class that provides coercion methods (`toString`, `valueOf`, `Symbol.toPrimitive`) so results work naturally in string interpolation.

### Option chaining mechanism

The `createPatternTag` factory (see ADR-002) implements currying:

```typescript
const fn = (pieces, ...args) => {
  if (!Array.isArray(pieces)) return make({ ...merged, ...pieces })
  // execute pattern...
}
```

When called with a non-array (i.e., an options object), it merges and returns a new function. When called with a template literal (array), it executes.

## Alternatives Considered

### Function-based API (Φ.execute({ tasks: [...] }))

- Pros: More conventional, familiar API surface
- Cons: Verbose, doesn't feel like zx. Template tags are zx's killer feature.
- Rejected: Would break the zx identity.

### Builder pattern (new Pattern().withOptions().run())

- Pros: Very discoverable via autocomplete
- Cons: More boilerplate, doesn't compose well, doesn't coerce to string
- Rejected: Over-engineered for the use case.

### Single π tag with a mode parameter

- Pros: Fewer exports
- Cons: No autocomplete for pattern-specific options, type safety suffers
- Rejected: Each pattern has different options and output types.

### Runtime approach (eval-based DSL)

- Pros: Maximum flexibility
- Cons: No type safety, security concerns, hard to debug
- Rejected: TypeScript-first project.

## Consequences

- **Positive**: Patterns feel like native zx features. `await Φ{...}`` reads naturally alongside `await $`ls``.
- **Positive**: Type-safe. Each pattern has its own Options interface and Output class.
- **Positive**: Patterns coerce to strings automatically — usable in template literals.
- **Negative**: The curried function signature is unusual and may confuse newcomers.
- **Negative**: Template tag limitations — can't pass options after the tag body.
- **Trade-off**: `.quiet` is implemented as a getter on a Proxy-like object, which adds complexity but delivers a clean API.
