# pizx Examples

Every script here does a **real job on this repository** — it reads the actual
git history, the actual `package.json`, the actual source files — so the
prompts reflect what you would write, not a stand-in.

They are ordered simplest → most complex: **five levels**, and each script ends
its header with a `level n/5` line plus pointers to the previous and next
example. Read them in order, or jump to the level you need.

Run any of them with `pizx <file>` or `npm run example:<name>`.

---

## Level 1 — one call, one question

The smallest useful pizx scripts. A shell command gathers evidence, one letter
reasons about it.

| # | Script | What it does |
|---|---|---|
| 1 | `quick-ask.mjs` | One π call: fact-check the last commit message against its diff |
| 2 | `release-notes.mjs` | `git log` → π → writes `RELEASE-NOTES.md` |

```bash
pizx examples/quick-ask.mjs
pizx examples/release-notes.mjs
COMMIT=HEAD~1 pizx examples/quick-ask.mjs      # any commit
SINCE=v1.4.0 pizx examples/release-notes.mjs   # any range
```

Concepts: interpolating shell output into a prompt, `.quiet`, reading
`LetterOutput.text`.

## Level 2 — composing the shell, models, and agents

| # | Script | What it does |
|---|---|---|
| 3 | `hello-pizx.mjs` | `$` + π + Π: draft a commit subject, have an agent verify it |
| 4 | `typed-globals.mjs` | A pre-release check that parses the model's JSON and sets the exit code |
| 5 | `basic-capital-pi.mjs` | Π runs the test suite, then triages it (or reports coverage gaps) |
| 6 | `trace-and-cache.mjs` | The same call twice — second one served from `.pizx/cache`, proven by the trace |

```bash
pizx examples/hello-pizx.mjs
pizx examples/typed-globals.mjs
pizx examples/basic-capital-pi.mjs
pizx --cache --trace --export-log examples/trace-and-cache.mjs
```

Concepts: branching on a model's answer, typed globals, read-only agent tool
lists, caching and JSONL traces.

## Level 3 — extending the letters

| # | Script | What it does |
|---|---|---|
| 7 | `custom-letter.mjs` | Defines Ξ (commit messages) as a plugin, then uses it |
| 8 | `epsilon-basic.mjs` | ε: run any CLI AI harness (`claude`, `kiro`, …) on the current diff |
| 9 | `acp-basic.mjs` | α: run any ACP agent, with a pass/fail gate and streaming |

```bash
pizx examples/custom-letter.mjs
pizx examples/epsilon-basic.mjs
pizx examples/acp-basic.mjs
pizx --letters examples/custom-letter.mjs      # Ξ listed with π/Π/α/ε
```

Concepts: the cordis plugin contract (`ctx.letters.define`), schemastery
options, and the two "bring your own agent" letters. Sections that need an
external agent explain themselves and skip if it is missing.

## Level 4 — the AI patterns (words), part 1

| # | Script | Word | What it does |
|---|---|---|---|
| 10 | `word-fleet.mjs` | `fleet` | One commit subject per changed file, in parallel |
| 11 | `word-chain.mjs` | `chain` | Distil the release notes, then write the announcement |
| 12 | `word-route.mjs` | `route` | Triage a support request; per-route prompts and models |
| 13 | `word-vote.mjs` | `vote` | Three independent audits, then a judged headline |
| 14 | `word-refine.mjs` | `refine` | A README tagline refined against hard criteria |

```bash
pizx examples/word-fleet.mjs
pizx examples/word-chain.mjs
pizx examples/word-route.mjs
pizx examples/word-vote.mjs
pizx examples/word-refine.mjs
```

Concepts: slots and slot replacement (`worker: 'Π'`), pre-configured letter
tags as handlers, gates, and the cost of N-way fan-out.

## Level 5 — agents and orchestration

| # | Script | What it does |
|---|---|---|
| 15 | `word-ralph.mjs` | The agent loop fixes a failing module in a scratch dir — and the script re-runs the test to check |
| 16 | `word-orchestrate.mjs` | Planner decomposes the commit history, workers write bullets, synthesizer merges |
| 17 | `words.mjs` | The whole word library in one tour |
| 18 | `acp-word-slots.mjs` | α agents filling word slots, writing into a scratch directory |

```bash
pizx examples/word-ralph.mjs
pizx examples/word-orchestrate.mjs
pizx examples/words.mjs
pizx examples/acp-word-slots.mjs
```

Concepts: giving the `review` slot real tools so the loop's exit condition is
trustworthy, scratch directories for mutable demos, and objective pass/fail
verification with `node --test` instead of trusting a summary.

## Level 6 — TypeSafe: typed, calibrated decisions

TypeSafe turns a model's judgment into a typed value with confidence and
probabilities. Its three primitives are letters; its four architectural
patterns are words. Requires `TYPESAFE_API_KEY`
([get one](https://console.typesafe.ai/keys)) and pi credentials for the
handler steps.

| # | Script | Letter/word | What it does |
|---|---|---|---|
| 19 | `typesafe-primitives.mjs` | `noul`/`choice`/`score` | State + question → typed answers; branch in code |
| 20 | `word-fanout.mjs` | `fanout` | Five speculative questions in one System One call |
| 21 | `word-composite.mjs` | `composite` | Weighted resume scoring across four dimensions |
| 22 | `word-gate.mjs` | `gate` | Approve a transfer only above a confidence threshold |
| 23 | `word-intent.mjs` | `intent` | Classify, then dispatch to the best handler |
| 24 | `typesafe-service.mjs` | `ctx.typesafe` | Call the service directly with structured state + confidence gating |
| 25 | `typesafe-cache.mjs` | `.cache` | Identical question → cache hit; typed answer preserved |
| 26 | `typesafe-custom-letter.mjs` | `app.define` | Build your own TypeSafe-backed letter on the public service |

```bash
TYPESAFE_API_KEY=… pizx examples/typesafe-primitives.mjs
TYPESAFE_API_KEY=… pizx examples/word-fanout.mjs
TYPESAFE_API_KEY=… pizx examples/word-composite.mjs
TYPESAFE_API_KEY=… pizx examples/word-gate.mjs
TYPESAFE_API_KEY=… pizx examples/word-intent.mjs
TYPESAFE_API_KEY=… pizx examples/typesafe-service.mjs
TYPESAFE_API_KEY=… pizx examples/typesafe-cache.mjs
TYPESAFE_API_KEY=… pizx examples/typesafe-custom-letter.mjs
```

Concepts: the template body is the *state*, `instructions` is the question;
`.text` is the scalar and `.answer` is the structured result; one API call
answers many questions in parallel; confidence as a second decision axis.
Reference: [docs/typesafe.md](../docs/typesafe.md).

---

## Quick queries (no script at all)

```bash
pizx -p "what is 7! + 5?"
git diff | pizx -p "write a conventional-commit subject for this diff"
pizx -p "summarize this" --json | jq -r .text
pizx --run --run-harness claude "review this diff"
pizx --acp --acp-server "kiro-cli acp" "list the source files"
```

## The word plugins (AI patterns)

Each word is a self-contained cordis plugin built on the `ctx.words` service
(see [docs/words.md](../docs/words.md) for the full reference). Their only
imports are `schemastery` and `@topce/pizx` (for `PizxError`) — both resolve
against a local install. Bad usage is reported as `PizxError` with
`code: 'VALIDATION'` (CLI exit code `2`), matching the rest of pizx.

| Plugin | Word | Pattern |
|---|---|---|
| `plugins/commit.mjs` | `Ξ` (`commit`) | Commit subject from a diff (example user letter) |
| `plugins/ralph.mjs` | `ralph` (`loop`) | Agent loop — iterative analyze/plan/execute/review |
| `plugins/fleet.mjs` | `fleet` (`parallel`) | Parallelization: sectioning — split prompt, fan out |
| `plugins/chain.mjs` | `chain` (`pipeline`) | Prompt chaining — sequential steps + optional gate |
| `plugins/route.mjs` | `route` (`branch`) | Routing — classify, then dispatch |
| `plugins/vote.mjs` | `vote` (`jury`) | Voting — N parallel answers, tallied |
| `plugins/refine.mjs` | `refine` (`optimize`) | Evaluator-optimizer — revise until PASS |
| `plugins/orchestrate.mjs` | `orchestrate` (`director`) | Orchestrator-workers — decompose, fan out, synthesize |

`pizx.config.mjs` loads all of them, which is why the words are globals in
these scripts.

## Two things that bite everyone

**Reasoning models spend `maxTokens` on thinking.** On a reasoning model
(`deepseek-v4-flash` is one) the token budget covers thinking *and* the reply,
so a tight budget can be consumed entirely before any text is produced — you
get an empty string, not an error. Examples that depend on a reply therefore
either pass a generous `maxTokens` or retry with headroom:

```js
const reply = await π.quiet({ model, maxTokens: 16384 })`…`
if (!reply.text.trim()) { /* raise the budget, or retry */ }
```

**Worker results are truncated.** `fleet` and `orchestrate` show each worker's
answer at 200 characters and are built for many *small* results (subjects,
verdicts, labels). For long-form output per item, use `refine` or `chain`, or
call the letter yourself in a loop.

Also worth knowing:

- `$` quotes interpolations for the shell. For arguments containing spaces
  (e.g. git format strings), pre-quote with zx's `quote`.
- `Π`, `α`, and `ε` are never cached — they touch the filesystem. π calls are.
- Examples that need credentials or an external agent skip themselves with a
  one-line explanation rather than failing halfway.
