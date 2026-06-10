# Changelog

All notable changes to pizx are documented here.


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

[0.3.0]: https://github.com/topce/pizx/releases/tag/v0.3.0
[0.1.0]: https://github.com/topce/pizx/releases/tag/v0.1.0
