# Defining Your Own Letters

pizx is built on [cordis](https://github.com/cordiverse/cordis), the plugin
framework behind Koishi and the DeepSeek harness. The core ships three
letters — **π** (text generation), **Π** (coding agent), and **α** (any
ACP-compatible agent; see [docs/acp.md](acp.md)) — and everything else is a
plugin. This guide shows how to write your own.

A **letter** is a template tag:

```js
const subject = await Ξ({ maxChars: 60 })`${diff}`
```

A **letter plugin** is a cordis plugin that registers one on `ctx.letters` — the
canonical example is
[`examples/plugins/commit.mjs`](../examples/plugins/commit.mjs), which turns a
diff into a conventional-commit subject line:

```js
// plugins/commit.mjs
import { Schema } from '@topce/pizx' // re-exported schemastery ('schemastery' also works)

export const name = 'commit'
export const inject = ['letters', 'llm']

export function apply(ctx) {
  ctx.letters.define('Ξ', {
    aliases: ['commit'],
    description: 'Write a conventional-commit subject line from a diff',

    options: Schema.object({
      maxChars: Schema.natural().default(72),
      model: Schema.string(),
    }),

    run: async (prompt, opts, env) => {
      const result = await env.ctx.llm.ask(
        `Write one conventional-commit subject line (type(scope): summary) of at most ${opts.maxChars} characters:\n\n${prompt}`,
        { model: opts.model }
      )
      return result.text
    },
  })
}
```

## Loading your plugin

Three ways, in order of preference:

**1. Config file** (`pizx.config.mjs` next to your script or cwd — loaded
automatically by the CLI and `pizx/globals`):

```js
import commit from './plugins/commit.mjs'
export const plugins = [commit]
```

**2. Explicitly** via the CLI: `pizx --config ./plugins/commit.mjs script.mjs`.

**3. Programmatically**:

```js
import { createPizx } from '@topce/pizx'

const app = await createPizx({ plugins: [commit] })
// or imperatively, after boot:
app.define('greet', { run: (prompt) => `handled: ${prompt}` })
```

Once loaded, the letter is available as a global in scripts (no imports
needed), shows up in `pizx --letters`, and works exactly like the built-ins.

## Developing with a global install

The built-in letters work fine from a global install (`npm i -g @topce/pizx`) —
the CLI injects `π`/`Π`/`α` and you need no local `node_modules`. Plugin
development is the exception: pizx loads your `pizx.config.mjs` **by path**, so
any bare imports inside your plugin (`schemastery`, `@topce/pizx`) resolve
against a *local* `node_modules`, not the global one. A plugin that
`import`s `schemastery` from a loose file with no local install fails with
`ERR_MODULE_NOT_FOUND`.

- **Dependency-free plugin** — works with a pure global install because it
  imports nothing. `options` is optional, so skip the schema:

  ```js
  // pizx.config.mjs
  export const plugins = [{
    name: 'shout',
    inject: ['letters', 'llm'],
    apply(ctx) {
      ctx.letters.define('Σ', {
        aliases: ['shout'],
        run: async (prompt, _opts, env) =>
          (await env.ctx.llm.ask(`Summarize:\n${prompt}`)).text.toUpperCase(),
      })
    },
  }]
  ```

- **Install locally (recommended for real plugins)** — `npm install @topce/pizx`
  in a project (or `npm link @topce/pizx`). Then `import { Schema } from
  '@topce/pizx'`, type imports, and the `/// <reference types="@topce/pizx/globals" />`
  directive all resolve, giving you validated options and editor types. A
  runnable tour of the typed globals is
  [`examples/typed-globals.mjs`](../examples/typed-globals.mjs).

## The LetterDefinition contract

| Field | Purpose |
|---|---|
| `aliases` | Extra names the letter answers to (e.g. `['commit']`) |
| `description` | Shown by `pizx --letters` |
| `options` | A [schemastery](https://github.com/cordiverse/schemastery) schema — validated at the boundary, defaults applied, and the inferred type becomes the tag's option type |
| `cache: false` | Mark letters **with side effects** (agents, file writers) so they are never served from the result cache |
| `run(prompt, opts, env)` | The implementation. Return a string or a `LetterOutput` |
| `stream(prompt, opts, env)` | Optional — enables `letter.stream` |

### `env` — your window into pizx

```js
{
  ctx,    // the cordis context: ctx.llm, ctx.typesafe, ctx.trace, ctx.cache, ctx.letters, ctx.words
  pieces, // raw template pieces
  args,   // interpolated values
  span,   // this invocation's trace span (undefined when tracing is off)
}
```

Everything you call through `ctx.llm` is traced automatically: model, tokens
(input/output/cache read/cache write), cost, and duration land on your
letter's span and in the exported log. Calls through `ctx.typesafe.ask` are
traced the same way. If you call providers yourself, attribute usage to your
span with `span.emit({ kind: 'llm-call', … })`.

## Getting the DX for free

Every letter registered through `ctx.letters` automatically gets:

- **Option chaining** — `Ξ({ maxChars: 40 })`…``
- **`.quiet`** — a variant with `quiet: true` merged in
- **`.cache`** — a variant with `cache: true` merged in (works when your
  options schema declares a `cache` boolean)
- **`.stream`** — when the definition provides a stream implementation
- **Tracing** — a `letter-start`/`letter-end` span wrapping every invocation
- **Caching** — side-effect-free letters hit the local content-addressed
  cache when enabled (per call, app-wide, or `pizx --cache`)

## Building on TypeSafe

The `ctx.typesafe` service turns TypeSafe's System One model into typed,
calibrated decisions. A custom letter can wrap one reusable judgment and
expose it with the same DX as the built-ins:

```js
// plugins/urgency.mjs — one fixed TypeSafe question as a reusable letter
import { LetterOutput, Schema } from '@topce/pizx'

export const name = 'urgency'
export const inject = ['letters', 'typesafe']

export function apply(ctx) {
  ctx.letters.define('urgency', {
    aliases: ['urgent'],
    options: Schema.object({ model: Schema.string() }),
    run: async (prompt, opts, env) => {
      const { answers } = await env.ctx.typesafe.ask(
        prompt || null,
        { urgency: { type: 'noul', instructions: 'Is this urgent or time-sensitive?' } },
        { model: opts.model }
      )
      // Attach the typed answer so callers get `.answer`; `.text` is the scalar.
      return new LetterOutput(String(answers.urgency.noul)).withAnswer(answers.urgency)
    },
  })
}
```

`ctx.typesafe.ask(state, questions, opts)` sends **every** question in one
System One call — prefer batching speculative questions and filtering in the
caller. Full reference: [docs/typesafe.md](typesafe.md); runnable tour:
[examples/typesafe-custom-letter.mjs](../examples/typesafe-custom-letter.mjs).

## Harnesses — adding a CLI backend to ε

The `ε` letter runs CLI AI harnesses; the harnesses themselves are **spec
plugins** registered on the `ctx.harnesses` service. A spec is a tiny
declarative object — that's the whole plugin:

```js
// plugins/harness-opencode.mjs — everything ε needs to run opencode
export const name = 'opencode'
export const inject = ['harnesses']
export function apply(ctx) {
  ctx.harnesses.define('opencode', {
    command: 'opencode',
    runArgs: ['run'],
    prompt: 'arg',          // final positional arg ('arg') or 'stdin'
    description: 'opencode coding agent',
  })
}
export default { name, inject, apply }
```

Spec fields: `command` (defaults to the name), `runArgs` (before generated
flags, e.g. `['-p']` for claude), `prompt` (`'arg'`|`'stdin'`), `flags`
(option-key → flag-name overrides), `negateBooleans` (default true — maps
`false` to `--no-<flag>`), `description`. Everything else ε owns: options
without a pizx key auto-convert to CLI flags (camelCase → `--kebab-case`,
booleans bare, arrays repeated, 1-char → `-x`). The built-ins
(`src/plugins/harness-kiro.ts`, `src/plugins/harness-claude.ts`) are exactly
this pattern. Full reference: [docs/epsilon.md](epsilon.md).

## Words — composing letters into patterns

A **word** is an AI pattern built by composing letters, registered through the
`ctx.words` service. Its letters live in replaceable **slots** (a registered
name or a tag), so `ralph({ execute: 'α' })` swaps the execution step without
changing the pattern. Words are themselves letters, so they compose
recursively. See [docs/words.md](words.md) for the full reference.

```js
export const inject = ['words', 'letters', 'llm']
export function apply(ctx) {
  ctx.words.define('ralph', {
    slots: { analyze: 'π', plan: 'π', execute: 'Π', review: 'π' },
    options: { maxIterations: Schema.natural().default(5) },
    run: async (prompt, opts, env) => {
      const { ctx } = env
      const analyze = (await ctx.words.call(opts.analyze, prompt, { quiet: true })).text
      // … loop / parallel / compose the slots …
      return analyze
    },
  })
}
```

## Guidelines

- Declare `inject: ['letters', 'llm']` (and `'trace'`/`'cache'` when you use
  them) — cordis then starts your plugin only once its dependencies exist,
  regardless of load order.
- Use `cache: false` for any letter that mutates the world — caching is the
  default for side-effect-free letters.
- Name collisions throw descriptive errors naming both owners; unloading a
  plugin removes its letters and their globals automatically (cordis
  effects).
- Ship reusable letters as npm packages (`@you/pizx-commit`) — consumers
  just add them to their `pizx.config.mjs`.

See `examples/plugins/` in the repository for runnable examples
(`commit.mjs`, `ralph.mjs`, `fleet.mjs`, and the other word plugins).
