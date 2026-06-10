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
| Tests | 95/95 | 95/95 |

---

## Remaining Opportunities

| # | Issue | Impact |
|---|---|---|
| 5 | Quality validation only in 3/15 patterns (Ρ, Ψ, Α) | 🟡 Medium |
| 6 | No human-in-the-loop / approval gates | 🟡 Medium |
| 7 | No structured audit logging for pattern phases | 🟡 Medium |
| 8 | No pattern composition / nesting | 🟢 Low |
| 9 | `system` option ignored by most patterns | 🟢 Low |
| 10 | Duplicate `build()` function (pi.ts vs types.ts) | 🟢 Low |
