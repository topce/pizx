# Words — Composing Letters into AI Patterns

pizx has **letters** (atomic AI capabilities: `π` text, `Π` coding agent, `α`
any ACP agent) and **words** — named AI patterns built by composing letters.

- A **letter** is a plugin that registers a template tag.
- A **word** is an AI pattern (chain, fan-out, loop, routing, voting, …)
  whose positions are filled by letters. A word is itself a letter, so it
  composes recursively: **letters → words → sentences → a whole script**.

The core ships only the composition grammar (`ctx.words`). **Every word is a
plugin** — seven ship ready-made in `examples/plugins/` and load through
`pizx.config.mjs` like any letter plugin.

## The word catalog at a glance

| Word | Aliases | Pattern (from Anthropic's [*Building effective agents*](https://www.anthropic.com/engineering/building-effective-agents)) | Plugin |
|---|---|---|---|
| `ralph` | `loop` | Agent loop — iterative analyze → plan → execute → review | `examples/plugins/ralph.mjs` |
| `fleet` | `parallel` | Parallelization: **sectioning** — split a prompt, fan out | `examples/plugins/fleet.mjs` |
| `chain` | `pipeline` | **Prompt chaining** — sequential steps + optional gate | `examples/plugins/chain.mjs` |
| `route` | `branch` | **Routing** — classify, then dispatch to a specialized handler | `examples/plugins/route.mjs` |
| `vote` | `jury` | Parallelization: **voting** — N answers, tallied | `examples/plugins/vote.mjs` |
| `refine` | `optimize` | **Evaluator-optimizer** — generate → evaluate → revise loop | `examples/plugins/refine.mjs` |
| `orchestrate` | `director` | **Orchestrator-workers** — decompose → fan out → synthesize | `examples/plugins/orchestrate.mjs` |

Plus the building block and the agent itself, which are letters, not words:

| Pattern | pizx |
|---|---|
| Augmented LLM (retrieval, tools, memory) | `π`/`Π`/`α` letters (tools, `system`, `skills`) |
| Autonomous agent (model-driven tool loop) | `Π`, `α` letters — and `ralph` composes one explicitly |

## Slots: the letters in a word are replaceable

A word declares a fixed shape (the pattern) and a set of **slots** (the
letters that fill it). Each slot defaults to a built-in letter and can be
rebound at call time — by **name** or by **tag**:

```js
await ralph`improve error handling in src/`          // default slots: π π Π π
await ralph({ execute: 'α' })`refactor auth`          // swap the Π step for any ACP agent
await ralph({ review: 'fleet' })`refactor auth`       // swap the reviewer for another word

await fleet`review these files`                       // parallel π workers
await fleet({ worker: 'Π' })`fix the bugs in src/`    // parallel Π agents

await chain({ steps: ['outline', 'π'] })`write a doc` // explicit ordered steps
await route({ routes: { refund: 'π', tech: 'Π' } })`query`
await vote({ votes: 5 })`is this diff safe?`          // 5 answers, tallied
await refine({ criteria: 'no jargon' })`explain X`    // revise until it passes
await orchestrate({ worker: 'Π' })`implement TODOs`   // decompose + parallel agents
```

A slot value is a `LetterRef`: a registered letter **name** (resolved through
`ctx.letters`) or a **letter tag** passed directly — including a
pre-configured tag carrying its own options (`π({ model: '…' })`) or another
**word** (words are letters).

## Loading the words (everything is a plugin)

Words are ordinary cordis plugins; the core never loads them. Pick the ones
you want in `pizx.config.mjs` (the CLI and `pizx/globals` load it
automatically next to your script):

```js
// pizx.config.mjs
import ralph from './plugins/ralph.mjs'
import fleet from './plugins/fleet.mjs'
import chain from './plugins/chain.mjs'
import route from './plugins/route.mjs'
import vote from './plugins/vote.mjs'
import refine from './plugins/refine.mjs'
import orchestrate from './plugins/orchestrate.mjs'

export const plugins = [ralph, fleet, chain, route, vote, refine, orchestrate]
```

Or programmatically: `createPizx({ plugins: [chain, vote] })`. Once loaded, a
word is a global in scripts, shows up in `pizx --letters` (with its aliases
and description), and composes like any letter. Copy the plugin files from
`examples/plugins/` into your project — each is self-contained except for its
`schemastery` and `@topce/pizx` (for `PizxError`) imports, which resolve
against your local `node_modules`.

## The `ctx.words` service

Mounted on the root context alongside `letters`/`llm`/`trace`/`cache`.
Available as `ctx.words` in plugins and `app.words` from `createPizx()`.

### `ctx.words.define(name, spec)`

Register a word. It is also a letter, so it gets option chaining, `.quiet`,
`.cache`, `.stream`, tracing, and recursion for free. Words are
**non-cacheable by default** (they may compose agents), override with
`cacheable: true` for a pure word.

```js
ctx.words.define('ω', {
  aliases: ['double'],
  description: 'Run the first slot, then the second',
  slots: { first: 'π', second: 'π' },          // default slot bindings
  options: {                                   // extra (non-slot) options
    quiet: Schema.boolean().default(false),
  },
  run: async (prompt, opts, env) => {
    const a = (await env.ctx.words.call(opts.first, prompt, { quiet: true })).text
    const b = (await env.ctx.words.call(opts.second, a, { quiet: true })).text
    return b
  },
})
```

Each declared slot becomes an option (`opts.first`) with a schema that
accepts a string name or a tag, defaulting to the slot's binding. `define`
builds that schema for you by merging the slot fields with your `options`.

### Operators

| Method | Purpose |
|---|---|
| `resolve(ref)` | Turn a `LetterRef` (name or tag) into a callable tag. Throws `PizxError('VALIDATION', …)` for an unknown name. |
| `call(ref, prompt, opts?)` | Invoke a slot letter once, returning its `LetterOutput`. |
| `parallel(ref, inputs, { concurrency, options })` | Fan one slot letter out over many inputs, `concurrency` at a time. Failures are captured per item (`{ input, output, ok, error }`), never thrown. `concurrency` must be a positive integer — anything else is a `PizxError('VALIDATION')`. |
| `loop(body, until, maxIterations)` | Run `body(iteration)` up to `maxIterations` times, stopping when `until(result, iteration)` is true. Returns `{ results, iterations, terminatedEarly }`. `maxIterations` must be a positive integer. |
| `slotOptions(opts)` | Extract the subset of a word's options that letters understand, for forwarding to slot calls. |

All seven words are built from these five operators — no new core operators
were needed for any of the article's patterns.

### Errors — one contract for bad usage

Every word (like every letter) reports bad usage through the same machine
readable contract: a `PizxError` with `code: 'VALIDATION'` (exit code `2` in
the CLI) and a human-readable message. The word schemas are the boundary —
invalid options (`vote({ mode: 'bogus' })`, `fleet({ concurrency: 0 })`, …)
are rejected there, before any letter runs. The words add two runtime checks
of their own, same contract:

- `route` with an empty `routes` dict.
- `chain` with **both** `steps` and `stepPrompts` declared (ambiguous — it
  refuses to guess which one you meant).

Count options (`concurrency`, `votes`, `maxIterations`, `maxSteps`,
`maxPasses`, `maxWorkers`) all require ≥ 1. Slot-letter *runtime* failures are
a different category: words capture them per item (✗ in the result text) so
one bad member never sinks the fleet.

### Forwarding options to slot letters

Letters need their own options (α needs `server`, π/Π take `model`, `cwd`,
`system`, …). Pass them to the **word** and forward them with
`ctx.words.slotOptions(opts)` — word schemas are loose, so any letter option
can be passed without declaring it:

```js
await ralph({ execute: 'α', server: ['kiro-cli', 'acp'] })`refactor auth`
await fleet({ worker: 'Π', cwd: 'src' })`fix the bugs`
await vote({ voter: 'π', model: 'deepseek/deepseek-v4-flash', votes: 5 })`review`
```

Recognized keys: `model`, `thinkingLevel`, `thinkingBudgets`, `system`,
`appendSystemPrompt`, `maxTokens`, `timeoutMs`, `maxRetries`, `apiKey`, `cwd`,
`env`, `server`, `tools`, `excludeTools`, `skills`. `quiet` is deliberately
not forwarded — slot calls stay quiet and the word owns its status output.

Alternatively, bind a **pre-configured tag** directly into a slot — the tag
carries its own options, which is how you give *different* letters *different*
models inside one word:

```js
await ralph({ execute: α({ server: ['kiro-cli', 'acp'] }) })`refactor auth`

await route({
  routes: {
    easy: π({ model: 'deepseek/deepseek-v4-flash' }),
    hard: π({ model: 'anthropic/claude-sonnet-4-5' }),
  },
})`…`  // cheap model for easy queries, capable model for hard ones
```

### `slotSchema(defaultRef)`

Exported helper (re-exported from `@topce/pizx`) for authors who build their
own slot fields by hand:

```js
import { slotSchema } from '@topce/pizx'
// equivalent to Schema.union([Schema.string(), Schema.function()]).default(defaultRef)
```

## The word catalog

Each word below has a focused runnable example — `examples/word-*.mjs`
(`word-ralph.mjs`, `word-fleet.mjs`, …) — and `examples/words.mjs` tours all
seven in one script. α fills the agent slots of the same words in
`examples/acp-word-slots.mjs`.

### `ralph` — the iterative agent loop

The canonical word: an analyze → plan → execute → review loop over `loop()`.
Each iteration plans from the analysis, executes through an agent, and the
review decides whether to iterate again.

| Slot | Default | Role |
|---|---|---|
| `analyze` | `π` | Assess the current state against the goal |
| `plan` | `π` | Turn the analysis into a concrete plan |
| `execute` | `Π` | Apply the plan (swap for `'α'` to run any ACP agent) |
| `review` | `π` | Judge the result against the goal; reply `DONE` or `ITERATE` |

| Option | Default | Meaning |
|---|---|---|
| `maxIterations` | `5` | Hard cap on loop passes |

```js
await ralph`improve error handling in src/`
await ralph({ execute: 'α', maxIterations: 3 })`refactor auth`
```

Returns a per-iteration summary (plan + review snippets), the stop reason
(`review said DONE` or `max iterations reached`), and the final result.

### `fleet` — parallel fan-out (sectioning)

Splits the prompt into tasks (bullets/numbered lines, else one per line) and
fans a single worker letter out over them via `parallel()`.

| Slot | Default | Role |
|---|---|---|
| `worker` | `π` | Runs each task (swap for `'Π'`/`'α'` for parallel agents) |

| Option | Default | Meaning |
|---|---|---|
| `concurrency` | `5` | Tasks running at a time |

```js
await fleet`review these files`
await fleet({ worker: 'Π', concurrency: 3 })`fix the bugs in src/`
```

Returns `ok/total succeeded` plus a per-task ✓/✗ list with result snippets.

### `chain` — prompt chaining

Sequential steps where each step consumes the previous step's output — the
article's first workflow. Two ways to declare the steps:

- `steps` — an ordered list of `LetterRef`s (names or tags); each is called
  with the previous step's output. `await chain({ steps: ['outline', 'π'] })`.
- `stepPrompts` — ordered instructions, all run through the `step` slot;
  each instruction is prepended to the running text.
  `await chain({ stepPrompts: ['translate to French', 'make it rhyme'] })`.

Declaring both at once is a `PizxError('VALIDATION')` — the word refuses to
guess which declaration you meant.

| Slot | Default | Role |
|---|---|---|
| `step` | `π` | Runs each `stepPrompts` entry (ignored when `steps` is given) |

| Option | Default | Meaning |
|---|---|---|
| `steps` | `[]` | Ordered `LetterRef`s; output of step N feeds step N+1 |
| `stepPrompts` | `[]` | Ordered instructions run through the `step` slot |
| `gate` | *(none)* | Optional `LetterRef` checked after every step: `PASS` continues, `FAIL` stops the chain and is reported |
| `maxSteps` | `10` | Hard cap on steps |

```js
await chain({ steps: ['outline', 'π'] })`write a document about X`
await chain({ stepPrompts: ['translate to French', 'make it rhyme'] })`a haiku about git`
await chain({ stepPrompts: ['summarize', 'shorten'], gate: 'critic' })`this long report`
```

The gate is the article's "programmatic check" slot: a letter that replies
`PASS`/`FAIL` per intermediate result. (A gate can be a plain code letter —
letters may be pure functions — or an LLM letter.) Returns the per-step log
with gate verdicts, the stop reason, and the final output.

### `route` — routing

Classifies the input into one category and dispatches it to that category's
handler letter. Unplaced inputs fall through to the `fallback` slot.

| Slot | Default | Role |
|---|---|---|
| `classifier` | `π` | Assigns the input to exactly one category |
| `fallback` | `π` | Handles inputs the classifier cannot place |

| Option | Default | Meaning |
|---|---|---|
| `routes` | `{}` | **Required.** Dict of category → `LetterRef` (name or pre-configured tag). Empty is a `PizxError('VALIDATION')`. |
| `categories` | `{}` | Optional dict of category → description fed to the classifier. Defaults to the route keys themselves. A classifier reply that echoes a description maps back to its route. |

```js
await route({ routes: { refund: 'π', tech: 'Π', general: 'π' } })`my order never arrived`

// Human-readable categories for the classifier:
await route({
  routes: { refund: 'ζ', tech: 'η' },
  categories: { refund: 'Refund requests', tech: 'Technical support' },
})`the dashboard shows a blank page`

// Model tiering — the article's cheap/capable split, via pre-configured tags:
await route({
  routes: {
    easy: π({ model: 'deepseek/deepseek-v4-flash' }),
    hard: π({ model: 'anthropic/claude-sonnet-4-5' }),
  },
})`explain monads`
```

Returns a `(routed to '<category>')` note plus the handler's output; unknown
categories return `(no route for '…' — handled by fallback)`.

### `vote` — voting parallelization

Runs the same prompt through one voter letter N times in parallel and tallies
the responses. A strict majority wins outright; otherwise a judge letter
settles the vote.

| Slot | Default | Role |
|---|---|---|
| `voter` | `π` | Answers the prompt (`votes` times, in parallel) |
| `judge` | `π` | Settles split votes: consensus (`majority`) or best pick (`best`) |

| Option | Default | Meaning |
|---|---|---|
| `votes` | `3` | How many voters run |
| `mode` | `'majority'` | `'majority'` — a clear majority wins, the judge synthesizes consensus otherwise; `'best'` — the judge always picks the best answer |
| `concurrency` | `3` | Voters running at a time |

```js
await vote`is this code vulnerable?`
await vote({ votes: 5 })`is this content inappropriate?`
await vote({ mode: 'best', votes: 4 })`write a release note for v2`
```

Returns the vote tally (with duplicate votes marked), the winner and its
margin (`3/5 voters agreed`), or the judge's consensus/best pick. All-failed
runs report each failure.

### `refine` — evaluator-optimizer

One letter generates, another evaluates against explicit criteria, and the
generator revises from the evaluator's feedback until a `PASS` or the pass
budget runs out. The flagship pattern for tasks where iterative refinement
provides measurable value (translation, writing, complex search).

| Slot | Default | Role |
|---|---|---|
| `generate` | `π` | Produces the draft and revises it from feedback |
| `evaluate` | `π` | Judges the draft: `PASS`, or `FAIL` + specific feedback |

| Option | Default | Meaning |
|---|---|---|
| `criteria` | generic quality check | What the evaluator judges against |
| `maxPasses` | `3` | Pass budget |

```js
await refine({ criteria: 'no jargon, under 50 words' })`explain monads`
await refine({ criteria: 'capture nuance and register', maxPasses: 4 })`translate this poem`
```

Returns the pass log (`Pass 1: FAIL — too vague`), the stop reason
(`evaluator said PASS` / `pass budget exhausted`), and the final draft.

### `orchestrate` — orchestrator-workers

A planner letter decomposes the task into independent subtasks, a worker
letter runs each one in parallel, and a synthesizer merges the results. Unlike
`fleet`, the decomposition is model-driven — subtasks aren't predefined.

| Slot | Default | Role |
|---|---|---|
| `planner` | `π` | Breaks the task into subtasks (one per line) |
| `worker` | `π` | Executes each subtask (parallel fan-out) |
| `synthesizer` | `π` | Merges the worker results into the final answer |

| Option | Default | Meaning |
|---|---|---|
| `concurrency` | `5` | Workers running at a time |
| `maxWorkers` | `8` | Hard cap on planner subtasks |

```js
await orchestrate`audit the docs for inconsistencies`
await orchestrate({ worker: 'Π' })`implement the TODOs across src/`
```

Degenerate cases degrade gracefully: a planner that produces no subtasks
runs the task directly on the worker; a single subtask skips the
synthesizer; failed workers are reported and still fed to the synthesizer.
Returns the worker log plus the `Synthesis:` section.

## Composing words into words

Words are letters, so any slot accepts another word — patterns nest:

```js
await ralph({ review: 'fleet' })`refactor auth`           // the reviewer fans out
await chain({ steps: ['ralph', 'fleet'] })`fix the docs`  // a loop, then a fan-out
await route({ routes: { hard: 'ralph', easy: 'π' } })`query`
await orchestrate({ planner: 'π', worker: 'refine' })`polish every doc section`
```

This is the "sentences" step of **letters → words → sentences → a whole
script**: a whole AI pipeline can be one tagged template.

## Defining your own word plugin

```js
// plugins/word.mjs
import Schema from 'schemastery'
export const name = 'my-word'
export const inject = ['words', 'letters', 'llm']
export function apply(ctx) {
  ctx.words.define('Ω', {
    aliases: ['my-word'],
    slots: { worker: 'π' },
    options: { quiet: Schema.boolean().default(false) },
    run: async (prompt, opts, env) => (await env.ctx.words.call(opts.worker, prompt, { quiet: true })).text,
  })
}
export default { name, inject, apply }
```

Load it via `pizx.config.mjs`, exactly like any letter plugin. See
[extension.md](extension.md) for the full plugin API and
`examples/plugins/*.mjs` for the seven complete word implementations.

## Known limits (current scope)

- **`loop` and `parallel` are the only built-in operators.** Every word —
  including the five new ones — is plugin code over `call`/`parallel`/`loop`/
  `slotOptions`. `debate`, `critique`, and `team` are more words over the
  same algebra — future work.
- **`parallel` with an agent worker reuses Π's pooled session.** Fan-out of
  `π` (the default) is isolated per call; parallel `Π`/`α` workers share
  their letter's session and are not yet given isolated sub-contexts. Use
  `π` workers for pure parallelism today.
- **Words default to non-cacheable.** A pure word (all slots text letters,
  e.g. `fleet` with `π` workers) can opt in with `cacheable: true`.
- **Slot letters run quietly by convention.** Words own their status output
  (stderr); slot calls get `quiet: true` and the word's result text carries
  the summary.
