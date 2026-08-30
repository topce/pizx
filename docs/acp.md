# α (alpha) — Any ACP Coding Agent

α drives **any ACP-compatible coding agent** through the generic
[Agent Client Protocol](https://agentclientprotocol.com/protocol/v1/overview)
(JSON-RPC 2.0 over stdio). It is a pure protocol client: it spawns the server
command you give it, one process per invocation, and consumes its
`session/update` stream. **No pi involvement** — π/Π keep using pi's SDK as
they always did, and α works on machines where pi is not installed.

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

## Options

| Option | Type | Default | Notes |
|---|---|---|---|
| `server` | string[] | **required** | command + args, e.g. `['kiro-cli', 'acp']` |
| `cwd` | string | `process.cwd()` | working directory for the agent |
| `env` | dict | `process.env` | extra environment variables for the server process |
| `quiet` | boolean | `false` | suppress streamed output and status lines |
| `timeoutMs` | number | — | kill the server after this many ms |
| `confirm` | `true \| { semi } \| { hitl } \| { auto }` | off | human-in-the-loop gate before sending |

## Result — `LetterOutput`

Same contract as π/Π: `text`, `startTime`/`endTime`/`duration`, plus
`turnCount` = number of distinct tool calls the agent reported. `modelId`
(alias `modelUsed`) is the server label, prefixed for trace attribution:
`acp:<server command line>`.
Token getters (`inputTokens`, `outputTokens`, …) are populated **only when
the agent reports usage** in its prompt response (an experimental ACP field);
otherwise they are `0`.

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

The agent's stderr is mirrored to your stderr, and the child process is
killed on every exit path.

## Requirements

You install and authenticate the agent CLI yourself (same as pizx's pi
prerequisite). Examples of ACP v1 servers:

- [Kiro](https://kiro.dev/docs/cli/acp/) — `kiro-cli acp`
- [GitHub Copilot CLI](https://github.com/github/copilot-cli) — `npx @github/copilot --acp`
- Gemini CLI, Amp, and others listed in the [ACP registry](https://agentclientprotocol.com/get-started/registry)

Authentication flows (`authenticate`/OAuth), session resume, and pooled
process reuse are future work — see `docs/ideas/acp-alpha.md`.
