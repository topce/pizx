# Π (capital pi) — Pi Coding Agent

Capital pi: run pi-coding-agent with file/bash tools as a zx-style template
tag. Π is a **letter** (like π, α, and any user-defined letter), registered by
the built-in `pizx-pi-agent` plugin. Because agent runs mutate the filesystem, the
letter is declared `cache: false` — its results are never served from the
local cache.

## Usage

```js
await Π`fix the TypeScript errors in src/ and run tests`

await Π({ tools: ['read', 'bash', 'edit'] })`refactor the auth module`

await Π.quiet()`update import paths to the new module layout`
```

## Options

| Option | Type | Default | Notes |
|---|---|---|---|
| `model` | string | provider default | |
| `cwd` | string | `process.cwd()` | agent working directory |
| `tools` / `excludeTools` | string[] | all / none | tool selection |
| `thinkingLevel` | `'off' \| 'minimal' \| 'low' \| 'medium' \| 'high' \| 'xhigh'` | `'medium'` | |
| `system` / `appendSystemPrompt` | string | — | prompt overrides |
| `skills` | string[] | — | skill names loaded from skill paths |
| `quiet` | boolean | `false` | suppress status output |
| `timeoutMs` / `maxRetries` | number | provider default | per-call resilience |
| `apiKey` | string | env | bypass credential lookup |
| `confirm` | `true \| { semi } \| { hitl } \| { auto }` | off | human-in-the-loop gate |

## Session pooling & caching

Agent sessions are pooled per (model, cwd, tools, skills): repeated Π calls
reuse the conversation — and keep the provider's prompt cache warm. Sessions
are disposed when the app disposes. Per-assistant-turn usage is recorded into
the trace span on a best-effort basis; the letter start/end span always
appears in the exported log. See [Trace & logs](trace.md).
