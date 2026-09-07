/**
 * pizx — a zx fork with native Pi AI integration, built on cordis.
 *
 *   #!/usr/bin/env pizx
 *   const answer = await π`what is the capital of France?`
 *   await Π`fix the TypeScript errors in src/`
 *
 * π (small pi) and Π (capital pi) are the built-in letters. Any plugin —
 * yours included — can define more letters; they show up here and in
 * pizx/globals automatically. Every invocation is traced; export the run
 * with exportLog() / --export-log, and make repeated calls cheap with
 * cache: true / --cache.
 *
 * @example
 * ```js
 * import { createPizx } from '@topce/pizx'
 *
 * const app = await createPizx({ cache: true })
 * const answer = await app.π`what is 7! + 5?`
 * console.log(answer.text, answer.isFromCache)
 * console.log(app.traceSummary())
 * await app.dispose()
 * ```
 */

// ── schemastery ──────────────────────────────────────────────────────────────
// Re-exported so plugin authors can `import { Schema } from '@topce/pizx'`
// instead of adding a separate `schemastery` dependency for letter option schemas.
export { default as Schema } from 'schemastery'
// ── Re-export all of zx ─────────────────────────────────────────────────────
// All standard zx APIs pass through unchanged.
export * from 'zx'
// ── ACP client (α) ───────────────────────────────────────────────────────────
export {
  type AcpRunOptions,
  type AcpRunResult,
  type AcpToolEvent,
  type AcpUsage,
  runAcpPrompt,
  streamAcpPrompt,
} from './core/acp-client.ts'
// ── Core services ───────────────────────────────────────────────────────────
export {
  Cache,
  type CacheConfig,
  type CacheKeyInput,
  pickCacheRelevantOpts,
} from './core/cache.ts'
// ── Application ─────────────────────────────────────────────────────────────
export { createPizx, type Pizx, type PizxConfig } from './core/context.ts'
// ── Built-in letters (default app) ──────────────────────────────────────────
// The π/Π/α names and their English aliases live in one place (default-app.ts)
// and are re-exported wholesale from both entry points.
export * from './core/default-app.ts'
// ── Structured errors ────────────────────────────────────────────────────────
export { isPizxError, PizxError, type PizxErrorCode } from './core/errors.ts'
// ── Harness registry (ε) ─────────────────────────────────────────────────────
export { Harnesses, type HarnessSpec, type RegisteredHarness } from './core/harnesses.ts'
export { Letters, type RegisteredLetter } from './core/letters.ts'
export {
  type AskOptions,
  type AskResult,
  Llm,
  type LlmCallOptions,
  type LlmConfig,
  loadPiAuth,
  resolveConfigValue,
} from './core/llm.ts'
// ── Skill loading ────────────────────────────────────────────────────────────
export { loadSkillContent, loadSkillContents, SKILL_PATHS } from './core/skill-loader.ts'
// ── Letter authoring ────────────────────────────────────────────────────────
export {
  createLetterTag,
  type LetterDefinition,
  type LetterEnv,
  type LetterFn,
  LetterOutput,
  LetterPromise,
} from './core/tags.ts'
export {
  type AcpToolCallEvent,
  type CacheEvent,
  type LetterEndEvent,
  type LetterStartEvent,
  type LlmCallEvent,
  type RunEndEvent,
  type RunStartEvent,
  type RunTotals,
  Trace,
  type TraceConfig,
  type TraceErrorEvent,
  type TraceEvent,
  TraceSpan,
} from './core/trace.ts'
// ── Utilities ───────────────────────────────────────────────────────────────
export {
  build,
  type ConfirmGate,
  type ConfirmMode,
  confirmGateSchema,
  confirmPhase,
  getErrorMessage,
  resolveMode,
  shouldGate,
} from './core/utils.ts'
// ── Words (composing letters into AI patterns) ──────────────────────────────
export {
  type LetterRef,
  type LoopResult,
  slotSchema,
  type WordDefinition,
  type WordResult,
  Words,
} from './core/words.ts'
