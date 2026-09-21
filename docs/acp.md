# α (alpha) — Any ACP Coding Agent

α drives **any ACP-compatible coding agent** through the generic
[Agent Client Protocol](https://agentclientprotocol.com/protocol/v1/overview)
(JSON-RPC 2.0 over stdio). It is a pure protocol client: it spawns the server
command you give it and consumes its `session/update` stream. **No pi
involvement** — π/Π keep using pi's SDK as they always did, and α works on
machines where pi is not installed.

Server processes are **pooled**: the first call spawns and initializes the
agent, later calls with the same `server`/`cwd`/`env` reuse that connection
(each in a fresh session, so turns never share conversation state). This
removes the process-boot + `initialize` + `session/new` cost from every call
after the first — measured at ~30 ms even for a trivial mock agent and
hundreds of ms for a real CLI.

## Usage

```js
// Kiro (native ACP server)
const r1 = await α({ server: ['kiro-cli', 'acp'] })`fix the TypeScript errors in src/`

// GitHub Copilot CLI
const r2 = await α({ server: ['npx', '@github/copilot', '--acp'] })`review this diff`

// Any local ACP server binary
const r3 = await α({ server: ['./my-agent', '--stdio'] })`run the checks`

// Quiet mode — suppress the streamed output
const r4 = await α.quiet({ server: ['kiro-cli', 'acp'] })`list TODOs`

// Streaming — consume text chunks as the agent produces them
for await (const chunk of α({ server: ['kiro-cli', 'acp'] }).stream`explain x`) {
  process.stdout.write(chunk)
}

// Aliases: acp and agent answer to the same letter
const r5 = await acp({ server: ['kiro-cli', 'acp'] })`same thing`
```

`server` is **required** — there is no default. Missing it fails fast:

```
pizx/α: no ACP server specified — pass { server: ['kiro-cli', 'acp'] } or any other ACP-compatible agent command
```

The same letter is reachable from the CLI:

```bash
pizx --acp --acp-server "kiro-cli acp" "fix the TypeScript errors in src/"
```

(`--acp-server` is whitespace-split; for arguments containing spaces, use a
script with `α({ server: [...] })` instead.)

## α inside words

α fills the agent slots of the word library exactly like Π. Pass `server`
next to the slot name — the word forwards it (plus `cwd`, `timeoutMs`, …) to
the α slot:

```js
await ralph({ execute: 'α', server: ['kiro-cli', 'acp'] })`create NOTES.md with the plan`
await fleet({ worker: 'α', server: ['kiro-cli', 'acp'], cwd: './scratch', concurrency: 2 })`- task one
- task two`
await orchestrate({ worker: 'α', server: ['kiro-cli', 'acp'] })`…`
```

Or bind a pre-configured tag, which carries its own options:
`execute: α({ server: ['kiro-cli', 'acp'] })`. Runnable tours:

- [`examples/acp-word-slots.mjs`](../examples/acp-word-slots.mjs)
  (`npm run example:acp-word-slots`) — ralph, fleet, and orchestrate with α
  slots, writing into a scratch directory;
- `examples/word-ralph.mjs`, `examples/word-fleet.mjs`,
  `examples/word-orchestrate.mjs` — each ends with a gated α section
  (read-only prompts) that skips cleanly when kiro-cli is not installed.

## Options

| Option | Type | Default | Notes |
|---|---|---|---|
| `server` | string[] | **required** | command + args, e.g. `['kiro-cli', 'acp']` |
| `cwd` | string | `process.cwd()` | working directory for the agent |
| `env` | dict | `process.env` | extra environment variables for the server process |
| `quiet` | boolean | `false` | suppress streamed output and status lines |
| `timeoutMs` | number | — | cancel the turn after this many ms (see below) |
| `confirm` | `true \| { semi } \| { hitl } \| { auto }` | off | human-in-the-loop gate before sending |

## Result — `LetterOutput`

Same contract as π/Π: `text`, `startTime`/`endTime`/`duration`, plus
`turnCount` = number of distinct tool calls the agent reported. `modelId`
(alias `modelUsed`) is the server label, prefixed for trace attribution:
`acp:<server command line>`.
Token getters (`inputTokens`, `outputTokens`, …) are populated **only when
the agent reports usage** in its prompt response (an experimental ACP field);
otherwise they are `0`.

## Contract

α is a **state-changing** operation — the agent can edit files, run commands,
and call tools — so pizx **never retries a turn automatically**. A failed or
timed-out turn is reported to the caller, who decides whether to retry. There
is no idempotency key, so a retried turn may repeat filesystem effects. The
low-level `runAcpPrompt` / `streamAcpPrompt` helpers follow the same rule.

Errors are structured `PizxError`s — branch on `err.code`, not the message:

| Code | Raised for |
|---|---|
| `VALIDATION` | missing/malformed `server`, or invalid options at the boundary |
| `ACP` | spawn, handshake, turn, timeout, or connection failures |
| `CANCELLED` | the caller declined the `confirm` gate |

Streaming delivers text **only** through the async iterator: `onText` is not
part of the streaming contract (`AcpStreamOptions` omits it), so a callback
that would never run cannot be attached. `onToolCall` and `onUsage` work for
both streaming and non-streaming turns.

`timeoutMs` covers the `initialize` handshake and each prompt turn; a turn that
exceeds it is cancelled per-session (see [Pooling & lifecycle](#pooling--lifecycle)).

## Permissions

Tool permissions are **auto-approved**: α picks the agent's `allow_always`
option when offered, else `allow_once`, else cancels the request. File-system
operations the agent delegates to the client (`fs/read_text_file`,
`fs/write_text_file`) are served from the local filesystem but are **sandboxed
to the session `cwd`** — paths outside it are rejected. The send-time `confirm`
gate (above) is the additional safety net for scripting.

## Tracing

Every α invocation opens the usual letter span. Inside it:

- `tool-call` events — one per `tool_call`/`tool_call_update` notification
  (`server`, `toolCallId`, `title`, `status`);
- `llm-call` event — when the agent's prompt response carries usage.

So `pizx --trace --export-log` shows foreign agents' tool activity in the
same JSONL as π/Π runs.

## Failure modes

| Symptom | Error |
|---|---|
| command not on PATH / not installed | `cannot start ACP server '<cmd>': command not found` |
| server exits non-zero mid-run | `ACP server '<cmd>' exited with code N` + stderr tail |
| server closes the connection cleanly (exit 0) before completing | `closed the connection unexpectedly (exit code 0) — the agent may be unauthenticated, misconfigured, or unsupported in this environment` |
| no response within `timeoutMs` | `ACP server '<cmd>' timed out after Nms` |
| agent requires `authenticate` | `the agent requires authentication, which is not supported yet` |
| agent produced no text | `(no assistant response)` |

The agent's stderr is mirrored to your stderr. A pooled connection is reused
across calls; a `timeoutMs` turn is cancelled with `session/cancel` (the
connection is torn down only if the agent ignores the cancel), and every
connection is killed on `dispose()` or after 60 s idle.

## Pooling & lifecycle

α keeps one live server process per `{ server, cwd, env }` key and reuses it
across invocations:

```js
await α({ server: ['kiro-cli', 'acp'] })`first turn`   // spawn + initialize
await α({ server: ['kiro-cli', 'acp'] })`second turn`  // same process, new session
```

- **Fresh session per call.** Every invocation creates a new ACP session, so
  turns do not inherit prior conversation text. When the agent advertises the
  `session/close` capability the session is closed after the turn (best-effort),
  so a long-lived connection does not accumulate sessions. (Opt-in reuse of a
  session for multi-turn conversation is future work.)
- **Concurrency.** Several α calls can run at once on one connection; the
  protocol routes updates per session id. Concurrent first calls share a
  single spawn.
- **Timeouts are per turn.** A turn that exceeds `timeoutMs` sends
  `session/cancel` for *that session only* and waits briefly for it to settle;
  sibling turns on the same connection are unaffected. The connection is torn
  down only if the agent fails to honor the cancel, so a cooperating agent
  keeps the warm process.
- **Idle eviction.** A connection is killed after 60 s without a turn.
  While idle it unrefs its handles so a script can still exit naturally;
  `dispose()` kills every pooled process, and a process-exit hook is the
  safety net for scripts that never dispose.
- **Kill switch.** Set `createPizx({ acp: { pool: false } })` or
  `PIZX_ACP_POOL=0` to spawn a fresh process per call instead.
- **`runAcpPrompt` / `streamAcpPrompt`** (the low-level exports) are one-shot:
  they spawn, run one turn, and close — useful for a single call without an
  app.

Pooling is on by default and tuned through the ACP service:

- `createPizx({ acp: { idleMs: 30_000, pool: true } })` (`AcpConfig`);
- `PIZX_ACP_POOL=0` disables pooling globally (one process per call) — the
  escape hatch for an agent that misbehaves on a reused connection.

## Requirements

You install and authenticate the agent CLI yourself (same as pizx's pi
prerequisite). Examples of ACP v1 servers:

- [Kiro](https://kiro.dev/docs/cli/acp/) — `kiro-cli acp`
- [GitHub Copilot CLI](https://github.com/github/copilot-cli) — `npx @github/copilot --acp`
- Gemini CLI, Amp, and others listed in the [ACP registry](https://agentclientprotocol.com/get-started/registry)

Authentication flows (`authenticate`/OAuth) and session resume are future
work — see `docs/ideas/acp-alpha.md`.
