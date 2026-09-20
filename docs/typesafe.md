# TypeSafe — typed, calibrated decisions (`choice` / `score` / `noul` + pattern words)

pizx ships a [TypeSafe](https://docs.typesafe.ai) integration: the three System
One **primitives** as letters, and TypeSafe's four architectural **patterns** as
words. Both build on one `ctx.typesafe` service, so a whole batch of questions
shares a single `POST /v1/systemone` request, one trace span, and one cache key.

TypeSafe's grammar mirrors pizx's own: primitives are atomic (letters), patterns
are compositions (words).

| TypeSafe | pizx | Kind | Name |
|---|---|---|---|
| `choice` primitive | letter | `choice` (`Choice`) | pick one label from a fixed set |
| `score` primitive | letter | `score` (`Score`) | position on an ordered rubric |
| `noul` primitive | letter | `noul` (`Noul`) | probability a yes/no statement is true |
| Speculative Fan-Out | word | `fanout` (`fan-out`) | many questions, one call |
| Confidence-Gated Routing | word | `gate` (`confidence-routing`) | act by confidence threshold |
| Composite Scoring | word | `composite` (`composite-scoring`) | weighted multi-score combination |
| Intent Routing | word | `intent` (`intent-routing`) | classify and dispatch |

## Setup

```bash
export TYPESAFE_API_KEY=…   # https://console.typesafe.ai/keys
```

The `@typesafe-ai/sdk` module is imported lazily and the client is built on
first use, so apps that never touch TypeSafe boot without a key and without
loading the SDK. Programmatic config:

```js
const app = await createPizx({
  typesafe: { apiKey, baseURL, defaultModel: 'jev-1.13.0', timeoutMs: 10_000 },
})
```

## The service — `ctx.typesafe`

`TypeSafe` is a cordis `Service` wrapping the official
[`@typesafe-ai/sdk`](https://docs.typesafe.ai/sdk/javascript).

```js
const result = await ctx.typesafe.ask(
  { ticket: { subject: 'Duplicate charge' } },          // state
  {
    refund: { type: 'noul', instructions: 'Is a refund requested?' },
    team:   { type: 'choice', instructions: 'Which team?', criteria: { billing: '…', tech: '…' } },
    anger:  { type: 'score', instructions: 'How frustrated?', criteria: ['calm', 'angry'] },
  },
  { model: 'jev-1.13.0' }
)
result.answers.refund.noul      // 0.99
result.answers.team.choice      // 'billing'
result.model                    // 'jev-1.13.0' — the versioned model that answered
```

Every call is recorded as an `llm-call` trace event: `inputTokens` from the
response usage and `costUsd` from Jev's input-token price ($42/Btok = $0.042/Mtok;
output tokens are free). `ctx.typesafe.listModels()` lists the account's models.
`ctx.typesafe.available` is true when a key (or an injected client) is present.

## Primitive letters

### Input rule

The **template body is the `state`** (what is being judged); the
`instructions` option is the question. When `instructions` is omitted the body
is used as the question instead, so a bare question works.

```js
await noul({ instructions: 'Does the customer request a refund?' })`${ticket}`
await noul`Is this urgent?`                     // body = question, state = null
await noul({ instructions: 'Is this urgent?', state: structured })`…`
```

> pizx interpolates with `String()`, so `` noul`${obj}` `` renders
> `[object Object]`. Pass structured state through the `state` option.

### Options

| Option | Applies to | Meaning |
|---|---|---|
| `instructions` | all | the question (string, object, or array) |
| `state` | all | structured state; overrides the template body |
| `criteria` | `choice`, `score`, `noul` | Choice: label → description map · Score: ordered levels (≥2) · Noul: optional `{ true, false }` |
| `model` | all | TypeSafe model override |
| `timeoutMs` | all | per-attempt timeout |
| `quiet` | all | suppress printing the result |
| `confirm` | all | confirmation gate before sending state (`true` \| `{ semi }` \| `{ hitl }` \| `{ auto }`) |

### The result

`.text` is the usable scalar (label / number / probability); `.answer` is the
full typed TypeSafe answer, and **both survive the result cache**.

| Letter | `.text` | `.answer` |
|---|---|---|
| `noul` | probability, e.g. `"0.99"` | `{ type, noul }` |
| `choice` | the label, e.g. `"billing"` | `{ type, choice, confidence, probabilities }` |
| `score` | the score, e.g. `"1.01"` | `{ type, score, confidence, legend, probabilities }` |

```js
const refund = await noul({ instructions: 'Is a refund requested?' })`${ticket}`
refund.text                       // "0.99"
refund.answer.noul                // 0.99
refund.answer.confidence          // undefined — Noul has no separate confidence
if (refund.answer.noul > 0.8) echo('likely refund')
```

`noul` and the pure words are **cacheable**: a TypeSafe answer is a pure
function of `(state, questions, model)`, so `.cache` skips the API call
entirely. `--json` results include the structured `answer`.

## Pattern words

Each is a plugin in [`examples/plugins/`](../examples/plugins) loaded through
`pizx.config.mjs`. `.answer` on every word carries its structured result.

### `fanout` — Speculative Fan-Out

Ask many questions — speculative ones included — in one call; filter in code.

```js
const out = await fanout({
  questions: {
    category: { type: 'choice', instructions: '…', criteria: { … } },
    severity: { type: 'score',  instructions: '…', criteria: [ … ] },
    refund:   { type: 'noul',   instructions: '…' },
  },
})`${ticket}`
out.answer.category.choice
```

Options: `questions` (required), `pick` (subset of answer names), `model`.
Cacheable. `.answer` = the answers map.

### `composite` — Composite Scoring

Score independent dimensions, normalize to 0–1, combine with weights.

```js
const out = await composite({
  dimensions: {
    python: { instructions: '…', criteria: [ … ], weight: 0.4 },
    design: { instructions: '…', criteria: [ … ], weight: 0.4 },
    lead:   { instructions: '…', criteria: [ … ], weight: 0.2 },
  },
})`${resume}`
out.answer.score                  // weighted 0–1
out.answer.parts.python           // { score, normalized, weight, contribution, confidence }
```

Options: `dimensions` (required), `weights` (overrides), `normalize` (default
true), `model`. Cacheable.

### `gate` — Confidence-Gated Routing

The answer says *what*; confidence says *whether to act*.

```js
const out = await gate({
  instructions: 'What action is the user requesting?',
  criteria: { check_balance: '…', approve_transfer: '…', other: '…' },
  routes: { check_balance: 'showBalance', approve_transfer: 'approveTransfer' },
  thresholds: { approve_transfer: 0.85 },
  floor: 0.6,
  escalate: 'supportAgent',
})`${command}`
out.answer.escalated              // true when below floor or the action's threshold
out.answer.handledBy
```

Handlers are `LetterRef`s (names or tags). Options: `instructions`, `criteria`
(required), `routes`, `thresholds`, `floor`, `escalate`, `classifierModel`,
`model`. Not cacheable.

> **Model options:** the TypeSafe question uses `classifierModel` (defaults to
> the service default). `model` is forwarded to the handler letters, like every
> word in the library — so `gate({ routes: { x: 'π' }, classifierModel: 'jev-1.13.0', model: 'claude-sonnet-4-5' })`
> classifies with Jev and handles with a specific Claude model.

### `intent` — Intent Routing

Classify, then dispatch to deterministic logic, a specialist LLM, or a human.

```js
const out = await intent({
  instructions: 'What does the user want?',
  criteria: { refund: '…', technical: '…' },
  intents: { refund: 'billingFlow', technical: 'Π' },
  fallback: 'human',
  floor: 0.6,
  escalate: 'human',
})`${query}`
```

Options: `instructions`, `criteria` (required), `intents`, `fallback`,
`escalate`, `floor`, `classifierModel`, `model`. Not cacheable. (`gate` differs
by applying a per-action threshold; `intent` uses one floor. `classifierModel`
and `model` work as they do for `gate`.)

## Errors

| Cause | `PizxError.code` | Exit code |
|---|---|---|
| missing/invalid API key | `AUTH` | 3 |
| bad request / criteria | `VALIDATION` | 2 |
| rate limit, connection, timeout, 5xx | `TYPESAFE` | 9 |
| cancelled via `confirm` | `CANCELLED` | 6 |

Branch on `err.code`, never message text. See [trace & logs](trace.md) for the
`llm-call` event shape.

## Examples

- [`examples/typesafe-primitives.mjs`](../examples/typesafe-primitives.mjs)
- [`examples/typesafe-service.mjs`](../examples/typesafe-service.mjs) — the service, structured state, confidence gating, tracing
- [`examples/typesafe-cache.mjs`](../examples/typesafe-cache.mjs) — caching, and the typed answer surviving a hit
- [`examples/typesafe-custom-letter.mjs`](../examples/typesafe-custom-letter.mjs) — build your own TypeSafe-backed letter
- [`examples/word-fanout.mjs`](../examples/word-fanout.mjs)
- [`examples/word-composite.mjs`](../examples/word-composite.mjs)
- [`examples/word-gate.mjs`](../examples/word-gate.mjs)
- [`examples/word-intent.mjs`](../examples/word-intent.mjs)
