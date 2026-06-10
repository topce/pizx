# Advanced Features

Cross-cutting features available on all (or most) pattern tags.

---

## Quality Validation (qualityCheck)

All 15 patterns support an optional `qualityCheck` flag. When enabled, the pattern runs a post-execution LLM review that scores the final output and provides actionable feedback.

### Usage

```js
const result = await Ω({ qualityCheck: true })`design the system architecture`

if (result.qualityReview) {
  console.log(`Quality: ${result.qualityReview.score}`)        // 0.0 – 1.0
  console.log(`Assessment: ${result.qualityReview.assessment}`) // 1-2 sentences
  console.log(`Recommendation: ${result.qualityReview.recommendation}`) // improvement
}
```

### Output

```ts
interface QualityReviewResult {
  score: number          // 0.0 (poor) to 1.0 (perfect)
  assessment: string     // Brief evaluation
  recommendation: string // Actionable improvement
}
```

### How It Works

After the pattern's final synthesis step, an additional LLM call evaluates the output against the original request using a structured prompt:

```
SCORE: 0.XX
ASSESSMENT: (1-2 sentences)
RECOMMENDATION: (1 sentence)
```

The review uses the `plannerModel` (or `model` as fallback) — same model used for planning/synthesis phases.

### Cost

One extra LLM call (small, ~200 tokens) per pattern run when enabled. Disabled by default.

### Patterns

The three patterns that already had built-in quality validation (Ρ Ralph, Ψ Critique, Α Adaptive) were **not changed** — their existing quality mechanisms are more deeply integrated into their execution loops. The new `qualityCheck` is additive for the remaining 12 patterns.

---

## Human-in-the-Loop (confirm)

Pause before the main execution phase and ask for approval via stdin.

### Usage

```js
// Pause before dispatching workers
await Ω({ confirm: true })`design the system`
```

When the prompt fires, you'll see:

```
  ── Confirm ──
  Execute 3 sub-task(s) as planned?
    1. Analyze requirements
    2. Design architecture
    3. Document decisions
  Proceed? [Y/n]
```

Press **Enter** or type `y`/`yes` to proceed. Type `n` or anything else to cancel. On cancel, the pattern throws an error (`pizx/Φ: Execution cancelled by user.`).

### Supported Patterns

| Pattern | When confirmation fires |
|---------|------------------------|
| `Ω` Orchestrator | After plan generation, before worker dispatch |
| `Σ` Subagents | After task decomposition, before sub-agent execution |
| `Φ` Fleet | After task list, before parallel execution |
| `Λ` Pipeline | After stage list, before first stage |

### Notes

- The prompt goes to **stderr**, not stdout — correct for interactive prompts
- In CI/non-TTY environments, set `confirm: false` (the default)
- Only one confirmation point per pattern (before the main execution phase)

---

## System Prompt Propagation (system)

The `system` option lets you set context that the pattern uses as the AI's system prompt. Unlike most libraries, your prompt is **never silently discarded** — it's merged with the pattern's own system prompt.

### How Merging Works

```js
await Ω({ system: 'You are a senior security architect.' })`design an auth system`
```

Your prompt is **prepended** to the pattern's default prompt with a blank line separator:

```
You are a senior security architect.

[pattern's default system prompt]
```

This means:
- Your context (persona, domain, constraints) is always included
- The pattern's instructions follow — the model sees both
- If you don't set `system`, the pattern's default is used as-is

### Why Prepend, Not Replace?

Your system prompt sets the high-level persona and context. The pattern's prompt adds task-specific instructions. Putting your prompt first ensures the model sees your context before the specific workflow instructions.

### When to Use

- Setting a specific persona: `system: 'You are a Python expert'`
- Adding domain constraints: `system: 'Use only built-in Node.js APIs'`
- Providing company style guidelines: `system: 'Write in first-person plural'`

---

## Structured Phase Logging (phaseLog)

Every pattern output includes a structured audit trail of what happened during execution — no extra flags needed.

### Usage

```js
const result = await Ω`design the system`

for (const phase of result.phaseLog) {
  console.log(`${phase.phase}: ${phase.durationMs}ms — ${phase.description}`)
}
// → "plan: 1234ms — Generated plan with 3 workers"
// → "dispatch: 5678ms — Executed 3 worker(s), 3 succeeded"
// → "synthesize: 901ms — Synthesized worker results"
```

### Output

```ts
interface PhaseEntry {
  phase: string        // Phase name, e.g. 'plan', 'execute', 'synthesize'
  durationMs: number   // How long this phase took
  description: string  // What happened
  modelUsed?: string   // Model used for this phase
  callCount?: number   // LLM calls made in this phase
}
```

### Programmatic Querying

```js
// Find specific phases
const planPhase = result.phaseLog.find(p => p.phase === 'plan')
console.log(`Planning took ${planPhase?.durationMs}ms`)

// Total duration across all phases
const totalPhaseTime = result.phaseLog.reduce((s, p) => s + p.durationMs, 0)

// Filter by model
const phasesByModel = result.phaseLog.filter(p => p.modelUsed === 'deepseek/deepseek-v4-pro')
```

### Currently Populated Patterns

| Pattern | Phases Recorded |
|---------|-----------------|
| `Ω` Orchestrator | plan, dispatch, synthesize, quality-review |
| `Σ` Subagents | decompose, execute, synthesize, quality-review |
| `Δ` Debate | perspectives, rebuttals, synthesize, quality-review |

More patterns will be populated in future releases.

---

## Pattern Composition (TaskDescriptor)

Fleet and Pipeline can accept **TaskDescriptor** arrays — a mix of plain strings (standard LLM calls) and functions that invoke other patterns.

### TaskDescriptor Type

```ts
type TaskDescriptor = string | ((previousOutput: string) => Promise<string>)
```

- **string**: Standard behavior — the pattern makes an LLM call
- **function**: Wraps a pattern call — receives the previous stage's output (for Pipeline) and returns the result

### Composition in Fleet

```js
await Φ({
  tasks: [
    'analyze the frontend',               // string: standard LLM call
    () => Σ`analyze the backend`,          // function: compose Subagents
    () => Ψ`review the API design`,        // function: compose Critique
  ],
})`review everything`
```

All tasks run in parallel (subject to `concurrency` limit), whether they're strings or functions.

### Composition in Pipeline

```js
await Λ({
  stages: [
    'generate product description',        // string: standard LLM call
    (prev) => Ψ`critique this: ${prev}`,   // function: receives previous output
  ],
})`generate → improve`
```

Function stages receive the **previous stage's output** as `previousOutput`. This enables data flow through composed patterns.

### Important: Lazy Evaluation

Pattern calls must be wrapped in arrow functions — **not called directly**:

```js
// ✅ Correct — lazy: function isn't called until Fleet schedules it
await Φ({ tasks: [() => Σ`analyze backend`] })`...`

// ❌ Wrong — eager: Σ starts executing when the array is created
await Φ({ tasks: [Σ`analyze backend`] })`...`
```

This is because TypeScript template tags evaluate eagerly. The arrow function creates a thunk that defers execution until the pattern scheduler picks it up.
