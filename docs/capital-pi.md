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
| `thinkingLevel` | `'off' \| 'minimal' \| 'low' \| 'medium' \| 'high' \| 'xhigh' \| 'max'` | `'medium'` | |
| `system` / `appendSystemPrompt` | string | — | prompt overrides |
| `skills` | string[] | — | skill names loaded from skill paths |
| `session` | string | — | resume (or create) a named persistent conversation; see [Durable sessions](#durable-sessions) |
| `quiet` | boolean | `false` | suppress status output |
| `timeoutMs` / `maxRetries` | number | provider default | per-provider-request timeout; retry budget for provider requests and agent turns |
| `apiKey` | string | env | bypass credential lookup |
| `confirm` | `true \| { semi } \| { hitl } \| { auto }` | off | human-in-the-loop gate |

## Session pooling & caching

Agent sessions are pooled per (model, cwd, thinking level, tools, skills, prompt
overrides, `timeoutMs`, `maxRetries`, and the `session` name): repeated Π
calls with the same options reuse the conversation — and keep the provider's
prompt cache warm. Sessions are disposed when the app disposes.

Each invocation records only the usage and assistant turns it produced: the
session's cumulative `getSessionStats()` is snapshotted before the turn, so a
pooled or resumed session never re-bills earlier turns. The letter start/end
span always appears in the exported log. See [Trace & logs](trace.md).

## Durable sessions

Without `session`, a Π conversation lives in memory — pooled within the
process, gone at exit, and no files written. `session` opts into a **named,
persistent** conversation instead:

```js
await Π({ session: 'auth-refactor' })`continue from where we stopped`
```

```bash
pizx --Pi --session auth-refactor "continue from where we stopped"
```

(`--session` is a `--Pi` flag — in a script it is the letter option above.
`--tools`/`--exclude-tools` give a one-off allow/deny list.)

The conversation is stored in pi's standard session store
(`~/.pi/agent/sessions/<cwd>/`), created and named on the first run and resumed
by name afterwards — from a later run, another process, or the `pi` CLI, whose
session picker lists it. A resumed session arrives with its history, so the
agent already knows the files it read and the decisions it made.

Two rules follow from how pi stores sessions (append-only JSONL with a leaf
pointer per open handle):

- **One open handle per name.** Opening a name that is already open in this
  process fails with a `VALIDATION` error: two live handles would each append
  children of the same entry and silently fork the conversation. Dispose the app
  before reopening the name, or use another name. Concurrent *processes* are not
  detected — give each parallel run its own name.
- **Names share the namespace of your other pi sessions** in that directory. A
  generic name such as `review` can resume an unrelated conversation, so prefix
  them (`pizx-auth-refactor`).

The conversation is context, not a result: durable sessions are never cached
(`cache: false`).
