# pizx Public API Audit

> Audit of the public TypeScript/JS surface of `@topce/pizx` against the
> api-and-interface-design skill principles (Hyrum's Law, One-Version Rule,
> consistent error semantics, boundary validation, additive change, predictable
> naming).
>
> Scope: `src/index.ts`, `src/globals.ts`, `src/core/*`, `src/plugins/*`,
> `src/cli.ts`, `CHANGELOG.md`, shipped `dist/index.d.ts`. Version audited:
> 1.1.0. No code was changed by this audit.

---

## Executive summary

The architecture is sound — cordis services, schemastery-validated letter
options, discriminated trace events, content-addressed caching — but the
surface has **1 critical, 3 high, 5 medium, 7 low** findings.

The critical item (C1) breaks the flagship pattern from the README when using
named imports: `import { π } from '@topce/pizx'; π({ model })`…`` silently
drops every option. It was verified empirically (see evidence below). CLI
script mode and `pizx/globals` are unaffected, which is why the bug survived:
all examples run through the CLI.

The other themes: error handling is magic-string-based instead of a structured
contract, one documented option (`maxTurns`) does nothing, and `confirm`
bypasses the boundary validation the rest of the system does so well.

---

## Critical

### C1 — `forwardTag` drops all chained options (named exports are broken)

- **Location:** `src/core/tags.ts` (`forwardTag`, lines ~321–385),
  `src/core/default-app.ts` (π/Π/α exports)
- **Problem:** `forwardTag.make(base)` uses `base` only for the
  option-chaining branch and the `.quiet`/`.cache` getters. When the returned
  tag is finally invoked with template pieces, it calls the resolved registry
  tag with **no options**:

  ```ts
  // forwardTag — template branch: `base` is never used
  return new LetterPromise((resolve, reject) => {
    getLetter(name).then((tag) => {
      // …
      return tag(pieces as TemplateStringsArray, ...args) // ← base dropped
    })
  })
  ```

  `createLetterTag` (the registry path) does it correctly:

  ```ts
  const rawOpts = { ...base }              // ← base honored
  const opts = def.options ? def.options(rawOpts) : rawOpts
  ```

  `.stream` has the same defect (`streamForward` ignores `base` entirely).

- **Evidence (empirical):**

  ```
  $ node verify-forward.mjs   # stubs llm.pick, uses real dist build
  model passed to llm.pick: [null]
  BUG: chained options silently dropped by forwardTag
  ```

  `π({ model: 'anthropic/test-model' })`…`` resolved the letter with an
  empty options object — the model never reached `llm.pick`.
- **Why it matters:** This is the README's primary library pattern
  (README lines 64–71, `docs/pi.md`, `docs/capital-pi.md`, `docs/acp.md`).
  Every option silently no-ops for library consumers. In CLI/globals mode the
  registry letters are injected directly, so the bug only bites named imports.
- **Suggestion:** Make the forward tag delegate instead of reimplementing:
  on template invocation, resolve the target and call
  `makeBase(tag)(pieces, ...args)`-equivalent — i.e. re-apply `base` on the
  target: `tag({ ...base })(pieces, ...args)`. For `.stream`, the target's
  `.stream` must receive `base` too. Add a regression test asserting
  `fwd({ model: 'x' })`…`` passes `model: 'x'` to the letter's `run()`.
  Better long-term: have `forwardTag` resolve the target once per call and
  wrap it with `createLetterTag`'s `make()` so there is exactly **one** tag
  factory (see One-Version Rule).

---

## High

### H1 — Errors are magic-string prefixes, not a structured contract

- **Location:** `src/plugins/pi.ts:88`, `src/plugins/pi-agent.ts:140`,
  `src/plugins/acp.ts:128`, `src/core/acp-client.ts:107`, `src/cli.ts:282,377`
- **Problem:** All errors are plain `Error` whose message text carries the
  contract; control flow matches on it:

  | Prefix      | Written by               | Matched by                 |
  |-------------|--------------------------|----------------------------|
  | `pizx/π:`   | `plugins/pi.ts`          | `plugins/pi.ts`            |
  | `pizx/Π`    | `plugins/pi-agent.ts`    | `plugins/pi-agent.ts`      |
  | `pizx/α`    | `plugins/acp.ts` + `acp-client.ts` | `acp.ts`, `acp-client.ts` |
  | `pizx:`     | core, cli                | `cli.ts`                   |

  Prefix casing is inconsistent (`pizx/π:` vs `pizx/Π` vs `pizx/α` vs
  `pizx:`). `wrapLetterError()` in `src/core/letters.ts:116` exists to
  centralize exactly this and is **never called** — dead code alongside the
  duplicated hand-rolled wrapping.
- **Why it matters:** Hyrum's Law — the exact prefix strings, spacing, and
  casing become de-facto API. A user catching errors and string-matching, or a
  future refactor of one message, silently breaks the re-wrap guards (e.g.
  changing `pizx/π:` to `pizx/π` would make every π error get double-wrapped).
- **Suggestion:** Introduce a structured error type and use it everywhere:

  ```ts
  export class PizxError extends Error {
    constructor(
      public readonly code: 'VALIDATION' | 'AUTH' | 'AGENT' | 'ACP' | 'CANCELLED' | 'INTERNAL',
      message: string,
      options?: { letter?: string; cause?: unknown },
    ) {
      super(message, { cause: options?.cause })
      this.name = 'PizxError'
    }
  }
  ```

  Replace all `startsWith(...)` guards with `err instanceof PizxError`
  (re-wrap only foreign errors). Wire `wrapLetterError` into the runner in
  `runLetter`/`streamLetter` so user letters get the same treatment, or delete
  it. Keep messages human-readable — the code carries the machine contract
  now, not the prefix.

### H2 — `maxTurns` is a documented option with no effect

- **Location:** `src/plugins/pi-agent.ts:36` (schema, default `10`) and
  `:113` (passed through); `src/core/llm.ts:511` (accepted)
- **Problem:** `Llm.agentSession` accepts `maxTurns` but never reads it — it
  is not in the session-pool key, not passed to `createAgentSession`, not
  used anywhere. `Π({ maxTurns: 1 })` behaves identically to `maxTurns: 10`.
  Documented in `docs/capital-pi.md:14` and used by `examples/hello-pizx.mjs`
  and `examples/basic-capital-pi.mjs`.
- **Suggestion:** Either wire it through to the pi-coding-agent session
  (`createAgentSession`/`AgentSession` options or per-turn enforcement), or
  remove the option and document its removal. If wired, it must also be part
  of the session-pool key (or the pool must go) — see H3.

### H3 — Session-pool key omits behavior-affecting options

- **Location:** `src/core/llm.ts` `agentSession` key (~line 517)
- **Problem:** The key includes `model`, `cwd`, `tools`, `excludeTools`,
  `skills`, `system`, `appendSystemPrompt` — but **not** `thinkingLevel`
  (which IS forwarded to `createAgentSession`). A second Π call with a
  different `thinkingLevel` silently reuses the first session and ignores the
  new value.
- **Suggestion:** Include every option that influences session creation in
  the key (add `thinkingLevel` and, if H2 is fixed, `maxTurns`), or build the
  key from the full opts object so future options can't be forgotten.

---

## Medium

### M1 — `confirm` bypasses boundary validation; `resolveMode` checks key presence, not truth

- **Location:** `src/plugins/pi.ts`, `pi-agent.ts`, `acp.ts` (`confirm:
  Schema.any()`); `src/core/utils.ts:42–48` (`resolveMode`)
- **Problem:**
  1. The precise `ConfirmGate` union exists but the schemas accept `any`, so
     garbage reaches the duck-typing: `{ hit: true }` silently becomes
     `'auto'`.
  2. `resolveMode` tests `'hitl' in confirm`, not `confirm.hitl === true`, so
     `{ hitl: false }` resolves to `'hitl'`. The documented "exactly one key
     must be true" is enforced nowhere.
- **Suggestion:** Encode the gate as a schema:

  ```ts
  confirm: Schema.union([
    Schema.boolean(),
    Schema.object({ hitl: Schema.const(true) }),
    Schema.object({ semi: Schema.const(true) }),
    Schema.object({ auto: Schema.const(true) }),
  ])
  ```

  and fix `resolveMode` to test truthiness (`confirm.hitl === true`). Add a
  test for `{ hitl: false }` → `'auto'`.

### M2 — ACP file-system handlers treat agent input as trusted

- **Location:** `src/core/acp-client.ts` — `handleReadTextFile` (~line 136),
  `handleWriteTextFile` (~line 145), `autoApprove` (~line 127)
- **Problem:** Agent-provided `params.path`, `params.line`, `params.limit`
  flow directly into `readFile`/`writeFile` with no sandboxing, bounds
  checks, or confirmation; `autoApprove` approves every permission request.
  A configured ACP server can read/write arbitrary files as the invoking
  user. (The user does opt into the server, but the client silently grants
  rather than surfacing or gating.)
- **Suggestion:** Validate at the boundary: resolve `params.path` and require
  it to stay under the session `cwd` (or an explicit allowlist), clamp/validate
  `line`/`limit`, and consider a `confirm`-style hook for permission requests
  instead of unconditional approval.

### M3 — `resolveConfigValue`/skill-loader exports silently dropped between 0.x and 1.0

- **Location:** `src/index.ts` vs `CHANGELOG.md` 0.4.0
- **Problem:** `loadSkillContent`, `loadSkillContents`, `SKILL_PATHS` were
  shipped public API ("exported from `@topce/pizx`", CHANGELOG 0.4.0), are
  still used internally (`src/core/llm.ts`), but are no longer exported. The
  1.0 "Breaking" changelog does not mention their removal. Same for
  `resolveConfigValue` (was public in 0.x auth handling).
- **Suggestion:** Re-export them from `index.ts` (additive, restores
  compatibility), or add a "Removed" entry to the 1.0 changelog if the
  removal is intentional. Given the skill's "prefer addition over
  modification", re-exporting is the cheaper, safer path.

### M4 — Two result contracts for "generate text"

- **Location:** `src/core/llm.ts` (`AskResult`: `text`, `modelId`, `usage`,
  `durationMs`) vs `src/core/tags.ts` (`LetterOutput`: `text`, `modelUsed`,
  `fromCache`, token getters)
- **Problem:** Same conceptual operation, two shapes, and the model field
  name diverges (`modelId` vs `modelUsed`). Consumers learn one and trip over
  the other.
- **Suggestion:** Align the field name (`modelId` on both, or `modelUsed` on
  both — pick one, document the other as deprecated if renamed). Document
  `AskResult` as the low-level contract and `LetterOutput` as the letter-level
  wrapper that embeds trace data, so the relationship is explicit.

### M5 — Options duplicated across four surfaces

- **Location:** `src/core/llm.ts` (`AskOptions`, `agentSession` opts,
  `LlmConfig`) vs `src/plugins/pi.ts` schema (`PiOpts`)
- **Problem:** ~8 overlapping fields (`model`, `system`, `appendSystemPrompt`,
  `maxTokens`, `thinkingLevel`, `thinkingBudgets`, `timeoutMs`, `maxRetries`,
  `apiKey`) hand-maintained in multiple places with slightly different sets.
  Drift already happened (`maxTurns` exists in one surface only — H2).
- **Suggestion:** Share a base type or derive `AskOptions` from the schema
  (`type AskOptions = ReturnType<typeof piOptionsSchema>`), so one surface is
  the source of truth.

---

## Low

| # | Location | Finding | Suggestion |
|---|----------|---------|------------|
| L1 | `src/core/tags.ts` `LetterOutput` | `trace: LlmCallEvent[]` and `turnCount?` are public and mutable; `_attach()` mutates `modelUsed` via a cast | Make fields read-only / `private` with accessors; avoid the cast |
| L2 | `src/core/context.ts` | `app.config` (raw input) differs from `app.ctx.config` (normalized, `cache: false` injected) — two observable config objects | Return the normalized config, or expose only `ctx.config` |
| L3 | `src/core/context.ts`, `letters.ts` | `Pizx.π/letter()/define()` return non-generic `LetterFn`, erasing the schemastery-inferred `TOpts` | Expose `letter<T>()`/`define<T>()` so consumers get typed options |
| L4 | naming | `fromCache` (vs `isFromCache`), `trace` doubles as a boolean option and the service name | Follow the is/has/can convention; rename option to `recordTrace` if the collision confuses |
| L5 | `src/index.ts`, `src/globals.ts` | π/Π/α alias lists hand-duplicated in two entry points; `globals.ts` exports `app` and only re-exports `getDefaultApp` (not configure/dispose) | Generate the alias list from one source; export the same default-app API from both subpaths |
| L6 | `src/core/tags.ts` `LetterDefinition` | `cache?: false` — only the negative is expressible | Rename to `cacheable?: boolean` (default `true`) or keep, but document the asymmetry |
| L7 | `src/core/trace.ts` `exportLog` | JSONL/JSON strings are cached; new events after the first export make the JSONL stale while JSON stays fresh | Invalidate both caches in `record()`/`finalize()`, or drop the caching |
| L8 | `src/core/skill-loader.ts` | `loadSkillContent` swallows EACCES silently despite the JSDoc saying it warns | Either emit the documented warning or fix the JSDoc — the doc is part of the contract |

---

## What's already done well

- **Discriminated unions for trace events** (`TraceEvent` union on `kind`
  literals, `SpanEventInput`/`TraceEventInput` stamped variants) — exemplary.
- **Schemastery validation at the letter boundary** with typed defaults
  (π/Π/α options) — the right pattern; M1 is the one gap.
- **`cacheConfig?: Omit<CacheConfig, 'enabled'>`** — additive, nested,
  documented config shape.
- **Content-addressed cache keys** with deterministic `pickCacheRelevantOpts`
  ordering — thoughtful and hard to misuse.
- **Input/output separation** (`LetterDefinition` vs `LetterOutput`).
- **Effect-based letter cleanup** in `Letters.define` (cordis unload removes
  registry entries and globals) — a proper lifecycle contract.
- **Idempotent teardown** (`dispose`, `finalize`, `clear` all safe to call
  twice).

## Verification checklist (skill)

- [x] Typed input/output for every public call — yes, but generics erased at `Pizx` boundary (L3) and `confirm` is `any` (M1)
- [ ] Single consistent error format — **no** (H1)
- [ ] Validation at boundaries only — mostly (π/Π/α schemas), gaps at `confirm` (M1) and ACP fs handlers (M2)
- [x] Naming conventions consistent — camelCase overall, minor deviations (M4, L4)
- [ ] Additive/backward-compatible changes — 1.0 removal of skill-loader exports undocumented (M3)
- [x] API docs committed alongside — `docs/*.md`, JSDoc on exports; some drift (L8)

## Suggested fix order

1. **C1** — forwardTag option forwarding + regression test (breaks documented usage)
2. **H1** — `PizxError` + replace prefix matching; wire or delete `wrapLetterError`
3. **H2/H3** — fix `maxTurns`, complete the session-pool key
4. **M1** — schema-encode `confirm`, fix `resolveMode` truthiness
5. **M2, M3, M4, M5** — boundary hardening, restore/retire exports, align result contracts, unify option surfaces
6. **L1–L8** — opportunistic cleanup alongside the above
