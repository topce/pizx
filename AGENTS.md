# AGENTS.md — writing pizx code

This is the canonical guide for AI agents generating **pizx** scripts and CLI
invocations. pizx is a [zx](https://github.com/google/zx) fork that adds
AI "letters" — template tags backed by language models — on the
[cordis](https://github.com/cordiverse/cordis) plugin framework.

Two ways to target pizx:

1. **Script files** run by the `pizx` CLI (`#!/usr/bin/env pizx`), where the
   letters are injected as globals.
2. **A library** (`import { createPizx } from '@topce/pizx'` or
   `import '@topce/pizx/globals'`).

**Prerequisites:** Node.js >= 22.19.0. The `π` and `Π` letters need Pi
credentials — run `pi auth login` once (`npm i -g @earendil-works/pi`). The `α`
letter needs no pi; it drives any external ACP server you name.

---

## Canonical script template

Start every script file with the shebang, then the reference directive to get
type-checking and autocomplete on the injected globals:

```js
#!/usr/bin/env pizx
/// <reference types="@topce/pizx/globals" />

// Globals available with no import: $, π, Π, α (+ your own letters), plus all
// of zx: cd, echo, chalk, fetch, fs, os, path, glob, question, sleep, within…

const files = (await $`ls src`).stdout.trim()

const review = await π`Review these files for issues:\n${files}`
echo(review.text)

if (review.text.includes('BUG')) {
  await Π({ tools: ['read', 'edit'] })`Fix the bugs described here:\n${review.text}`
}
```

Make it executable and run it, or pass it to the CLI:

```bash
chmod +x script.mjs && ./script.mjs
pizx script.mjs
```

> Use `.mjs` (or `.ts`) — pizx scripts are ES modules and use top-level `await`.

---

## The letters

| Letter | ASCII aliases | Purpose | Needs |
|---|---|---|---|
| `π` | `pi`, `ai` | Pi AI text generation (streams by default) | pi creds |
| `Π` | `Pi`, `piAgent`, `codingAgent` | Pi coding agent with tools (read/bash/edit/write/…) | pi creds |
| `α` | `acp`, `agent` | Any ACP-compatible coding agent | an ACP server command |

Prefer the ASCII aliases (`pi`, `Pi`, `acp`) when emitting code where the Greek
letters are awkward to type — they are the exact same tags.

```js
const answer = await pi`what is the capital of France?`   // π
await Pi`fix the TypeScript errors in src/`                // Π
await acp({ server: ['kiro-cli', 'acp'] })`review this diff`  // α
```

### Every letter is a template tag with the same shape

```js
await π`plain prompt`                       // call as a tagged template
await π({ model: 'anthropic/claude-sonnet-4-5' })`prompt`  // options first, then the template
await π.quiet`prompt`                        // suppress streaming to stdout
await π.cache`prompt`                        // serve/store in the local result cache
for await (const chunk of π.stream`tell me a story`) process.stdout.write(chunk)  // stream (π and α)
```

Options and chaining combine: `π.quiet({ model })\`…\``,
`Π({ tools: ['read'] }).cache\`…\``, etc. Options can be chained in any order.

---

## Options per letter

Pass options as a plain object before the template: `` π({ ...opts })`prompt` ``.

**`π` (text):** `model`, `thinkingLevel` (`off`|`minimal`|`low`|`medium`|`high`|`xhigh`),
`thinkingBudgets`, `quiet`, `system`, `appendSystemPrompt`, `maxTokens`,
`timeoutMs`, `maxRetries`, `apiKey`, `cache`, `confirm`.

**`Π` (coding agent):** `cwd`, `model`, `thinkingLevel`, `thinkingBudgets`,
`quiet`, `tools` (allow-list), `excludeTools`, `system`, `appendSystemPrompt`,
`skills`, `timeoutMs`, `maxRetries`, `apiKey`, `confirm`.

**`α` (ACP agent):** `server` (**required** — string array, e.g.
`['kiro-cli', 'acp']`), `cwd`, `env`, `quiet`, `timeoutMs`, `confirm`.

`confirm` gates execution: `true` or `{ semi: true }` prompts at major phases,
`{ hitl: true }` prompts at every phase, `{ auto: true }` (default) never
prompts. Interactive prompts read from stdin — avoid `confirm` in unattended
runs.

---

## The result: `LetterOutput`

Every `await`ed letter returns a `LetterOutput`. It stringifies to its text
(`toString`/`valueOf`), so `echo(result)` and `` `${result}` `` work — but read
`.text` explicitly when you need the string:

```js
const r = await π`hello`
r.text            // string — the full result text
r.modelId         // string | undefined — model that produced it
r.isFromCache     // boolean — true when served from the local cache
r.duration        // number — elapsed ms
r.inputTokens     // number  (also outputTokens, cacheReadTokens, cacheWriteTokens, totalTokens)
r.totalCost       // number — USD, when the provider reports cost
r.turnCount       // number | undefined — agent turns (Π/α only)
r.length          // number — text length;  r.lines — line count
```

---

## Programmatic use (library)

```js
import { createPizx } from '@topce/pizx'

const app = await createPizx({ cache: true /*, model, quiet, plugins */ })

const first = await app.π.cache`what is 7! + 5?`
const second = await app.π.cache`what is 7! + 5?`
second.isFromCache        // true — no second LLM call

await app.Π({ tools: ['read', 'edit'] })`refactor the auth module`
await app.letter('Σ')`summarize this`   // look up any registered letter by name

console.log(app.traceSummary())          // human-readable token/cache/cost totals
await app.flushLog('run.jsonl')          // write the run's JSONL event log
await app.dispose()                      // always dispose to tear down sessions
```

`createPizx()` returns `{ ctx, config, π, Π, α, letter(name), define(name, def),
exportLog(format?), traceSummary(), flushLog(path?, format?), dispose() }`.

Or inject everything as globals (boots a lazy default app):

```js
import '@topce/pizx/globals'
const answer = await π`explain async/await`
```

---

## Defining your own letter

A letter is a cordis plugin that registers a tag on `ctx.letters`. Load it via
`pizx.config.mjs` (next to the script) or `createPizx({ plugins: [...] })`.

```js
// plugins/summarize.mjs
import { Schema } from '@topce/pizx'   // re-exported schemastery (or: import Schema from 'schemastery')
export const name = 'summarize'
export const inject = ['letters', 'llm']
export function apply(ctx) {
  ctx.letters.define('Σ', {
    aliases: ['summarize'],
    options: Schema.object({ maxWords: Schema.natural().default(30), model: Schema.string() }),
    run: async (prompt, opts, { ctx }) => {
      const { text } = await ctx.llm.ask(`Summarize in ≤${opts.maxWords} words:\n\n${prompt}`, { model: opts.model })
      return text
    },
  })
}
export default { name, inject, apply }
```

```js
// pizx.config.mjs
import summarize from './plugins/summarize.mjs'
export const plugins = [summarize]
```

Custom letters get option chaining, `.quiet`/`.cache`/`.stream`, tracing, and
global injection automatically. See [docs/extension.md](docs/extension.md).

### Global install vs. local install

The built-in letters (`π`/`Π`/`α`) work from a **global** install
(`npm i -g @topce/pizx`) with no local setup — the CLI injects them. **Plugin
development is different:** pizx loads your `pizx.config.mjs` by path, and any
bare imports inside it (`schemastery`, `@topce/pizx`) resolve against a *local*
`node_modules`, not the global one. Two ways to handle it:

- **A — dependency-free plugin (works with a pure global install).** `options`
  is optional, so a plugin that imports nothing needs no local `node_modules`:

  ```js
  // pizx.config.mjs — no external imports, nothing to resolve
  export const plugins = [{
    name: 'shout',
    inject: ['letters', 'llm'],
    apply(ctx) {
      ctx.letters.define('Σ', {
        aliases: ['shout'],
        run: async (prompt, _opts, env) => (await env.ctx.llm.ask(`Summarize:\n${prompt}`)).text.toUpperCase(),
      })
    },
  }]
  ```

  You lose schemastery-validated options, but it runs from a global `pizx` with
  zero project setup.

- **B — install locally for full plugin dev (recommended).** Run
  `npm install @topce/pizx` in a project (or `npm link @topce/pizx`). Then
  `import { Schema } from '@topce/pizx'`, the type imports, and the
  `/// <reference types="@topce/pizx/globals" />` directive all resolve, and you
  get schemastery schemas plus editor types.

---

## CLI contract (for invoking pizx from an agent)

```bash
pizx script.mjs                       # run a script
pizx -p "your prompt"                 # quick π query (streams to stdout)
pizx -p -                             # read the prompt from stdin
echo "prompt" | pizx -p               # empty prompt + piped stdin also reads stdin
pizx --acp --acp-server "kiro-cli acp" "prompt"   # quick α query
pizx --letters                        # list registered letters
pizx --model <id> script.mjs          # set the model for the run
pizx --cache | --no-cache script.mjs  # toggle the local result cache
pizx --trace --export-log script.mjs  # trace summary (stderr) + JSONL log
pizx --no-color ...                   # disable ANSI color (also honors NO_COLOR)
pizx --json ...                       # machine-readable output (implies quiet + no-color)
pizx --version | --help
```

**Streams:** results go to **stdout**; status, trace summaries, and errors go to
**stderr**. Parse stdout, watch exit codes.

### `--json` output

`--json` makes `-p`, `--acp`, and `--letters` emit one JSON object/array on
stdout (streaming is suppressed). A result envelope:

```json
{
  "text": "Paris",
  "modelId": "deepseek/deepseek-v4-flash",
  "fromCache": false,
  "durationMs": 812,
  "tokens": { "input": 12, "output": 3, "cacheRead": 0, "cacheWrite": 0, "total": 15 },
  "costUsd": 0.0001
}
```

`--letters --json` emits `[{ "name", "aliases", "cacheable", "description" }, …]`.
On failure, stderr gets `{ "error": { "code", "message" } }` and the process
exits with the matching code below.

### Exit codes

| Code | Meaning |
|---|---|
| `0` | success |
| `1` | unknown / foreign error |
| `2` | `VALIDATION` — bad usage or invalid input |
| `3` | `AUTH` — no credentials/model (run `pi auth login`) |
| `4` | `AGENT` — Π coding-agent failure |
| `5` | `ACP` — α ACP server/connection failure |
| `6` | `CANCELLED` — user declined a confirmation gate |
| `7` | `INTERNAL` — unexpected internal error |

Programmatically, these come from `PizxError.code`
(`import { PizxError, isPizxError } from '@topce/pizx'`); branch on `err.code`,
not on message text.

---

## Gotchas

- Scripts are ESM with top-level `await`; use `.mjs`/`.ts`, not `.cjs`.
- A letter result is a `LetterOutput`, not a string — use `.text` (it does
  stringify, but `.text` is clearer and avoids surprises with `JSON.stringify`).
- `π`/`Π` need `pi auth login`; `α` needs a `server` command and ignores pi.
- `Π` and `α` mutate the filesystem — they are never cached.
- `--json` implies `--quiet` and `--no-color`; don't also parse streamed text.

## More docs

- [README](README.md) — overview and quick start
- [π](docs/pi.md) · [Π](docs/capital-pi.md) · [α](docs/acp.md) — per-letter references
- [Defining letters](docs/extension.md) — the plugin API
- [Trace & logs](docs/trace.md) — event format, export, caching
- [Onboarding](docs/onboarding.md) — architecture and file map
