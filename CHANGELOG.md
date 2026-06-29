# Changelog

All notable changes to pizx are documented here.

## [0.9.2] — 2025-06-29

### Added

- **Loop engineering example** — `examples/pattern-loop-engineering.mjs` demonstrating iterative improvement on generated outputs with custom evaluation. Available via `npm run example:loop-engineering`.

### Changed

- **Dependency update** — `@earendil-works/pi-ai` and `@earendil-works/pi-coding-agent` updated to v0.80.2, bringing `ModelRegistry`-based model picking, `streamSimple`/`completeSimple` compat API, and fresh auth resolution.

### Fixed

- **Type-safe event stream wrapping** — `model-picker.ts` uses properly typed `AssistantMessageEvent` instead of `any` for stream iterator types and constructs valid `AssistantMessage` on auth errors.
- **Simplified error handling in π** — `pi.ts` uses discriminated union narrowing for `error` and `done` events instead of unsafe `any` casts.
- **Type annotations in core.test.ts** — explicit `unknown[]` parameter types for `mock.calls.filter` callbacks.

## [0.9.1] — 2025-06-22

### Fixed

- **Budget cap uses real API costs** — `budgetCapUsd` now reads actual trace costs via `getCurrentCost()` instead of `iteration * 0.06` estimate. Exact per-call costs from the LLM provider are summed mid-execution.
- **Shared anti-spin utilities** — `textSimilarity` and `checkAntiSpin` extracted to `src/patterns/utils.ts`, eliminating 50+ lines of duplicated code between Ralph and Goal.

### Added

- **Goal budget cap test** — test parity with Ralph for `budgetCapUsd`.
- **Updated social banner** — GitHub banner now reflects v0.9.0/0.9.1 features.

## [0.9.0] — 2025-06-22

### Added

- **Goal tag (`goal` / `γ`)** — Contract-first execution with separate verifier model. Writes a formal contract before execution, then verifies with a different model family. Implements the Clodex pattern from "WTF Is a Loop?" (Matt Van Horn, June 2026). Options: `verifierModel`, `maxIterations`, `budgetCapUsd`, `antiSpin`, `streakMode`.
- **Ralph (Ρ) anti-spin detection** — `antiSpin` option (default: `true`) detects no-progress (>80% review overlap) and flip-flop (alternating ITERATE/DONE) patterns, stopping early instead of burning through all `maxIterations`.
- **Ralph (Ρ) streak mode** — `streakMode` option (default: `1`) requires N consecutive DONE reviews before stopping. One green run is luck; N is reliability.
- **Ralph (Ρ) budget cap** — `budgetCapUsd` option stops execution when estimated cumulative cost exceeds the cap.
- **`RalphOutput.terminationReason`** — populated when anti-spin or budget cap stops the loop early.
- **γ (lowercase gamma)** — Greek letter alias for `goal` tag; distinct from `Γ` (uppercase gamma = Graph).
- **Docs**: `docs/goal.md` — full reference for the goal tag. `docs/ralph.md` — updated with anti-spin/streak/budget sections.
- **Examples**: 5 new composed workflow examples + 2 English alias examples demonstrating all new features on pizx itself (dogfooding).

### Changed

- `RalphOutput` constructor signature: added optional `terminationReason` parameter after `iterations`.

## [0.8.0] — 2025-06-16

### Added

- **ESLint** alongside Biome — `typescript-eslint` with type-checked rules for deeper TypeScript linting. Biome continues handling formatting and fast lint rules.
- New `lint:biome` and `lint:eslint` scripts; `lint` now runs both.

### Changed

- Fixed type safety across 12 source files: removed unused imports, added `cause` to rethrown errors, replaced `Model<any>` with `Model<Api>`, added proper `JSON.parse` typing.
- README: added npm version badge, improved tag alias table with `ai`/`codingAgent` disambiguation note.

## [0.7.0] — 2025-06-15

### Added

- **Execution Modes (hitl / semi / auto)** — `confirm` option extended from `boolean` to `boolean | ConfirmGate` with three autonomy levels:
  - `{ hitl: true }` — Human-In-The-Loop: gates before EVERY phase, human approves each step
  - `{ semi: true }` — Semi-autonomous: gates at major decision points (same as `confirm: true`)
  - `{ auto: true }` — Fully autonomous: no gates (same as `confirm: false`, default)
  - `confirm: boolean` remains fully backward-compatible
- **New helpers**: `resolveMode()` and `shouldGate()` — pure functions for mode resolution and gating decisions
- **New `ConfirmGate` type** — exported from `@topce/pizx` for TypeScript consumers
- **Gate support added to 3 new patterns**: `Ρ` (Ralph Loop), `Δ` (Debate), `Ψ` (Critique)
  - Total: 7 patterns with gates (was 4: `Ω`, `Σ`, `Φ`, `Λ` plus `π`, `Π`)
- **Examples**: `examples/pattern-execution-modes.mjs` and `english-examples/execution-modes.mjs` — full demo of all 9 tags × 3 modes with `MODE`/`WHICH` env var filtering
- **README**: Updated Human-in-the-Loop section with per-pattern gate behavior table
- **Example READMEs**: `examples/README.md` and `english-examples/README.md` — comprehensive indexes

### Changed

- `confirmPhase()` signature updated — now accepts `phase` and `isMajorPhase` parameters
- Error messages include phase name on cancellation (e.g., `at phase 'dispatch'`)
- Prompt label shows phase name (e.g., `── Confirm (plan) ──`)

## [0.6.1] — 2025-06-14

### Fixed

- README: Added GitHub profile link for Mario Zechner in Credits section.

## [0.6.0] — 2025-06-13

### Added

- **Agent Mode for All Patterns** — New `mode: 'text' | 'agent'` option on all 15 pattern tags.
  - In `'text'` mode (default), patterns use text generation via `ask()`.
  - In `'agent'` mode, patterns use the Pi coding agent with tools (`read`, `bash`, `edit`, `write`, `grep`, `ls`).
  - Controlled by the shared `executeTask()` / `runAgentTask()` helpers in `src/patterns/types.ts`.
- **`maxAgentTurns` option** — Limits agent iterations when `mode: 'agent'` (default: 10).
- **README** — New "Agent Mode" section documenting the feature across all patterns.
- **English example updated** — `english-fleet.mjs` now uses `mode: 'agent'` with full output display.

### Changed

- All 15 pattern implementations (`Ρ`, `Φ`, `Σ`, `Δ`, `Λ`, `Ψ`, `Ω`, `Θ`, `Μ`, `Β`, `Α`, `Γ`, `Ν`, `Χ`, `Τ`) now use `executeTask()` instead of `ask()` for core LLM calls, enabling transparent agent mode.

## [0.5.0] — 2025-06-13

### Added

- **English Word Aliases** — All 15 pattern tags now have English word alternatives alongside their Greek letter counterparts:
  - `π` → `pi`, `Π` → `Pi` (core tags)
  - `Ρ` → `ralph`, `Φ` → `fleet`, `Σ` → `subagent`, `Δ` → `debate`, `Λ` → `pipeline`, `Ψ` → `critique`, `Ω` → `orchestrator`, `Ν` → `team` (agent patterns)
  - `Θ` → `thread`, `Μ` → `memory`, `Β` → `broadcast` (communication patterns)
  - `Α` → `adaptive`, `Γ` → `graph`, `Χ` → `learn`, `Τ` → `store` (orchestration topologies)
- Aliases available everywhere Greek letters work: named imports, shebang globals, and `pizx/globals`
- **English Examples** — 6 new example scripts in `english-examples/` demonstrating all aliases

## [0.4.0] — 2025-06-10

### Added

- **System Prompt Overrides** — `system` and `appendSystemPrompt` options on `π`, `Π`, and all 15 pattern tags. `Π` wires through `DefaultResourceLoader` for native agent support.
- **Thinking Budgets** — `thinkingBudgets: { medium: 20480, high: 65536 }` option on all tags. Propagates through `SimpleStreamOptions` for `π`/`ask()`. Settable globally via `configurePi()`.
- **Skill Integration** — `loadSkillContent()` and `loadSkillContents()` from `src/skill-loader.ts` find and read Pi agent skills from disk (same paths as `skill.sh`). `Π` and pattern tags accept `skills: ['skill-name']` to auto-inject via resource loader or system context.
- **New Public API** — `loadSkillContent`, `loadSkillContents`, and `SKILL_PATHS` exported from `@topce/pizx`.

### Fixed

- CLI help and `globals.ts` now include `Ν` (Nu), `Χ` (Chi), `Τ` (Tau).

## [0.3.0] — 2025-06-10

### Added

- **15 Agent Pattern Tags** — Complete DSL for AI agent orchestration:
  - Agent patterns: `Ρ` (Ralph Loop), `Φ` (Fleet), `Σ` (Subagents), `Δ` (Debate), `Λ` (Pipeline), `Ψ` (Critique), `Ω` (Orchestrator)
  - Communication patterns: `Θ` (Thread), `Μ` (Memory), `Β` (Broadcast)
  - Orchestration topologies: `Α` (Adaptive), `Γ` (Graph), `Ν` (Nu — Self-Organizing Teams), `Χ` (Chi — Cross-Agent Learning), `Τ` (Tau — Tool-Mediated Orchestration)
- **Quality Validation** — All 15 patterns support `qualityCheck: true` for post-execution LLM review with score, assessment, and recommendation. Powered by shared `runQualityReview` helper.
- **Human-in-the-Loop Confirm Gates** — `Ω`, `Σ`, `Φ`, `Λ` support `confirm: true` to pause before execution and ask for user approval.
- **Phase Logging** — Every pattern output includes a structured `phaseLog` array recording what happened, duration, and which model ran each phase.
- **Pattern Composition** — `Φ` (Fleet) and `Λ` (Pipeline) accept `TaskDescriptor` — either a plain string or a function returning another pattern — enabling nested pattern composition.
- **System Prompt Propagation** — All patterns respect the `system` option via `mergeSystem`, prepending user context to the pattern's default system prompt.
- **Per-Phase Model Selection** — `plannerModel` and `workerModel` options on all patterns for routing high-level reasoning vs execution to different models.
- **Option Chaining & Quiet Mode** — All tags support `({ options })` syntax and `.quiet` to suppress streaming output.
- **Timeout & Retry** — All tags accept `timeoutMs` and `maxRetries` for LLM call resilience.
- **Token, Cost & Call Tracing** — Every pattern output and `π` call includes an execution trace with per-call token/cost/duration breakdown and aggregates.
- **Global Configuration** — `configurePi()` and `configureAgent()` for setting defaults across all tags.
- **`globals()` support** — `pizx/globals` module injects all tags into `globalThis` for script mode.
- **`skill.sh`** — Shell helper for loading agent skills as system context.

### Documentation

- **Onboarding Guide** — `docs/onboarding.md`: comprehensive getting-started guide for new users.
- **Advanced Features Guide** — `docs/advanced-features.md`: covers qualityCheck, confirm gates, phase logging, pattern composition, per-phase models, option chaining, timeout/retry, and cost tracking.
- **Pattern Documentation** — Dedicated markdown docs for all 15 patterns in `docs/`.
- **Architecture Decision Records** — 7 ADRs covering template-tag DSL (#1), shared factory (#2), quality validation (#3), phase logging (#4), pattern composition (#5), confirm gates (#6), and system propagation (#7) in `docs/decisions/`.
- **README** — Updated with complete tag reference, architecture overview, CLI reference, and all npm scripts.

### Examples

- 19 runnable pattern example scripts in `examples/` covering every tag.
- 4 feature demo scripts: `test-quality.mjs`, `test-confirm.mjs`, `test-composition-fleet.mjs`, `test-composition-pipeline.mjs`.
- Comprehensive end-to-end scripts (`ralph-loop.mjs`, `new-features.mjs`, `five-whys.mjs`).

### Testing

- **223 unit tests** across 3 test files with mocked `pi`/`Pi` SDK.
- **Model picker tests** covering all supported providers and auth strategies.
- **Integration tests** via `npm run test:integration` requiring Pi credentials.

## [0.1.0] — 2025-06-07

### Added

- Initial release: zx fork with basic `π` (pi-ai) and `Π` (pi-coding-agent) integration.
- CLI script runner with `pizx <script>`, `pizx -p <prompt>`, `--version`, `--help`.
- `pizx/globals` module for script mode.
- Build pipeline with esbuild + TypeScript declarations.

[0.6.1]: https://github.com/topce/pizx/releases/tag/v0.6.1
[0.6.0]: https://github.com/topce/pizx/releases/tag/v0.6.0
[0.5.0]: https://github.com/topce/pizx/releases/tag/v0.5.0
[0.4.0]: https://github.com/topce/pizx/releases/tag/v0.4.0
[0.3.0]: https://github.com/topce/pizx/releases/tag/v0.3.0
[0.1.0]: https://github.com/topce/pizx/releases/tag/v0.1.0
