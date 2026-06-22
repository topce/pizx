# goal — Contract-First Execution with Separate Verifier

A contract-first execution pattern that uses a SEPARATE verifier model to check work against a contract written BEFORE execution starts. Inspired by the "WTF Is a Loop?" articles (Matt Van Horn, June 2026).

## Usage

```js
import { goal } from '@topce/pizx'

await goal`add error handling to the Fleet pattern`
await goal({
  verifierModel: 'deepseek/deepseek-v4-pro',
  workerModel: 'deepseek/deepseek-v4-flash',
  maxIterations: 5,
  budgetCapUsd: 5.00,
  antiSpin: true,
  streakMode: 3,
})`implement the feature with full test coverage`
await goal.quiet`refactor the auth module`
```

## Flow

```
π writes formal contract ──→ Π executes against contract ──→ π (verifier model) checks outcome
        ↑                                                             │
        └── contract violations feed back ── still not done ── 
```

1. **Contract writing** — The verifier model writes a formal contract defining exactly what "done" means (end state, verification criteria, boundaries, stop conditions). Written once and cached for all iterations.
2. **Execution** — The worker model executes the task against the contract.
3. **Verification** — The verifier model (separate from the worker) checks the output against the contract's criteria. Each clause gets `✅ PASS`, `❌ FAIL`, or `⚠️ PARTIAL`.
4. **Repeat or stop** — If verification finds failures, feedback goes back to the worker. Stops when the contract is satisfied (ALL_PASS), anti-spin fires, the budget is exceeded, or max iterations are reached.

## Options

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `verifierModel` | string | `plannerModel` or `model` | Model for contract writing and verification. Defaults to the planner model. |
| `maxIterations` | number | `5` | Maximum execution+verify cycles before stopping. |
| `budgetCapUsd` | number | — | Stop when estimated cumulative cost exceeds this amount. |
| `antiSpin` | boolean | `true` | Detect no-progress (>80% verification overlap) and flip-flop patterns. |
| `streakMode` | number | `1` | Require N consecutive `ALL_PASS` verdicts before stopping. |

All standard pattern options (`model`, `plannerModel`, `workerModel`, `quiet`, `maxTokens`, `thinkingLevel`, `system`, `timeoutMs`, `maxRetries`, `skills`, `confirm`, `apiKey`) are also supported.

## Output

```js
const result = await goal({ maxIterations: 3 })`implement feature X`
```

| Property | Type | Description |
|----------|------|-------------|
| `result.passed` | boolean | Whether the contract was fully satisfied |
| `result.contract` | string | The formal contract text |
| `result.iterationCount` | number | Number of iterations executed |
| `result.iterations` | GoalIterationSummary[] | Per-iteration results with verdict |
| `result.terminationReason` | string? | Why it stopped early (anti-spin, budget), if applicable |
| `result.trace` | CallTrace[] | Per-LLM-call token usage and cost |
| `result.totalCost` | number | Total cost in USD |

## Why a separate verifier model?

A single model used for both building and reviewing shares its own blind spots. The verifier model should be a DIFFERENT model family from the worker. This is the Clodex pattern from the article: "two different model families have to agree before code lands."

If you don't set `verifierModel`, a warning is printed to stderr:
```
goal: No verifierModel specified — using deepseek/deepseek-v4-pro for both work and verification.
```

## Anti-Spin & Streak Mode

**Anti-spin** (enabled by default) detects two failure modes:
- **No-progress:** Two consecutive verifications with >80% text similarity — the agent is producing the same non-passing output. Stops early.
- **Flip-flop:** Alternating PASS/FAIL pattern across 4 reviews — the agent oscillates between two approaches. Stops early.

**Streak mode** requires N consecutive ALL_PASS verdicts before declaring success. One green run is luck; N consecutive is reliability. Set `streakMode: 3` for moderate confidence, `streakMode: 10` for production-critical work.

## Budget Cap

Each iteration is estimated at ~$0.06 (execute + verify calls). Set `budgetCapUsd` to prevent runaway costs. When the estimated cost exceeds the cap, execution stops with `terminationReason: 'budget exceeded'`.

> **Note:** Budget tracking uses a conservative per-iteration estimate. Exact per-call costs are available in `result.trace` after execution completes.

## Contract Structure

The auto-generated contract contains:

1. **Exact End State** — Verifiable "done" conditions (not subjective)
2. **Verification Criteria** — How to prove each condition is satisfied
3. **What NOT to Touch** — Boundaries and off-limits areas
4. **Stop Conditions** — Iteration cap, budget, anti-spin clauses

## Related

- [Ralph Loop (Ρ)](ralph.md) — Iterative self-correcting loop (same model self-review)
- [Critique (Ψ)](critique.md) — Generate → critique → improve (same model)
- `examples/pattern-workflow-goal-contract.mjs` — Manual composition example
- `examples/pattern-workflow-build-test-fix.mjs` — Builder-verifier pair composition
- `examples/pattern-workflow-adversarial-cross-model.mjs` — Cross-model verification

## Source

Inspired by "WTF Is a Loop? Parts 1 & 2" — Matt Van Horn, June 2026 (3.6M+ reads). The `/goal` command as described in Claude Code v2.1.139 and Codex CLI v0.128.0.
