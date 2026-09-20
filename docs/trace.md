# Tracing & Log Export

Every pizx run is traceable. A **run** gets a unique `runId` and a flat,
append-only event list; letters open **spans**, and every LLM call, cache
operation, and error inside them is attributed by span id (tracked through
AsyncLocalStorage, so concurrent letters never interleave).

## Events

| kind | carries |
|---|---|
| `run-start` / `run-end` | `runId`, node/pizx versions, aggregate `totals` |
| `letter-start` / `letter-end` | `spanId`, `parentSpanId`, letter name, prompt, status, output preview, duration |
| `llm-call` | `modelId`, `inputTokens`, `outputTokens`, `cacheReadTokens`, `cacheWriteTokens`, `totalTokens`, `costUsd`, `durationMs` |
| `tool-call` | ACP agent (α) tool activity — `server`, `toolCallId`, `title`, `status` |
| `cache-hit` / `cache-miss` | the content-addressed cache `key` |
| `error` | message, optional `spanId` |

Token counts are **disjoint** (deepseek-harness convention): `inputTokens` is
uncached input only; prompt-cache reads/writes are reported separately, so a
trace shows exactly how cache-friendly a run was.

TypeSafe calls record an `llm-call` too (input tokens and cost at Jev's
input-token price). Inside a letter or word it attaches to that span; a direct
`ctx.typesafe.ask()` has no active span, so it is recorded run-scoped with span
id `typesafe` — the totals always include it. See
[docs/typesafe.md](typesafe.md).

## Exporting

```bash
pizx --export-log script.mjs            # .pizx/logs/<runId>.jsonl
pizx --export-log /tmp/run.jsonl script.mjs
pizx --trace script.mjs                 # human summary on stderr
```

JSONL is one event per line, in emit order, ending with `run-end` (flushed in
a `finally` — a crashing script still exports its trace). Programmatically:

```js
const app = await createPizx()
await app.π`hello`
app.exportLog('jsonl')          // string, one event per line
app.exportLog('json')           // { runId, totals, events }
await app.flushLog('run.jsonl') // atomic write
console.log(app.traceSummary())
await app.dispose()
```

`Output.trace` on every result gives the LLM calls of that invocation, and
totals are aggregated from events — the same source the export uses.

## Writing your own exporter

Trace events also flow through cordis events, so an exporter is just a plugin:

```js
export const inject = ['trace']
export function apply(ctx) {
  ctx.on('pizx/trace', (event) => {
    // forward, filter, aggregate — anything
  })
}
```

## Cache-hit friendliness

- **Observability** — every `llm-call` records provider prompt-cache
  read/write tokens, and `--trace` prints the cache hit ratio. α (ACP)
  invocations record `tool-call` events per agent tool update and an
  `llm-call` when the agent reports usage, so external agents are as
  observable as π/Π.
- **Stable prompts** — letters share one agent session per model/tools (Π),
  so provider caches stay warm across invocations.
- **Local result cache** — cacheable letters with `cache: true` (or
  `--cache` / `PIZX_CACHE=1`) get a content-addressed key
  (`sha256(letter | model | system | prompt | cache-relevant opts)`); hits
  skip the LLM entirely and are recorded as `cache-hit` with
  `output.isFromCache === true`. Entries live in `.pizx/cache` (24h TTL, LRU
  eviction). Side-effect letters (`cache: false`, like Π and α) are never
  cached.
