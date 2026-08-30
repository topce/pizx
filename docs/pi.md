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
| `thinkingLevel` | `'off' \| 'minimal' \| 'low' \| 'medium' \| 'high' \| 'xhigh'` | `'medium'` | reasoning effort |
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
