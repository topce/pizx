# Changelog

All notable changes to pizx are documented here.

## [1.3.0] — 2026-08-31

Agent-friendliness pass: machine-readable CLI output, distinct exit codes, and
first-class docs/types for AI agents writing pizx code. Backward compatible.

### Added

- **`--json` output** — `-p`, `--acp`, and `--letters` emit a single JSON
  object/array on stdout (streaming suppressed). Result envelope:
  `{ text, modelId, fromCache, durationMs, tokens { input, output, cacheRead,
  cacheWrite, total }, costUsd }`; `--letters --json` emits the letter registry
  (`[{ name, aliases, cacheable, description }]`); failures print
  `{ error: { code, message } }` on stderr. Exported serializers
  `resultToJson` / `errorToJson` / `lettersToJson`. `--json` implies `--quiet`
  and `--no-color`.
- **Distinct process exit codes** — keyed by `PizxError.code` via `exitCodeFor`:
  `0` ok, `1` unknown/foreign, `2` `VALIDATION`, `3` `AUTH`, `4` `AGENT`,
  `5` `ACP`, `6` `CANCELLED`, `7` `INTERNAL`.
- **stdin prompts** — `pizx -p -` (or an empty prompt on a pipe) reads the
  prompt from stdin, so agents can avoid shell-escaping large prompts.
- **`--no-color`** — disable ANSI color for clean machine output; also honors
  the `NO_COLOR` environment variable.
- **Typed globals** — a `declare global` block in `@topce/pizx/globals` types
  `π`/`Π`/`α` and their aliases as `LetterFn<…>`; script authors opt in with
  `/// <reference types="@topce/pizx/globals" />`.
- **`Schema` re-export** — `import { Schema } from '@topce/pizx'` (re-exported
  schemastery), so letter plugins need one fewer dependency.
- **Agent-facing docs** — `AGENTS.md` (canonical authoring guide: script
  template, letters and ASCII aliases, `LetterOutput`, options, the CLI
  `--json`/exit-code contract, and a global-install plugin-dev note) and
  `llms.txt` (llmstxt.org index), both now shipped in the npm package.
- **`examples/typed-globals.mjs`** — demonstrates the typed globals and the
  reference directive.

### Changed

- **Consistent, actionable credential errors** — `Llm.ask()` and
  `agentSession()` now throw `PizxError('AUTH', '… Run \`pi auth login\`
  first.')` instead of a plain `Error`, so missing credentials map to exit
  code `3` and serialize under `--json`.
- CLI usage errors (missing prompt, missing `--acp-server`) now throw
  `PizxError('VALIDATION', …)` — exit code `2` and `--json`-serializable —
  instead of an ad-hoc message with exit `1`.
- `--help` documents the new flags (`--json`, `--no-color`, stdin) and lists the
  exit codes; the README CLI section and `docs/extension.md` cover the new
  surface and the global-install plugin workflow.

## [1.2.0] — 2026-08-30

API/interface hardening pass (see `docs/api-audit.md`).

### Fixed

- **Named-import options are no longer dropped (C1)** — `forwardTag` re-applies
  chained options to the resolved target letter, so
  `import { π } from '@topce/pizx'; π({ model: '…' })` now forwards `model` (and
  `.stream` forwards base options too). Previously every option silently no-oped
  for library consumers; CLI/globals mode was unaffected.
- **Structured error contract (H1)** — introduced `PizxError` with a stable
  machine-readable `code` (`VALIDATION | AUTH | AGENT | ACP | CANCELLED |
  INTERNAL`) and `isPizxError`. π/Π/α and the ACP client now throw `PizxError`
  and re-wrap only foreign errors via `instanceof`, instead of matching message
  prefixes. The dead `wrapLetterError` helper was removed.
- **Session-pool key (H3)** — the Π session key now includes `thinkingLevel`, so
  a second call with a different thinking level no longer silently reuses the
  wrong session.
- **Confirm gate validated at the boundary (M1)** — `confirm` is now a strict
  schema (`confirmGateSchema`) that rejects `{ hitl: false }`, extra keys, and
  garbage; `resolveMode` now tests key truthiness (`{ hitl: false }` → `auto`).
- **ACP file-system sandboxing (M2)** — agent-requested `fs/read_text_file` /
  `fs/write_text_file` paths are constrained to the session `cwd`, and
  `line`/`limit` are clamped.
- **Config, trace, and skill-loader fixes (L2, L7, L8)** — `app.config` now
  matches the normalized `ctx.config`; trace `exportLog` caches invalidate when
  new events are recorded; `loadSkillContent` warns on unreadable (non-ENOENT)
  skills as its docs promised.

### Added

- Exported `PizxError`, `isPizxError`, `PizxErrorCode`, `LlmCallOptions`,
  `confirmGateSchema`, and the `PiOpts` / `AgentOpts` / `AlphaOpts` option types.
- `Pizx.letter()` / `Pizx.define()` are generic, and `app.π` / `app.Π` /
  `app.α` are typed with their option schemas (L3).
- Restored the 0.4.0 public API accidentally dropped in 1.0: `loadSkillContent`,
  `loadSkillContents`, `SKILL_PATHS`, and `resolveConfigValue` (M3).
- The π/Π/α alias list is now re-exported from one source; `pizx/globals` also
  re-exports `configureDefaultApp` / `disposeDefaultApp` (L5).

### Changed

- `LetterOutput.modelId` is the canonical model field; `modelUsed` remains as a
  deprecated alias. `LetterOutput.isFromCache` is canonical; `fromCache` remains
  as a deprecated alias. `trace` / `turnCount` are now read-only accessors (L1,
  M4, L4).
- `LetterDefinition.cacheable` (default `true`) is the canonical flag;
  `cache: false` remains as a deprecated alias (L6).

### Removed

- **`maxTurns` (H2)** — the Π option was documented but had no effect (the
  pi-coding-agent SDK exposes no turn cap). It was removed from the Π schema and
  the session pool, and no longer appears in `docs/capital-pi.md` or the
  examples.

## [1.1.0] — 2026-08-29

### Added

- **α letter (any ACP agent)** — a new built-in letter (aliases `acp`,
  `agent`) that drives any ACP v1 compatible coding agent through the
  official `@agentclientprotocol/sdk`: `await α({ server: ['kiro-cli',
  'acp'] })`…``. `server` is a required command array — no default, no pi
  involvement; π/Π are untouched. Auto-approved tool permissions,
  `.stream` support, and honest client-side file-system handlers
  ([docs/acp.md](docs/acp.md)).
- **ACP tracing** — `tool-call` trace events per agent tool-call progress
  update, plus an `llm-call` event when the agent reports token usage, all
  under the α span.
- **CLI additions** — `--acp <prompt>` quick-ask with `--acp-server <line>`
  (e.g. `pizx --acp --acp-server "kiro-cli acp" "fix the bugs"`).
- **Offline mock ACP server** — `src/testing/acp-mock-server.mjs` fixtures
  the agent side of the protocol so the client is tested without network or
  real agent CLIs.

## [1.0.0] — 2026-08-23

### Breaking

- **Cordis rewrite** — the core is rebuilt on `@cordisjs/core`: services
  (`trace`, `cache`, `llm`, `letters`), plugin composition, and effect-based
  cleanup replace the old module-global architecture.
- **Patterns removed from core** — the 16 hardcoded pattern tags (Ρ Φ Σ Δ Λ Ψ
  Ω Θ Μ Β Α Γ Ν Χ Τ + `goal`) are gone; letters are now user plugins
  (see `examples/plugins/ralph.mjs`). Old code remains on the 0.9 branch.
- **π/Π are letters** — same mechanism as user letters: schemastery-validated
  options, span tracing, and a shared session pool for Π.
- `configurePi`/`configureAgent`/`closeAgent` replaced by app-scoped config
  (`createPizx({...})`, `app.dispose()`).

### Added

- **User-defined letters** — `ctx.letters.define()` + `pizx.config.mjs`
  plugin composition; every letter gets option chaining, `.quiet`/`.cache`
  variants, streaming, tracing, and caching for free
  ([docs/extension.md](docs/extension.md)).
- **Tracing & log export** — span-based run tracing with disjoint
  input/output/cache token accounting, JSONL/JSON export, `--trace` summary,
  `--export-log` (flushed even when the script crashes)
  ([docs/trace.md](docs/trace.md)).
- **Local result cache** — content-addressed cache for side-effect-free
  letters (per call, app-wide, `--cache`), TTL + LRU eviction, `cache-hit`
  trace events.
- **CLI additions** — `--trace`, `--export-log [path]`, `--cache/--no-cache`,
  `--config <file>`, `--letters`.
- **Options validation** — schemastery schemas on π/Π and user letters with
  boundary validation and type inference.

### Fixed

- **d.ts emission** — `tsconfig.build.json` now overrides `noEmit`, so type
  declarations are actually published.

## [0.9.3] — 2026-07-11

### Changed

- **Dependency update** — `@earendil-works/pi-ai` and `@earendil-works/pi-coding-agent` bumped to v0.80.6, `@biomejs/biome` to v2.5.3, `@types/node` to v26.1.1, `eslint` to v10.7.0, `typescript-eslint` to v8.63.0, `vitest` to v4.1.10, `@vitest/coverage-v8` to v4.1.10.

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

[1.3.0]: https://github.com/topce/pizx/releases/tag/v1.3.0
[1.2.0]: https://github.com/topce/pizx/releases/tag/v1.2.0
[1.1.0]: https://github.com/topce/pizx/releases/tag/v1.1.0
[1.0.0]: https://github.com/topce/pizx/releases/tag/v1.0.0
[0.9.3]: https://github.com/topce/pizx/releases/tag/v0.9.3
[0.9.2]: https://github.com/topce/pizx/releases/tag/v0.9.2
[0.9.1]: https://github.com/topce/pizx/releases/tag/v0.9.1
[0.9.0]: https://github.com/topce/pizx/releases/tag/v0.9.0
[0.8.0]: https://github.com/topce/pizx/releases/tag/v0.8.0
[0.7.0]: https://github.com/topce/pizx/releases/tag/v0.7.0
[0.6.1]: https://github.com/topce/pizx/releases/tag/v0.6.1
[0.6.0]: https://github.com/topce/pizx/releases/tag/v0.6.0
[0.5.0]: https://github.com/topce/pizx/releases/tag/v0.5.0
[0.4.0]: https://github.com/topce/pizx/releases/tag/v0.4.0
[0.3.0]: https://github.com/topce/pizx/releases/tag/v0.3.0
[0.1.0]: https://github.com/topce/pizx/releases/tag/v0.1.0
