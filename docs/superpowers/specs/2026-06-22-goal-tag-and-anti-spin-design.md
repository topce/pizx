# pizx Goal & Anti-Spin — Loop Upgrade

## Problem Statement

> **How might we give pizx users a contract-first, separate-verifier goal pattern that guarantees completion criteria are met — and make existing loops smarter about knowing when to stop?**

The "WTF Is a Loop?" articles (Matt Van Horn, June 2026, 3.6M+ reads) identify the #1 failure mode of AI coding loops: **agents say "done" when they're not.** The fix is a separate verifier that checks work against a contract written BEFORE execution, plus structural guards: budget caps, no-progress detection, flip-flop detection, and streak-mode verification (N consecutive clean passes, not just one lucky green run).

pizx today has `Ρ` (Ralph Loop) — analyze → plan → execute → review → repeat — but the review is the same model grading its own homework. There is no way to set a dollar budget, detect spins, or require consecutive clean reviews. The articles describe `/goal` (contract-first, separate verifier) as the state of the art. pizx has no equivalent.

## Recommended Direction

**Option C — New `goal` tag + three new options on `Ρ` (Ralph).**

### Part 1: Ralph enhancements (antiSpin, streakMode, budgetCapUsd)

Three new options on `Ρ`, all defaulting to off for zero behavior change:

```ts
interface RalphOptions extends PatternOptions {
  // existing...
  /** Strengthen no-progress detection: flag consecutive identical reviews
   *  (>80% text similarity), approach flip-flops between two patterns,
   *  and silent iterations. Stops early instead of burning through maxIterations. */
  antiSpin?: boolean
  /** Require N consecutive "DONE" reviews before stopping. One green run =
   *  luck; N = reliability. Default 1 (current behavior). Article recommends 3-10. */
  streakMode?: number
  /** Stop when cumulative cost exceeds this USD amount. Reads from trace. */
  budgetCapUsd?: number
}
```

Anti-spin logic (~150 lines in `ralph.ts`):
- After each review, compare text against previous iteration's review (similarity > 0.8 = no-progress)
- Track the last 3 review verdicts; if pattern matches [DONE→ITERATE→DONE→ITERATE], that's flip-flop → stop
- When anti-spin fires, append the reason to `RalphOutput.terminationReason`

Streak mode logic (~40 lines):
- Instead of `review.includes('DONE')` → stop, require streak N consecutive DONE
- Counter resets on any ITERATE

Budget cap (~30 lines):
- Before each iteration, sum `output.trace` costs
- If exceeded, stop with `RalphOutput.terminationReason = 'budget exceeded'`

**Part 1 risk:** Very low. All reads from existing infrastructure, adds to existing single file.

### Part 2: New `goal` tag (English-named — no Greek letter assignment yet; `Γ` is already Graph)

A contract-first pattern with a separate verifier model:

```ts
import { goal } from '@topce/pizx'

await goal({
  verifierModel: 'deepseek/deepseek-v4-pro',  // DIFFERENT model from worker
  workerModel: 'deepseek/deepseek-v4-flash',
  maxIterations: 5,
  budgetCapUsd: 5.00,
  antiSpin: true,
  streakMode: 3,
})`add error handling to the Fleet pattern`
```

Flow:
```
π writes formal contract ──→ Π executes against contract ──→ Π (verifier model) checks outcome
        ↑                                                             │
        └── contract violations feed back ── still not done ── 

Contract sections (LLM-generated):
1. Exact end state (verifiable conditions, not subjective)
2. Verification criteria (checklist an independent reviewer can run)
3. What NOT to touch (boundaries)
4. Stop conditions (max iterations, budget, anti-spin clauses)
```

**Files to create:**
- `src/patterns/goal.ts` (~250 lines, follows createPatternTag factory pattern; exports `goal` tag)
- `src/patterns/goal.test.ts` (unit tests, ~150 lines)
- `docs/goal.md` (docs page, follows existing pattern doc format)
- `examples/pattern-goal.mjs` (runnable example)

**Types:**
- `GoalOptions extends PatternOptions` (verifierModel, maxIterations, budgetCapUsd, antiSpin, streakMode)
- `GoalOutput extends PatternOutput` (iterations, passed, terminationReason, contract)

**Add to existing `RalphOutput`:**
- `terminationReason?: string` — populated when anti-spin or budget cap stops the loop early

**Key design decisions:**
- Worker model does the work (default: `workerModel` or `model`)
- Verifier model checks it (default: `verifierModel` or `plannerModel` or `model`)
- If verifierModel === workerModel (same model), emit a warning but still work — not an error
- Contract is generated on first call and cached for all verification passes
- Pattern composition: Goal can contain `Π` (coding agent) execution, making it a proper `/goal` equivalent

---

## Key Assumptions to Validate

- [ ] **Different model families catch different bugs.** Run 10 pizx example tasks through Claude + DeepSeek independently. Count unique issues found per model. If <20% unique findings, cross-model verification adds cost without benefit. *How to test:* Batch analysis script.
- [ ] **Users will set budget caps.** The articles show Uber capped at $1,500/person. Do pizx users care? Ship budgetCapUsd on Ralph first as a no-risk trial balloon. Measure if anyone sets it. *How to test:* GitHub issue/feedback if someone burns money without a cap.
- [ ] **Anti-spin similarity at 80% is the right threshold.** Too strict → stops early on legitimate refinements. Too loose → doesn't catch real spins. Start at 0.8, make configurable if feedback demands it. *How to test:* Log anti-spin stops in the first month; review whether they were correct.
- [ ] **Streak mode default of 3 is pragmatic.** Article says 10 for production error sweep, 1 for quick dev. 3 as default hits the middle. *How to test:* Ship with 1 (no change), let users opt in to higher values.

## MVP Scope

**Ships:**
- `antiSpin`, `streakMode`, `budgetCapUsd` on `Ρ` (Ralph) — ~220 lines, no new files
- New `goal` tag — `contract → execute → verify → repeat` with separate verifier model
- `GoalOutput` with terminationReason and contract text
- Unit tests for anti-spin logic, budget cap, streak counter
- `docs/goal.md`
- `examples/pattern-goal.mjs`
- Export `goal` from `src/index.ts` alongside existing tags

**Out of scope (V2):**
- Pause/resume on Goal
- `/schedule` cloud routine tag
- Durable state / crash recovery
- Make anti-spin/flip-flop configurable thresholds user-facing (V1 hardcodes 80%)

## Not Doing (and Why)

- **`/schedule` / cloud routines** — Requires persistent processes and cron infrastructure pizx doesn't have. The article describes this as stage 5 of loop evolution. Stage 4 (Goal tag) is this cycle.
- **Git-backed state / crash recovery** — Requires durable storage abstraction. No pizx pattern has this today. Risk of scope creep is high.
- **Pause/resume on Goal** — Codex CLI has set/pause/resume/clear. Valuable but requires state serialization that touches every pattern's execution model. Separate initiative.
- **Greek letter for Goal** — `Γ` is Graph, `Σ` is Subagents. Goal uses the English name `goal` as its primary tag name (consistent with `ralph`, `fleet` etc. English aliases).
- **Refactoring Ralph's review system** — The existing REVIEW_SYSTEM prompt works. antiSpin augments the logic around it, doesn't replace it. Don't break what works.

## Open Questions

- **Should `antiSpin: true` be the default on Ralph?** Current default for maxIterations is 5. antiSpin off means the agent burns all 5 iterations even if spinning. On means it stops early. Tradeoff: early stop might miss a breakthrough. Recommendation: default to ON — users can opt out with `antiSpin: false`.
- **What's the verifier model default when none is specified?** Goal needs a verifier model. If the user doesn't set `verifierModel`, fall back to `plannerModel` → `model` → same as worker? Or require it explicitly? Recommendation: fall back to plannerModel → model, with a stderr info line: "goal: No verifierModel specified — using {resolvedModel} for both work and verification."
- **Should Goal reuse Ralph's REVIEW_SYSTEM or have its own goal-specific verifier prompt?** The goal verifier checks against a contract, not a plan. Different prompt needed. Design a `GOAL_VERIFY_SYSTEM` prompt that evaluates output against contract clauses (`✅ PASS / ❌ FAIL / ⚠️ PARTIAL`). See `pattern-workflow-goal-contract.mjs` for a working prototype of this prompt shape.
- **CC-BY or similar attribution for the article inspiration?** The examples/README should cite "WTF Is a Loop? Parts 1 & 2 — Matt Van Horn, June 2026" as the conceptual source. No code dependencies, just acknowledgment.
