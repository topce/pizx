# π (small pi) — AI Text Generation

Small pi: call pi-ai for text generation as a zx-style template tag. π is a
**letter** — the same mechanism user plugins use — registered by the built-in
`pizx-pi` plugin on `ctx.letters`.

## Usage

```js
// Basic template literal
const answer = await π`what is 7! + 5?`
console.log(answer.text)

// Options via chaining (validated by a schemastery schema)
const explanation = await π({ model: 'anthropic/claude-sonnet-4-5' })`explain async/await`

// Quiet mode — suppress stdout streaming
const json = await π.quiet()`generate a JSON array of 5 colors`

// Streaming
for await (const chunk of π.stream`tell me a story`) process.stdout.write(chunk)

// Local result cache (also enabled app-wide / via pizx --cache)
const cached = await π.cache()`a repeatable answer`
cached.fromCache // true on the second identical call
```

## Options

| Option | Type | Default | Notes |
|---|---|---|---|
| `model` | string | provider default | e.g. `anthropic/claude-sonnet-4-5` |
| `thinkingLevel` | `'off' \| 'minimal' \| 'low' \| 'medium' \| 'high' \| 'xhigh' \| 'max'` | `'medium'` | reasoning effort |
| `thinkingBudgets` | dict | — | token budgets per thinking level |
| `maxTokens` | number | `4096` | |
| `system` / `appendSystemPrompt` | string | — | system context |
| `quiet` | boolean | `false` | suppress stdout streaming |
| `timeoutMs` / `maxRetries` | number | provider default | resilience |
| `apiKey` | string | env | bypass credential lookup |
| `cache` | boolean | app setting | local result cache |
| `confirm` | `true \| { semi } \| { hitl } \| { auto }` | off | human-in-the-loop gate |

## Result — `LetterOutput`

`text`, `modelId` (alias `modelUsed`), `isFromCache` (alias `fromCache`),
`startTime`/`endTime`/`duration`, and token/cost getters (`inputTokens`,
`outputTokens`, `cacheReadTokens`, `cacheWriteTokens`, `totalTokens`,
`totalCost`) summed from the invocation's trace. Coerces to its text
(`toString`, `valueOf`, template literals).

## How it works

The letter builds a pi-ai context from your prompt, streams deltas to stdout
(unless quiet), and records usage into the active trace span — see
[Trace & logs](trace.md).

## The service — `ctx.llm`

π is a thin letter over the `Llm` service: it picks a model with
`ctx.llm.pick()` and streams through `ctx.llm.stream()`. The same service
reaches Pi's **non-chat** models — classifiers and image generators — through
four methods:

| Method | Returns | Notes |
|---|---|---|
| `ctx.llm.modelsOfType(type, provider?)` | `Promise<readonly ModelTypeMap[T][]>` | every known model of `type`, optionally restricted to one `provider`; credentials are not checked |
| `ctx.llm.pickOfType(type, preferred?)` | `Promise<ModelTypeMap[T] \| undefined>` | `preferred` as `provider/id`, else a bare `id`; with no match, or no `preferred`, the first model of that type with working credentials; `undefined` when none is credentialed |
| `ctx.llm.classify(model, context, options?)` | `Promise<ClassifierResult>` | `context` is `{ state, questions, images? }` |
| `ctx.llm.generateImages(model, context, options?)` | `Promise<AssistantImages>` | `context` is `{ input }` — text and/or image blocks |

`type` is a Pi `ModelType` (`'classifier'` \| `'image'` \| `'chat'`; chat models
are what `pick()` returns). `options` are the pi-ai request options — `apiKey`,
`signal`, `onPayload`/`onResponse`, plus `temperature` for classifiers and
`metadata` for images. The `ModelType`/`ModelTypeMap` and result types are
pi-ai's: import them from `@earendil-works/pi-ai` (pizx does not re-export
them).

`ClassifierResult` carries `answers` (one typed answer per question — `choice`,
`score`, or `bool`), `provider`, `model`, `usage?`, `stopReason`, and
`errorMessage?`. `AssistantImages` carries `output` (text and image blocks,
`{ type: 'image', data, mimeType }`), `provider`, `model`, `usage?`,
`stopReason`, and `errorMessage?`.

`classify` and `generateImages` resolve credentials **at request time** and
never reject on a provider failure: the result carries `stopReason` (`'stop'` |
`'error'` | `'aborted'`) and, on failure, `errorMessage`. Check `stopReason`
before reading `answers` (classifier) or `output` (images). When the service
reports usage, the call is recorded as an `llm-call` in the active span, billed
to the `provider`/`model` that answered.

```js
import { createPizx } from '@topce/pizx'

const app = await createPizx()

// Classification — `provider/id` first, else the first credentialed classifier.
const judge = await app.ctx.llm.pickOfType('classifier', 'typesafe/jev-latest')
if (!judge) throw new Error('no classifier model has credentials')

const verdict = await app.ctx.llm.classify(judge, {
  state: { message: 'The change works, thanks.' },
  questions: {
    approved: {
      type: 'bool',
      instructions: 'Does the user approve of the result?',
      criteria: { true: 'Approval', false: 'No approval' },
    },
  },
})
if (verdict.stopReason !== 'stop') throw new Error(verdict.errorMessage ?? 'classify failed')
verdict.answers.approved.probability      // 0…1

// Images — preferred model, else the first credentialed image model.
const painter = await app.ctx.llm.pickOfType('image', 'openrouter/google/gemini-2.5-flash-image')
if (!painter) throw new Error('no image model has credentials')

const generated = await app.ctx.llm.generateImages(painter, {
  input: [{ type: 'text', text: 'A red fox in the snow, watercolor' }],
})
if (generated.stopReason !== 'stop') throw new Error(generated.errorMessage ?? 'generation failed')
for (const block of generated.output) {
  if (block.type === 'image') console.log(block.mimeType, block.data)  // base64
}

// Discovery — every image model, or one provider's classifiers.
await app.ctx.llm.modelsOfType('image')
await app.ctx.llm.modelsOfType('classifier', 'typesafe')

await app.dispose()
```
