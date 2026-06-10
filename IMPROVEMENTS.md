# Improvements Log

Cumulative improvements to pizx — mapped against [multi-agent orchestration best practices](https://github.com/topce/pizx).

---

## #1 — Deduplicate `pickModel` (2026-06-10)

**Problem:** The model-picking logic (~65 lines) was duplicated identically in `src/pi.ts` and `src/patterns/types.ts`. A bug fix in one would not reach the other.

**Fix:** Extracted all model-picking functions into a single shared module `src/model-picker.ts`, imported by both consumers.

| File | Change |
|---|---|
| `src/model-picker.ts` | **New** — single source of truth for `pickModel()` |
| `src/pi.ts` | −65 lines (imports from model-picker) |
| `src/patterns/types.ts` | −90 lines (imports from model-picker) |

**Verification:** ✅ JS build, DTS, 95/95 tests pass.

---

## #2 — Extract Tag Factory (2026-06-10)

**Problem:** All 15 pattern files duplicated the same ~30 lines of option-chaining + `.quiet` boilerplate. ~450 lines of near-identical code.

**Fix:** Created a generic `createPatternTag(defaults, execute)` factory in `types.ts`. Every pattern now uses a single line:

```ts
export const Φ = createPatternTag(defaults, execute)
```

| File | Change |
|---|---|
| `src/patterns/types.ts` | +36 lines (`createPatternTag` factory) |
| 15 pattern files | −30 lines each (−450 total) |
| Bundle size | 89.7 KB → 82.5 KB (−8%) |

**Benefit:** New patterns only need `defaults` + `execute()`. Zero boilerplate.

**Verification:** ✅ JS build, DTS, 95/95 tests pass.

---

## #3 — Timeout & Retry Support (2026-06-10)

**Problem:** No timeout or retry configuration. A hung LLM call blocked the entire pipeline indefinitely. The underlying pi-ai SDK already supported `timeoutMs` and `maxRetries` in `StreamOptions`, but pizx didn't expose them.

**Fix:** Added `timeoutMs` and `maxRetries` to `PatternOptions` and `PiOptions`, and updated all `ask()` calls to spread `opts` so these fields flow through to the provider SDK.

### Usage

```js
// Per-pattern
await Φ({ timeoutMs: 30000, maxRetries: 2 })`review all .ts files`

// Per-call on π
await π({ timeoutMs: 15000 })`summarize this document`

// Global defaults
configurePi({ timeoutMs: 60000, maxRetries: 3 })
```

### Files changed

| File | Change |
|---|---|
| `src/patterns/types.ts` | Added `timeoutMs`, `maxRetries` to `PatternOptions`; pass to `completeSimple` |
| `src/pi.ts` | Added to `PiOptions`; pass to `streamSimple` via `makeOpts` |
| 15 pattern files | All `ask()` calls updated to spread `{ ...opts, ...overrides }` |

**Verification:** ✅ JS build, DTS, 95/95 tests pass.

---

## #4 — Token & Cost Tracking (2026-06-10)

**Problem:** No visibility into token usage or cost. Patterns tracked duration but not resource consumption. pi-ai's `AssistantMessage.usage` was discarded.

**Fix:** Automatic trace collection on every LLM call. Each `PatternOutput` and `PiOutput` now carries a `trace: CallTrace[]` array with per-call token/cost data, plus aggregate helpers.

### Usage

```js
const result = await Ω`design a notification system`

// Per-call breakdown
for (const t of result.trace) {
  console.log(`Call ${t.call}: ${t.modelId} — ${t.totalTokens} tokens, $${t.cost.toFixed(6)}`)
}

// Aggregates (on PatternOutput and PiOutput)
console.log(`Total: ${result.totalTokens} tokens`)
console.log(`Cost:  $${result.totalCost.toFixed(4)}`)
console.log(`Calls: ${result.callCount}`)

// Also works with π
const answer = await π`explain quantum computing`
console.log(`Input: ${answer.inputTokens}, Output: ${answer.outputTokens}`)
```

### CallTrace fields

| Field | Type | Description |
|---|---|---|
| `call` | `number` | 1-based call index within the pattern execution |
| `modelId` | `string` | Model id used for this call |
| `promptPreview` | `string` | First 200 chars of the prompt |
| `outputPreview` | `string` | First 200 chars of the output |
| `inputTokens` | `number` | Input tokens consumed |
| `outputTokens` | `number` | Output tokens generated |
| `cacheReadTokens` | `number` | Cache read tokens |
| `cacheWriteTokens` | `number` | Cache write tokens |
| `totalTokens` | `number` | Total tokens (input + output) |
| `cost` | `number` | Cost in USD |
| `durationMs` | `number` | Duration of this call in ms |

### Aggregate helpers (PatternOutput & PiOutput)

| Getter | Description |
|---|---|
| `.inputTokens` | Sum of input tokens across all calls |
| `.outputTokens` | Sum of output tokens across all calls |
| `.totalTokens` | Sum of total tokens across all calls |
| `.totalCost` | Sum of cost across all calls |
| `.callCount` | Number of LLM calls made |

### Files changed

| File | Change |
|---|---|
| `src/patterns/types.ts` | Added `CallTrace`, trace accumulator, updated `ask()`, updated `createPatternTag` |
| `src/pi-output.ts` | Added `trace`, `inputTokens`, `outputTokens`, `totalTokens`, `totalCost` |
| `src/pi.ts` | Captures `done` event usage, populates trace on `PiOutput` |
| `src/patterns/index.ts` | Exports `CallTrace`, `createPatternTag` |
| `src/index.ts` | Exports `CallTrace`, `createPatternTag` |

**Verification:** ✅ JS build, DTS, 95/95 tests pass.

---

## Cumulative Impact

| Metric | Before | After |
|---|---|---|
| JS bundle (index.js) | 89.7 KB | 83.3 KB |
| Source lines deleted | — | −649 net |
| Duplicated `pickModel` | 2 copies | 1 (`src/model-picker.ts`) |
| Duplicated tag factories | 15 copies | 1 (`createPatternTag`) |
| Timeout support | ❌ | ✅ `timeoutMs` on all tags |
| Retry support | ❌ | ✅ `maxRetries` on all tags |
| Token tracking | ❌ | ✅ `.trace`, `.totalTokens` on all outputs |
| Cost tracking | ❌ | ✅ `.totalCost` in USD on all outputs |
| Tests | 95/95 | 220/220 |
| Quality validation patterns | 3/15 | 15/15 |

---

---

## #5 — Quality Validation for All Patterns (2026-06-10)

**Problem:** Only 3 of 15 patterns (Ρ Ralph, Ψ Critique, Α Adaptive) had built-in quality validation. The remaining 12 produced outputs with no quality assessment.

**Fix:** Added optional `qualityCheck` option to all 12 remaining patterns. When enabled, runs a post-execution LLM review that scores the final output (0.0–1.0), provides an assessment, and recommends improvements.

### Approach

1. Extracted a shared `runQualityReview()` helper into `types.ts` to avoid ~420 lines of duplication
2. Added `qualityCheck?: boolean` option to each pattern's Options interface
3. Added optional `qualityReview?: QualityReviewResult` field to each pattern's Output class
4. Each pattern calls `runQualityReview(originalRequest, finalOutput, opts)` after its final synthesis/execution step

### Patterns updated (12)

| Pattern | Review Target |
|---|---|
| Ω Orchestrator | Final synthesis |
| Σ Subagents | Final synthesis |
| Δ Debate | Final conclusion |
| Θ Thread | Final conclusion |
| Μ Memory | Consolidated synthesis |
| Β Broadcast | Synthesized recommendation |
| Ν Nu | Synthesized final answer |
| Τ Tau | Consolidated synthesis |
| Λ Pipeline | Final pipeline output |
| Φ Fleet | Aggregate fleet results |
| Γ Graph | Final DAG output |
| Χ Chi | Extracted insights |

### Usage

```js
const result = await Ω({ qualityCheck: true })`design the system architecture`
if (result.qualityReview) {
  console.log(`Quality: ${result.qualityReview.score}`)
  console.log(result.qualityReview.assessment)
}
```

### Files changed

| File | Change |
|---|---|
| `src/patterns/types.ts` | +42 lines: `QualityReviewResult`, `QUALITY_REVIEW_SYSTEM`, `runQualityReview()` |
| `src/patterns/index.ts` | +2 exports |
| 12 pattern files | ~10 lines each: option, constructor field, review call |
| `src/pizx.test.ts` | +70 lines: qualityReview tests for all Output classes |

**Verification:** ✅ JS build, DTS, 220/220 tests pass (was 211).

---

## #6 — System Prompt Propagation for All Patterns (2026-06-10)

**Problem:** The `system` option in `PatternOptions` was silently ignored by most patterns. Each pattern had hardcoded system prompts (e.g., `PLAN_SYSTEM`, `ANALYSIS_SYSTEM`) that completely replaced the user's custom system prompt. Only `fleet.ts` (via `opts.system ?? FLEET_SYSTEM`) and `pi.ts` (via the `ask()` default) respected it.

**Fix:** Added a shared `mergeSystem(userSystem, patternSystem)` helper in `types.ts` that prepends the user's system prompt to the pattern's default. Updated all 15 patterns to wrap every `system:` override with `mergeSystem(opts.system, …)`.

### How it works

```typescript
// Before: user's system prompt silently replaced
const result = await Ω({ system: 'You are an expert in cloud architecture.' })`design a deployment`
// → Only PLANNER_SYSTEM was used

// After: user's system is prepended to pattern's default
const result = await Ω({ system: 'You are an expert in cloud architecture.' })`design a deployment`
// → "You are an expert in cloud architecture.\n\n[PLANNER_SYSTEM]"
```

### Files changed

| File | Change |
|---|---|
| `src/patterns/types.ts` | +8 lines: `mergeSystem()` helper |
| `src/patterns/index.ts` | Export `mergeSystem` |
| 15 pattern files | +1 import, +1-4 `mergeSystem()` wraps each |

**Verification:** ✅ JS build, DTS, 220/220 tests pass.

---

## #7 — Structured Phase Logging for Pattern Execution (2026-06-10)

**Problem:** No structured audit trail for what happened during a pattern execution. Only the final text output and per-LLM-call token traces were available.

**Fix:** Added `PhaseEntry` interface and `phaseLog: PhaseEntry[]` field to the base `PatternOutput` class. Added a `recordPhase()` helper. Three patterns (Ω, Σ, Δ) record phases (plan, decompose, execute, synthesize, quality-review) with timing and model info.

### PhaseEntry structure

```typescript
interface PhaseEntry {
  phase: string
  durationMs: number
  description: string
  modelUsed?: string
  callCount?: number
}
```

### Usage

```typescript
const result = await Ω`design the system`
for (const phase of result.phaseLog) {
  console.log(`${phase.phase}: ${phase.durationMs}ms — ${phase.description}`)
}
// → "plan: 1234ms — Generated plan with 3 workers"
// → "dispatch: 5678ms — Executed 3 worker(s), 3 succeeded"
// → "synthesize: 901ms — Synthesized worker results"
```

### Files changed

| File | Change |
|---|---|
| `src/patterns/types.ts` | +9 lines: `PhaseEntry` interface, `phaseLog` on `PatternOutput` |
| `src/patterns/index.ts` | Export `PhaseEntry` |
| `src/index.ts` | Export `PhaseEntry` |
| `src/patterns/orchestrator.ts` | +4 phase entries: plan, dispatch, synthesize, quality-review |
| `src/patterns/subagent.ts` | +4 phase entries: decompose, execute, synthesize, quality-review |
| `src/patterns/debate.ts` | +4 phase entries: perspectives, rebuttals, synthesize, quality-review |
| `src/pizx.test.ts` | Test for `phaseLog` on `PatternOutput` |

**Verification:** ✅ JS build, DTS, 221/221 tests pass.

---

## #8 — Human-in-the-Loop Approval Gates (2026-06-10)

**Problem:** Patterns execute autonomously with no way to pause and review before irreversible steps. Users reported wanting to "review the plan before the AI executes it."

**Fix:** Added `confirm?: boolean` option to `PatternOptions`. When enabled, the pattern pauses via a `confirmPhase()` helper that shows a summary and prompts `[Y/n]` on stdin before executing.

### How it works

```typescript
// Pause before dispatch to review sub-tasks
await Ω({ confirm: true })`design the system architecture`
// → Shows: "Execute 3 sub-task(s) as planned?"
// → Presses Enter to confirm, or 'n' to cancel

// With pipeline
await Λ({ confirm: true })`analyze → generate → review`
```

### Files changed

| File | Change |
|---|---|
| `src/patterns/types.ts` | +17 lines: `confirm?: boolean` on `PatternOptions`, `confirmPhase()` helper |
| `src/patterns/index.ts` | Export `confirmPhase` |
| `src/patterns/orchestrator.ts` | `await confirmPhase(...)` before dispatch |
| `src/patterns/subagent.ts` | `await confirmPhase(...)` before execution |
| `src/patterns/fleet.ts` | `await confirmPhase(...)` before task execution |
| `src/patterns/pipeline.ts` | `await confirmPhase(...)` before first stage |

**Verification:** ✅ JS build, DTS, 221/221 tests pass.

---

## #9 — Pattern Composition / Nesting (2026-06-10)

**Problem:** No way to use one pattern as a sub-task inside another. Users had to manually chain patterns — no native composition mechanism.

**Fix:** Added `TaskDescriptor` type (`string | ((prev: string) => Promise<string>)`). Updated **Fleet** and **Pipeline** to accept `TaskDescriptor[]` in their `tasks`/`stages` options.

### How it works

```typescript
// Fleet: mix plain tasks with pattern calls
await Φ({ tasks: [
  'analyze the frontend',             // string: standard LLM call
  () => Σ\`analyze the backend\`,      // function: compose a Subagents pattern
  () => Ψ\`review the API design\`,    // compose a Critique pattern
] })`review everything`

// Pipeline: stages receive previous output as context
await Λ({ stages: [
  'analyze the code',
  (prev) => Ψ\`review this: ${prev}\`, // previous stage output flows into pattern
] })`analyze → review`
```

### Files changed

| File | Change |
|---|---|
| `src/patterns/types.ts` | +1 line: `TaskDescriptor` type |
| `src/patterns/fleet.ts` | `tasks` accepts `TaskDescriptor[]`; `executeTask` handles functions |
| `src/patterns/pipeline.ts` | `stages` accepts `TaskDescriptor[]`; stage loop handles functions |
| `src/patterns/index.ts` | Export `TaskDescriptor` |
| `src/index.ts` | Export `TaskDescriptor` |
| `src/pizx.test.ts` | +9 lines: `TaskDescriptor` type tests |

**Verification:** ✅ JS build, DTS, 223/223 tests pass (was 221).

---

## Remaining Opportunities

All original 10 improvements completed. ✅
