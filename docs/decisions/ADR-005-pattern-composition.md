# ADR-005: Pattern Composition via TaskDescriptor

## Status

Accepted

## Date

2025-06-10

## Context

Users wanted to compose patterns — use one pattern as a sub-task inside another. For example, running a Subagents pattern as one of several Fleet tasks, or piping a Pipeline stage's output into a Critique pattern.

Before this change, patterns could only be chained manually:

```typescript
const analysis = await Σ`analyze the backend`
const review = await Ψ`review this: ${analysis}`
```

There was no way to express "run these three Fleet tasks, where task 2 is a Subagents pattern" without separate top-level awaits.

## Decision

Introduce a `TaskDescriptor` type and update Fleet and Pipeline to accept arrays of them:

```typescript
type TaskDescriptor = string | ((previousOutput: string) => Promise<string>)
```

- `string` — standard behavior: the pattern makes an LLM call
- `function` — the function is invoked, receives previous output (empty string for Fleet), and returns a promise of the result text

### Implementation in Fleet

`FleetOptions.tasks` changed from `string[]` to `TaskDescriptor[]`. The `executeTask` function checks the type:

```typescript
async function executeTask(task: TaskDescriptor, ...): Promise<FleetMemberOutput> {
  if (typeof task === 'function') {
    const text = await task('')     // invoke the composed pattern
    return new FleetMemberOutput('(composed pattern)', text, true)
  }
  // string: standard LLM call
  const text = await ask(task, { ... })
  return new FleetMemberOutput(task, text, true)
}
```

### Implementation in Pipeline

`PipelineOptions.stages` changed from `string[]` to `TaskDescriptor[]`. The stage loop checks the type:

```typescript
if (typeof stage === 'function') {
  output = await stage(currentInput)  // previous output flows to the function
} else {
  // string: standard LLM call with generateStagePrompt
  output = await ask(prompt, { ... })
}
```

This is significant: Pipeline stages receive the previous stage's output as `previousOutput`, enabling data flow through composed patterns.

### Usage examples

```typescript
// Fleet: mix plain tasks with pattern calls
await Φ({
  tasks: [
    'analyze the frontend',              // string: standard LLM call
    () => Σ`analyze the backend`,        // function: Subagents pattern
    () => Ψ`review the API design`,      // function: Critique pattern
  ],
})`review everything`

// Pipeline: composed stage receives previous output
await Λ({
  stages: [
    'generate product description',
    (prev) => Ψ`critique this: ${prev}`, // function receives prev output
  ],
})`generate → improve`
```

## Alternatives Considered

### Allow PatternPromise directly (not wrapped in a factory)

Instead of `() => Σ\`...\``, allow `Σ\`...\`` directly:

```typescript
tasks: [
  'analyze frontend',
  Σ`analyze backend`,  // eagerly evaluates
]
```

- Pros: Cleaner syntax
- Cons: Template tags evaluate eagerly — `Σ\`analyze backend\`` would start executing the moment the tasks array is constructed, not when the Fleet gets to it. The thunk `() => Σ\`...\`` provides lazy evaluation.
- Rejected: Eager evaluation would break parallelism in Fleet and ordering in Pipeline.

### Generic compose() utility

```typescript
compose(Φ, { tasks: [...] })
```

- Pros: More composable, could chain arbitrarily
- Cons: Abstract, would need a separate API surface. The TaskDescriptor approach integrates naturally into existing options.
- Rejected: Simpler to put composition at the point of use (tasks/stages options).

### TaskDescriptor with additional metadata

```typescript
type TaskDescriptor = string | { pattern: () => Promise<string>; label: string }
```

- Pros: Could provide a label for display in summaries
- Cons: More complex to use. Users can already see results via `result.members`.
- Rejected: Keep it simple. An object wrapper can be added later if labels become important.

## Consequences

- **Positive**: Natural composition — users wrap a pattern call in `() =>` and pass it as a task.
- **Positive**: Data flow in Pipeline — composed stages receive previous output as context.
- **Positive**: Backward compatible — existing `string[]` tasks still work unchanged.
- **Positive**: No new API surface — composition is just an extension of existing options.
- **Negative**: The `() =>` thunk syntax is slightly noisier than bare pattern calls.
- **Negative**: Cannot compose with patterns that need custom options (e.g., `Φ({ concurrency: 3 })`) as a Fleet task — the thunk would need to wrap the full call: `() => Φ({ concurrency: 3 })\`...\`` which works but is verbose.
- **Trade-off**: Only Fleet and Pipeline support composition. Other patterns (Ω, Σ, Δ, etc.) don't accept TaskDescriptor. This is intentional — Fleet and Pipeline are the natural composition points (parallel + sequential).
