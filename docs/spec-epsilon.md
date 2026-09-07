# Spec: ε (epsilon) — run any CLI AI harness as a letter

Status: **implemented** (all decisions confirmed; spec kept in sync with the shipped code)

## Objective

Add a new letter **ε** that runs *other* AI harnesses by shelling out to their
CLIs — `kiro-cli`, `claude`, `opencode`, … — exactly like a zx `$` call.
**Not pi**: π/Π keep using the pi SDK, and ε must have zero pi involvement
(parity with α, which runs without any llm service).

Ship two built-in harnesses — **kiro-cli** and **claude** — as tiny spec
plugins. Every other harness (`opencode`, `gemini`, …) is a user plugin
written in the same ~10-line spec style and loaded via `pizx.config.mjs`.
"Everything is a plugin": the ε core knows *nothing* about any specific
harness; it only knows how to build argv and spawn a process.

### User stories

- `await ε({ harness: 'claude', model: 'sonnet' })`review this diff`` — runs
  `claude -p --model sonnet "review this diff"` and returns the text.
- `await run({ harness: 'kiro', maxTurns: 3 })`fix the tests`` — runs
  `kiro-cli run --max-turns 3 "fix the tests"`.
- Any option the harness supports (today's and tomorrow's) is expressible
  without editing pizx: unknown option keys auto-convert to CLI flags.
- A user drops an `opencode` spec plugin into `pizx.config.mjs` and
  `ε({ harness: 'opencode' })`… just works, shows up in `pizx --letters`,
  and is usable from the CLI quick mode.

## Tech Stack

- TypeScript ESM (Node ≥ 22.19), cordis plugin framework (existing).
- **zx** — the runner is a zx `$` wrapper (zx is already a direct dependency,
  re-exported from the package). No new dependencies.
- schemastery for the ε option boundary (loose object schema: known keys
  validated, extra keys pass through as harness flags).
- vitest + biome (existing test/lint setup).

## Commands

```bash
npm run build         # build:js + build:dts
npm test              # vitest --run (full suite, incl. new ε tests)
npm run typecheck     # tsc --noEmit
npm run lint          # biome ci src/
npm run example:epsilon  # NEW: node dist/cli.js examples/epsilon-basic.mjs
```

## Project Structure

New files (all under `src/` unless noted):

```
src/core/harnesses.ts        # NEW — Harnesses service: registry of harness specs
src/plugins/epsilon.ts       # NEW — the ε letter plugin (zx runner, generic argv builder)
src/plugins/harness-kiro.ts  # NEW — kiro-cli spec plugin (~10 lines)
src/plugins/harness-claude.ts# NEW — claude spec plugin (~10 lines)
src/plugins/epsilon.test.ts  # NEW — letter tests against a mock executable
src/core/harnesses.test.ts   # NEW — registry tests
src/testing/harness-mock.mjs # NEW — mock harness executable (echoes argv, streams output)
examples/epsilon-basic.mjs   # NEW — runnable example (harness overridable via env)
docs/epsilon.md              # NEW — per-letter reference (mirrors docs/acp.md)
docs/spec-epsilon.md         # this spec
```

Touched files: `src/core/errors.ts` (new `HARNESS` code),
`src/core/context.ts` (mount ε + harness plugins, expose `ε` on `Pizx`),
`src/core/default-app.ts` (export `ε`, `run`, `harness`, `cli`),
`src/globals.ts` (ambient types), `src/index.ts` (exports),
`src/cli.ts` (`--run`, `--run-harness`, exit code 8), `src/cli.test.ts`,
`AGENTS.md`, `README.md`, `docs/extension.md`, `CHANGELOG.md`, `llms.txt`,
`package.json` (example script + description).

## Code Style

Same style as `src/plugins/acp.ts`: JSDoc block header, `PizxError` for all
boundary failures, `LetterOutput` result, status lines to stderr, result text
to stdout.

```js
// Usage (script):
const r = await ε({ harness: 'claude', model: 'sonnet' })`review this diff`
await run({ harness: 'kiro', yolo: true })`fix the failing tests`   // alias of ε
echo(r.text)

// A harness spec plugin (this is the whole plugin):
export const name = 'opencode'
export const inject = ['harnesses']
export function apply(ctx) {
  ctx.harnesses.define('opencode', {
    command: 'opencode',
    runArgs: ['run'],
    prompt: 'arg',
    description: 'opencode coding agent',
  })
}
```

## Harness Spec (the pluggable unit)

`ctx.harnesses.define(name, spec)` where:

```ts
interface HarnessSpec {
  /** Executable. Defaults to the harness name. */
  command?: string
  /** Args inserted before the flags, e.g. ['run'] (kiro) or ['-p'] (claude). */
  runArgs?: string[]
  /** Prompt delivery: final positional arg (default) or stdin. */
  prompt?: 'arg' | 'stdin'
  /** Override the auto-generated flag name for an option key. */
  flags?: Record<string, string>
  /** Map boolean-false options to --no-<flag> (default true). */
  negateBooleans?: boolean
  /** One-line description for diagnostics. */
  description?: string
}
```

## ε option handling (generic auto-flag passthrough)

The ε option schema validates **pizx-owned keys** and lets everything else
pass through untouched (schemastery object schemas are loose):

| Key | Type | Meaning |
|---|---|---|
| `harness` | string | **required** — registered harness name (VALIDATION error if missing/unknown) |
| `cwd` | string | working directory |
| `env` | dict<string> | extra environment variables |
| `quiet` | boolean | suppress live stdout echo |
| `timeoutMs` | natural | kill the process after N ms |
| `confirm` | gate | same gate as α (`true`/`{semi}`/`{hitl}`/`{auto}`) |
| `args` | string[] | raw extra args, appended verbatim after generated flags |

**Any other key** converts to a CLI flag:

- `camelCase` → `--kebab-case`; 1-char keys → `-x`
- string/number → `--flag value`; array → flag repeated per item
- boolean true → bare `--flag`; boolean false → `--no-flag` (unless the spec
  disables negateBooleans)
- spec `flags` map overrides the generated name (irregular harnesses)
- nested objects/other types → `PizxError('VALIDATION')`

argv = `[command, ...runArgs, ...generatedFlags, ...args, prompt]`
(prompt replaced by stdin when `prompt: 'stdin'`).

## Execution model (tiny zx wrapper)

- Spawn once per invocation via zx (`$`/ProcessPromise) with `cwd`, merged
  `env`, and a `timeoutMs` watchdog; kill the child on every exit path
  (parity with the ACP client's cleanup discipline).
- Live-echo the child's stdout chunks to our stdout unless `quiet`
  (parity with α's onText); child stderr always inherits to our stderr.
- `.stream` yields stdout chunks as an async generator.
- Exit 0 → `LetterOutput`: `text` = stdout trimmed (or `(no output)`),
  `modelId` = `run:<harness>` or `run:<harness>:<model>` when `model` was
  passed, `cacheable: false` (harness runs mutate the filesystem).
- Non-zero exit → `PizxError('HARNESS', …)` including the exit code and a
  stderr tail; spawn failure (ENOENT) → same HARNESS error with a hint to
  install the harness.
- Confirm gate before send (major phase), same as α.
- Trace parity with α: emit `llm-call` events (modelId = harness label,
  durationMs, costUsd 0); no usage parsing in v1.

## CLI contract

```bash
pizx --run --run-harness claude "review this diff"     # quick ε query
pizx --run --run-harness kiro --json "fix the tests"   # JSON envelope (like --acp)
```

`--letters` already lists ε automatically (registry-driven). Harness failures
exit with **code 8 (`HARNESS`)** — new code added to `PizxErrorCode` and the
CLI mapping; `--json` errors report `{ "error": { "code": "HARNESS", … } }`.

## Testing Strategy

No real claude/kiro binary is required:

- `harnesses.test.ts` — registry define/get/duplicate/unload-effect.
- `epsilon.test.ts` — boot a bare context (no llm service, proving no pi),
  run against `src/testing/harness-mock.mjs` (a node script that echoes its
  argv and streams lines). Cover: flag conversion (camelCase, boolean,
  `--no-`, array, 1-char, spec renames), prompt-as-arg and stdin delivery,
  quiet, stream, timeout kill, non-zero exit → HARNESS error, missing/unknown
  harness → VALIDATION, cacheable false, modelId shape.
- `cli.test.ts` — `--run --run-harness …` flag parsing, exit code 8 mapping,
  `--json` envelope.
- Full suite: `npm test`, plus `npm run build` and `npm run typecheck`.

## Boundaries

- **Always:** keep ε core harness-agnostic (no harness-specific flags in
  epsilon.ts); new harnesses ship as spec plugins; update the docs letter
  table, `AGENTS.md`, and `CHANGELOG.md` with the feature; tests green before
  finish.
- **Ask first:** new runtime dependencies; renaming existing letters/aliases;
  changing existing exit codes 0–7.
- **Never:** touch pi/π/Π code paths; make ε cacheable; hardcode usage
  parsing for a specific harness in the core.

## Success Criteria

- [ ] `await ε({ harness: 'claude', model: 'sonnet' })`prompt`` runs
      `claude -p --model sonnet <prompt>` and returns its stdout text.
- [ ] `await run({ harness: 'kiro', maxTurns: 3 })`prompt`` runs
      `kiro-cli run --max-turns 3 <prompt>` (kiro command `kiro-cli` per
      repo convention — see open questions).
- [ ] Any unknown option converts per the flag table (unit-tested).
- [ ] `pizx --run --run-harness claude "prompt"` works; failed harnesses exit 8.
- [ ] A third-party harness plugin (opencode example) works end-to-end via
      `pizx.config.mjs` — including `pizx --letters` listing it.
- [ ] `npm test`, `npm run build`, `npm run typecheck`, `npm run lint` all pass.
- [ ] docs/epsilon.md + AGENTS.md letter table + README + CHANGELOG updated.

## Assumptions (correct me if wrong)

1. One letter (ε + aliases `run`/`harness`/`cli`), harness chosen by option —
   not one letter per harness.
2. Built-ins: only kiro-cli and claude; opencode ships as a *documented
   example plugin*, not built in.
3. Harness runs are non-cacheable and side-effectful (α parity).
4. Prompt goes as the final positional arg by default (claude `-p`, kiro
   `run` both accept it); `stdin` available per spec for other harnesses.
5. v1 does not parse token usage/cost out of harness output — trace events
   carry the harness label + duration only.

## Open Questions

1. Kiro binary name: repo docs use `kiro-cli` (α examples); Kiro CLI 2.0
   renamed the binary. Spec uses `kiro-cli`, overridable in one line — OK?
2. Should `claude`'s spec deliver the prompt via stdin instead of a positional
   arg (nicer for very long prompts)? Default is positional for symmetry.
3. Anything else the ε core should consume (e.g. `system` → harness-specific
   system-prompt flag forwarding) — or leave it all as passthrough flags?
