# Defining Your Own Letters

pizx is built on [cordis](https://github.com/cordiverse/cordis), the plugin
framework behind Koishi and the DeepSeek harness. The core ships three
letters — **π** (text generation), **Π** (coding agent), and **α** (any
ACP-compatible agent; see [docs/acp.md](acp.md)) — and everything else is a
plugin. This guide shows how to write your own.

A **letter** is a template tag:

```js
const summary = await Σ({ maxWords: 20 })`summarize this text…`
```

A **letter plugin** is a cordis plugin that registers one on `ctx.letters`:

```js
// plugins/summarize.mjs
import { Schema } from '@topce/pizx' // re-exported schemastery ('schemastery' also works)

export const name = 'summarize'
export const inject = ['letters', 'llm']

export function apply(ctx) {
  ctx.letters.define('Σ', {
    aliases: ['summarize'],
    description: 'Summarize text',

    options: Schema.object({
      maxWords: Schema.natural().default(30),
      model: Schema.string(),
    }),

    run: async (prompt, opts, env) => {
      const result = await env.ctx.llm.ask(
        `Summarize in at most ${opts.maxWords} words:\n\n${prompt}`,
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
import summarize from './plugins/summarize.mjs'
export const plugins = [summarize]
```

**2. Explicitly** via the CLI: `pizx --config ./plugins/summarize.mjs script.mjs`.

**3. Programmatically**:

```js
import { createPizx } from '@topce/pizx'

const app = await createPizx({ plugins: [summarize] })
// or imperatively, after boot:
app.define('Σ', { run: (prompt) => `handled: ${prompt}` })
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
  directive all resolve, giving you validated options and editor types.

## The LetterDefinition contract

| Field | Purpose |
|---|---|
| `aliases` | Extra names the letter answers to (e.g. `['summarize']`) |
| `description` | Shown by `pizx --letters` |
| `options` | A [schemastery](https://github.com/cordiverse/schemastery) schema — validated at the boundary, defaults applied, and the inferred type becomes the tag's option type |
| `cache: false` | Mark letters **with side effects** (agents, file writers) so they are never served from the result cache |
| `run(prompt, opts, env)` | The implementation. Return a string or a `LetterOutput` |
| `stream(prompt, opts, env)` | Optional — enables `letter.stream` |

### `env` — your window into pizx

```js
{
  ctx,    // the cordis context: ctx.llm, ctx.trace, ctx.cache, ctx.letters
  pieces, // raw template pieces
  args,   // interpolated values
  span,   // this invocation's trace span (undefined when tracing is off)
}
```

Everything you call through `ctx.llm` is traced automatically: model, tokens
(input/output/cache read/cache write), cost, and duration land on your
letter's span and in the exported log. If you call providers yourself,
attribute usage to your span with `span.emit({ kind: 'llm-call', … })`.

## Getting the DX for free

Every letter registered through `ctx.letters` automatically gets:

- **Option chaining** — `Σ({ maxWords: 10 })`…``
- **`.quiet`** — a variant with `quiet: true` merged in
- **`.cache`** — a variant with `cache: true` merged in (works when your
  options schema declares a `cache` boolean)
- **`.stream`** — when the definition provides a stream implementation
- **Tracing** — a `letter-start`/`letter-end` span wrapping every invocation
- **Caching** — side-effect-free letters hit the local content-addressed
  cache when enabled (per call, app-wide, or `pizx --cache`)

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
- Ship reusable letters as npm packages (`@you/pizx-summarize`) — consumers
  just add them to their `pizx.config.mjs`.

See `examples/plugins/` in the repository for runnable examples
(`summarize.mjs`, `ralph.mjs`, `fleet.mjs`).
