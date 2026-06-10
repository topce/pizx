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

## Remaining Opportunities

| # | Issue | Impact |
|---|---|---|
| 5 | ~~Quality validation only in 3/15 patterns (Ρ, Ψ, Α)~~ ✅ All 15 now have qualityCheck | 🟡 Medium |
| 6 | No human-in-the-loop / approval gates | 🟡 Medium |
| 7 | No structured audit logging for pattern phases | 🟡 Medium |
| 8 | No pattern composition / nesting | 🟢 Low |
| 9 | ~~`system` option ignored by most patterns~~ ✅ All patterns now merge user system with pattern defaults | 🟢 Low |
| 10 | ~~Duplicate `build()` function (pi.ts vs types.ts)~~ ✅ Already deduplicated (imports from types.ts) | 🟢 Low |
