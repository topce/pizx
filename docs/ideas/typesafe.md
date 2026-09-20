# TypeSafe Primitives (letters) + Patterns (words) for pizx

> **Status: implemented.** The shipped design and reference live in
> [docs/typesafe.md](../typesafe.md); runnable examples are
> `examples/typesafe-*.mjs` and `examples/word-{fanout,composite,gate,intent}.mjs`.
> This document is the original design brief — kept for the rationale and
> trade-offs. Divergences from the brief: `gate`/`intent` take declarative
> `criteria` + `routes`/`intents` (no builder re-exports), and both the letters
> and the pure words are cacheable.

## Problem Statement

How might we expose TypeSafe's three calibrated System One questions as pizx
**letters** and its four architectural patterns as pizx **words** — so a script
can make fast, typed, confidence-aware decisions inline with `π`/`Π`/`α`,
batched into single calls, without hand-parsing LLM prose — all wired as cordis
plugins over one shared `typesafe` service?

## Recommended Direction

TypeSafe is the near-perfect mirror of pizx's own grammar: **primitives are
atomic, patterns are compositions.** So primitives become letters and patterns
become words, and both sit on a new `ctx.typesafe` cordis `Service` that wraps
the official [`@typesafe-ai/sdk`](https://docs.typesafe.ai/sdk/javascript)
(`TypeSafeClient.systemOne({ state, questions, model })` → `{ answers, model,
usage }`). The service owns auth (`TYPESAFE_API_KEY`), the default model
(`jev-latest`), retries, and — critically — trace recording, so every TypeSafe
call shows up in `LetterOutput` tokens/cost and the JSONL log like any LLM call.

**The one hard decision: eager letters, batched words.** pizx letters are
one-tag-one-call (`LetterOutput`, one trace span), while TypeSafe's entire value
is one call → many parallel questions. We resolve it by layering: each primitive
letter makes one focused `systemOne` call and is usable standalone *exactly like
`π`*; the pattern words own the batching by calling `ctx.typesafe.ask(state,
questions)` **directly** with a whole question map in a single call. This keeps
"letters are atomic" true, keeps TypeSafe's cost/speed advantage real, and gives
primitives and patterns one consistent shape: **template body = `state`,
options = the judgment.**

Primitives are cacheable (`cacheable: true`): a TypeSafe answer is a pure
function of `(state, questions, model)`, so the existing result cache is a
near-perfect fit and a large honest win over generative letters. Pure pattern
words (`fanout`, `composite`) are cacheable too; routing words (`gate`,
`intent`) invoke handlers and stay uncached.

### Mapping

| TypeSafe | pizx | Kind | Where |
|---|---|---|---|
| `systemOne()` / `TypeSafeClient` | `ctx.typesafe` | Service | `src/core/typesafe.ts` |
| `noul` primitive | `noul` | letter | `src/plugins/typesafe.ts` |
| `choice` primitive | `choice` | letter | `src/plugins/typesafe.ts` |
| `score` primitive | `score` | letter | `src/plugins/typesafe.ts` |
| Speculative Fan-Out | `fanout` | word | `examples/plugins/fanout.mjs` |
| Confidence-Gated Routing | `gate` | word | `examples/plugins/gate.mjs` |
| Composite Scoring | `composite` | word | `examples/plugins/composite.mjs` |
| Intent Routing | `intent` | word | `examples/plugins/intent.mjs` |

### Letter contracts (primitives)

The template body is the **state**; `instructions` is the question. (Structured
state must be passed via the `state` option — see assumption A1.)

```js
await noul({ instructions: 'Does the customer request a refund?' })`${ticket}`
await choice({ instructions: 'Which team?', criteria: { billing: '…', technical: '…' } })`${ticket}`
await score({ instructions: 'How frustrated?', criteria: ['calm', 'civil', 'angry'] })`${ticket}`
```

Each returns a `LetterOutput`:
- `.text` — the usable scalar: `choice` → the label, `score` → number,
  `noul` → probability (`"0.87"`).
- `.answer` — the full typed TypeSafe answer (`choice`/`score`/`noul`,
  `confidence`, `probabilities`, `legend`). New optional field on
  `LetterOutput` in `src/core/tags.ts`; words read it, `--json` serializes it.

Options: `instructions`, `criteria`, `state`, `model`, `quiet`, plus the shared
`confirm`/tracing surface. Aliases `Choice`/`Score`/`Noul` (matching `pi`/`Pi`).

### Word contracts (patterns)

```js
// Speculative Fan-Out — many questions, one call; code filters.
await fanout({
  questions: {
    category: { type: 'choice', instructions: '…', criteria: { … } },
    severity: { type: 'score',  instructions: '…', criteria: [ … ] },
    refund:   { type: 'noul',   instructions: '…' },
  },
})`${ticket}`                       // .answer = { category, severity, refund }

// Composite Scoring — atomic scores + weights in code.
await composite({
  dimensions: {
    python:  { instructions: '…', criteria: [ … ], weight: 0.4 },
    design:  { instructions: '…', criteria: [ … ], weight: 0.4 },
    lead:    { instructions: '…', criteria: [ … ], weight: 0.2 },
  },
})`${resume}`                       // .answer = { score, parts }

// Confidence-Gated Routing — what + whether-to-act.
await gate({
  instructions: 'What is the user requesting?',
  criteria: { check_balance: '…', approve_transfer: '…', other: '…' },
  routes: { check_balance: 'showBalance', approve_transfer: 'approveTransfer',
            other: 'Π' },
  thresholds: { approve_transfer: 0.85 },
  floor: 0.6,
  escalate: 'supportAgent',         // slot: handler for confidence < floor
})`${command}`

// Intent Routing — classify, then dispatch (deterministic / LLM / human).
await intent({
  instructions: 'What does the user want?',
  criteria: { refund: '…', technical: '…' },
  intents: { refund: 'billingFlow', technical: 'Π', unknown: 'human' },
})`${query}`
```

Word names preserve the existing library untouched; aliases carry the doc
titles (`fan-out`, `confidence-routing`, `composite-scoring`, `intent-routing`).
Handlers are `LetterRef`s (`'π'`, `'Π'`, a pre-configured tag), so `gate`/
`intent` compose with the rest of the word library.

### Implementation map

```
src/core/typesafe.ts            TypeSafe Service (client, ask(), models(), trace emit)
src/plugins/typesafe.ts         cordis plugin: mount service + register the 3 letters
src/core/tags.ts                + optional `answer` on LetterOutput
src/core/context.ts             mount typesafePlugin alongside pi/acp/epsilon
src/core/default-app.ts         forward ∀ tags choice/score/noul (+ globals.ts)
examples/plugins/{fanout,gate,composite,intent}.mjs   word plugins (pizx.config.mjs)
examples/typesafe.mjs + examples/word-*.mjs           runnable examples
docs/typesafe.md + AGENTS.md/README/llms.txt tables   docs
```

## Key Assumptions to Validate

- [ ] **A1 — Object interpolation is broken today.** `build()` in
  `src/core/utils.ts` uses `String(arg)`, so `` noul`${obj}` `` yields
  `[object Object]`. *Test:* confirm; then rely on the `state` option for
  structured state (document `JSON.stringify` as the workaround). Decide later
  whether `build` should JSON-stringify non-strings.
- [ ] **A2 — State-as-template-body reads well.** *Test:* write the same 3
  scripts with body=state vs body=instructions; pick the clearer.
- [ ] **A3 — Batching in words, not letters, doesn't hurt DX.** *Test:* the
  fan-out example should need exactly one API call for 5 questions.
- [ ] **A4 — TypeSafe answers are stable enough to cache.** *Test:* same call
  twice; second `.isFromCache === true`.
- [ ] **A5 — `answer` on `LetterOutput` is non-breaking.** *Test:* `--json`,
  trace export, `toString()`, cache round-trip.
- [ ] **A6 — Cost/trace mapping is correct.** *Test:* Jev charges per input
  token; map `usage` → `LlmCallEvent` and verify `totalCost` from the $0.042/Mtok
  price.
- [ ] **A7 — Users have `TYPESAFE_API_KEY`.** *Test:* missing key fails like π
  without `pi auth login` (AUTH, code 3, actionable message).

## MVP Scope

**In:** the `typesafe` service + `choice`/`score`/`noul` letters (typed
`answer`, cache, trace, `--json`); all four pattern words; `ctx.typesafe.ask`
public; one example script + one example per word; docs and table updates; tests
mirroring `src/core/examples-words.test.ts`.

**Out (deferred):** modifying existing words to be TypeSafe-aware; SDK builder
re-exports; a custom HTTP client; streaming.

## Not Doing (and Why)

- **Lazy question-builder tags** — primitives stay eager so `` noul`…` `` works
  standalone like `π`; batching is the words' job.
- **`.stream` on TypeSafe letters** — answers are atomic, not token streams.
- **Re-exporting `choice()`/`score()`/`noul()` from the SDK as globals** —
  collides with the letter names; pattern words take declarative specs instead.
- **Retrofitting `route`/`fleet`/`vote`/`refine`** — avoid churn; `intent` is the
  TypeSafe-specific router. (Revisit if `intent` proves redundant.)
- **Putting TypeSafe under `ctx.llm`** — it is not a chat completion; a separate
  service keeps the seam honest.
- **Images / non-text state** — Jev is text-only.
- **Magic confidence defaults** — thresholds are explicit and documented; model
  pinning (`jev-1.13.0`) is config because thresholds are version-sensitive.

## Open Questions

- Exit code for API failures: new `TYPESAFE = 9`, or reuse `INTERNAL`/`AUTH`?
- Should `fanout` render a text summary or always JSON in `.text`?
- Is `gate` distinct enough from `chain`'s `gate` option and `confirm` to keep
  its name?
- Does `intent` earn its place next to the existing `route`, or should `route`
  gain a TypeSafe classifier slot instead?
