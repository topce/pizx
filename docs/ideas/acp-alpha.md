# α (Alpha) — Generic ACP Agent Letter for pizx

## Problem Statement

How might we let pizx scripts drive *any* ACP-compatible coding agent —
without being locked to pi — while keeping π/Π exactly as they are and
preserving the letter DX (option chaining, `.quiet`, `.stream`, tracing)?

## Recommended Direction

A third built-in letter **α** (aliases `acp`, `agent`) implemented on the
official [`@agentclientprotocol/sdk`](https://www.npmjs.com/package/@agentclientprotocol/sdk).
α is a pure, general [Agent Client Protocol](https://agentclientprotocol.com/protocol/v1/overview)
v1 client: per invocation it spawns the server command the user gives it
(JSON-RPC 2.0 over newline-delimited stdio: `initialize` → `session/new` →
`session/prompt` → `session/update` → stop) and aggregates the streamed text
into the usual `LetterOutput`. **There is no default server** — `server` is a
required option — and **no pi involvement of any kind**: π/Π keep using pi's
own SDK unchanged, and α runs on machines without pi.

```js
const r = await α({ server: ['kiro-cli', 'acp'] })`fix the TypeScript errors in src/`
```

Tool permissions are auto-approved (`allow_always` > `allow_once`), the
send-time `confirm` gate stays the safety net, and file-system requests
delegated to the client are served honestly. The agent's tool activity is
traced as `tool-call` events, and token usage as an `llm-call` event when the
agent reports it.

## Key Assumptions to Validate

- [x] Kiro exposes ACP natively as `kiro-cli acp` — validate manually
      against a real Kiro install.
- [x] The SDK's stable v1 API (`client()`, `ndJsonStream`, `buildSession(...)`)
      works — proven by the offline mock-server test suite.
- [ ] Real-world agents stream `agent_message_chunk`/`tool_call` updates as
      the spec describes — to be confirmed against Kiro/Copilot CLI.
- [ ] Most agents report token usage in the prompt response (experimental
      ACP field); when absent, α traces tool activity with 0 tokens.

## MVP Scope

- α letter + `acp`/`agent` aliases, built into pizx core
- one-shot run + `.stream`, quiet mode, `cwd`/`env`/`timeoutMs`/`confirm` options
- auto-approved permissions, honest client-side fs handlers
- `tool-call` trace events (+ `llm-call` when usage is reported)
- CLI: `pizx --acp --acp-server "kiro-cli acp" "prompt"`
- offline mock ACP server test fixture; zero pi involvement guaranteed by tests

## Not Doing (and Why)

- **pi-acp bridge / pi-as-ACP** — α is protocol-generic; pi stays on its own
  SDK via π/Π. Users who want pi through ACP pass their own command.
- Server presets / ACP-registry discovery — presets are sugar; explicit
  argv is honest and zero-maintenance.
- `authenticate`/OAuth, `session/load`, pooled session reuse — not needed for
  one-shot scripting; auth-requiring agents fail with a clear error.
- Interactive per-tool permission prompts — contradicts scripting UX; the
  send-time confirm gate covers it.
- `model`/`system` passthrough, connect-to-running-server transport, Ctrl+C →
  `session/cancel` — future improvements.

## Open Questions

- Which agents beyond Kiro should get documented examples first?
