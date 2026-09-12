# ε (epsilon) — Any CLI AI Harness

ε runs **any CLI AI harness** — `kiro-cli`, `claude`, `opencode`, anything
with a headless command — by shelling out to its binary through a tiny zx
wrapper: one process per invocation, argv built from a declarative spec.
**No pi involvement** — π/Π keep using pi's SDK as they always did, and ε
works on machines where pi is not installed.

## Usage

```js
// Claude Code — `claude -p --model sonnet <prompt>`
const r1 = await ε({ harness: 'claude', model: 'sonnet' })`review this diff`

// Amazon Kiro — `kiro-cli chat --no-interactive <prompt>`
const r2 = await ε({ harness: 'kiro' })`fix the TypeScript errors in src/`

// Quiet mode — suppress the live stdout echo
const r3 = await ε.quiet({ harness: 'claude' })`list TODOs`

// Streaming — consume output lines as the harness produces them
for await (const chunk of ε({ harness: 'claude' }).stream`explain x`) {
  process.stdout.write(chunk)
}

// Aliases: run, harness, and cli answer to the same letter
const r4 = await run({ harness: 'kiro' })`same thing`
```

`harness` is **required** — there is no default. Missing it fails fast:

```
pizx/ε: no harness specified — pass { harness: 'claude' } or { harness: 'kiro' }
```

The same letter is reachable from the CLI:

```bash
pizx --run --run-harness claude "review this diff"
pizx --run --run-harness kiro --json "fix the tests"
```

## Options

Every option ε does not own is **forwarded to the harness CLI as a flag**, so
"all options of the harness" are supported without enumerating them:

| Option | Type | Meaning |
|---|---|---|
| `harness` | string | **required** — registered harness name (claude, kiro, or your own plugin) |
| `cwd` | string | working directory for the harness |
| `env` | dict | extra environment variables |
| `quiet` | boolean | suppress the live stdout echo (stderr status lines too) |
| `timeoutMs` | number | kill the harness after N ms (process-group kill) |
| `confirm` | gate | `true` / `{ semi }` / `{ hitl }` / `{ auto }` — confirm before running |
| `args` | string[] | raw extra args appended verbatim after generated flags |
| **anything else** | flag | converted to a CLI flag and forwarded |

Flag conversion rules (everything except the keys above, including `model`):

| Option value | Generated argv |
|---|---|
| `'sonnet'` / `3` (string or number) | `--<key> sonnet` |
| `true` | bare `--<key>` |
| `false` | `--no-<key>` (short flags are dropped instead) |
| `['a', 'b']` | flag repeated per item |
| nested object | `VALIDATION` error |

Keys convert `camelCase` → `--kebab-case` (`maxTurns` → `--max-turns`);
single-character keys become `-x`. A harness spec can override any generated
flag name (`flags: { printMode: '-p' }`) and disable `--no-` negation
(`negateBooleans: false`).

## Built-in harnesses

| Harness | Command | How ε invokes it |
|---|---|---|
| `claude` | `claude` | `claude -p [flags] <prompt>` |
| `kiro` | `kiro-cli` | `kiro-cli chat --no-interactive [flags] <prompt>` |

## Writing your own harness (a ~10-line plugin)

Harnesses are **spec plugins** — the ε core knows nothing about any specific
CLI. Drop this in `pizx.config.mjs` (or any plugin) to add opencode:

```js
// plugins/harness-opencode.mjs
export const name = 'opencode'
export const inject = ['harnesses']
export function apply(ctx) {
  ctx.harnesses.define('opencode', {
    command: 'opencode',
    runArgs: ['run'],
    prompt: 'arg', // 'arg' (final positional) or 'stdin'
    description: 'opencode coding agent',
  })
}
export default { name, inject, apply }
```

```js
// pizx.config.mjs
import opencode from './plugins/harness-opencode.mjs'
export const plugins = [opencode]
```

Once loaded, `ε({ harness: 'opencode', model: 'gpt-5' })`… works everywhere:
scripts, `pizx --letters`, and `pizx --run --run-harness opencode`. The full
spec shape:

```ts
interface HarnessSpec {
  command?: string            // executable; defaults to the harness name
  runArgs?: string[]          // args before flags, e.g. ['chat', '--no-interactive'] or ['-p']
  prompt?: 'arg' | 'stdin'    // prompt delivery; default 'arg'
  flags?: Record<string, string>   // override generated flag names
  negateBooleans?: boolean    // map false → --no-<flag>; default true
  stripAnsi?: boolean         // clean TUI decoration out of stdout; default false
  description?: string
}
```

`stripAnsi` is for harnesses whose headless mode still renders a terminal UI.
Kiro CLI is the built-in example: it prints SGR codes and a highlighted `> `
before the answer, so without this the letter's `text` would be
`"\u001b[m> \u001b[0mOK"` instead of `"OK"`. With `stripAnsi: true`, escape
sequences and the leading prompt marker are removed from the result text, the
live echo, and `.stream`.

> A harness can be installed and still unusable — wrong version, or not logged
> in. Kiro picks its model from its own config, so if `pizx --run
> --run-harness kiro` reports that the selected model is unavailable, run
> `kiro-cli chat --list-models` and pass a valid one: `--model claude-sonnet-4.5`.
> The same applies to `claude`, which needs `/login` first.

## ε inside words

ε fills the agent slots of the word library exactly like Π/α — pass `harness`
next to the slot name and the word forwards it (plus `cwd`, `timeoutMs`, …):

```js
await ralph({ execute: 'ε', harness: 'claude' })`create NOTES.md with the plan`
await fleet({ worker: 'ε', harness: 'kiro', concurrency: 2 })`- task one
- task two`
```

## Result & errors

The result is a regular `LetterOutput` (`text`, `duration`, …) with
`modelId` = `run:<harness>` or `run:<harness>:<model>` and
`isFromCache: false` — harness runs mutate the filesystem and are never
cached.

Failures are `PizxError('HARNESS', …)` with the exit code and a stderr tail;
a missing binary is reported as "failed to start … is it installed?". The CLI
exits with **code 8** for these. Missing/unknown harness is `VALIDATION`
(code 2), declined confirm gates are `CANCELLED` (code 6).

> See [docs/acp.md](acp.md) for α (ACP protocol agents) — ε is for harnesses
> with a plain CLI contract; α for ones with an ACP server.
