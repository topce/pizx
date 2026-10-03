# Durable & Connected pizx

> Status: proposal · Created 2026-10-02 · pi target: 1.0.0
> **A1 (durable Π sessions) is implemented**; the rest of Track A and all of
> Track B are still proposals.
> Audience: power users running long agentic scripts **and** developers
> publishing reusable letters/words.

## Problem Statement

How might we let a Π conversation and a multi-step word run **survive process
restarts and resume**, and give the coding agent **the tool ecosystem (MCP)**
script users already have on their machines — without turning pizx into a
chat app?

## Recommended Direction

Two tracks that share the same seam — `Llm.agentSession()` in
`src/core/llm.ts`, which is the single place Π builds or reuses an
`AgentSession`.

### Track A — Durable Π and resumable words

The current **in-memory pooling** is lost on exit, and because
`createAgentSession()` is called with no `sessionManager`, pi's default
sessions are persisted but **never resumed** — each process run writes a new
orphan file under `~/.pi/agent/sessions/<cwd>/` (8 abandoned files, up to
3 MB, already in this repo's session dir). Track A gives Π a **named,
opt-in session** backed by pi's `SessionManager` and adds a **checkpoint
hook** so a `ralph`/`orchestrate` run can resume from the existing trace log.

```js
await Π({ session: 'auth-refactor' })`continue from where we stopped`
```

**Shipped (A1, unreleased).** Π accepts `session`, backed by pi's own store
rather than `.pizx/sessions/` (see the answered questions below), and unnamed Π
calls now pass `SessionManager.inMemory()` — so the orphan-file problem above
is gone as well. One process holds at most one handle per name: a second open is
a `VALIDATION` error, because pi's append-only JSONL keeps a leaf pointer per
handle and two handles fork the conversation silently. The CLI exposes it as
the quick `--Pi --session <name>` mode. A run-wide default (applying one
`session` name to every Π call in a script) was deliberately not added — it
would collide with the one-open-handle rule as soon as a script varies Π
options. Still
pending from A1/A2: `pizx sessions` listing and resume/checkpoint trace
events.

### Track B — Connected Π (MCP + codemode + tool search)

pi 1.0 ships `createMcpExtension()`, `createCodemodeExtension()`, and
`createToolSearchExtension()` as SDK-loadable factories. pizx adds them to
Π's `DefaultResourceLoader` so the user's `mcp.json` servers (Jira, GitHub,
databases, docs) become agent tools. This reuses the exact SDK pattern pi
documents:

```ts
const loader = new DefaultResourceLoader({
  cwd, agentDir: getAgentDir(),
  extensionFactories: [
    createMcpExtension(),          // reads ~/.pi/agent/mcp.json + trusted .pi/mcp.json
    createCodemodeExtension({ mode: 'on' }),
    createToolSearchExtension(),
  ],
})
await loader.reload()
const { session } = await createAgentSession({ resourceLoader: loader, settingsManager, sessionManager })
await session.bindExtensions({})   // emits session_start → MCP servers connect
```

**Honest note on codemode.** Its headline value — the model writing JS to fan
out tool calls and filter results before they reach context — is already what
a pizx script does by hand. Inside Π, codemode's real value is narrower: it
lets the agent **batch and filter MCP tool calls** cheaply. So Track B treats
codemode as an *enabler for MCP*, not a headline feature. The inversion
(exposing pizx letters to pi as an extension) is explicitly out of scope.

## Key Assumptions to Validate

- [ ] **Long runs actually get interrupted.** Confirm users run `ralph`/Π long
      enough that losing state hurts. *Test:* count abandoned session files and
      ask; instrument run duration.
- [ ] **Resume-by-name beats isolation.** Power users may prefer a fresh agent
      per script for reproducibility. *Test:* ship the flag opt-in; measure use.
- [ ] **The trace log can carry word checkpoints.** The trace is an event log,
      not a state machine. *Test:* replay a `ralph` trace and reconstruct the
      iteration index and last slot outputs.
- [ ] **SDK-loaded MCP works with pizx's `tools` allow-list.** Passing `tools`
      restricts the session and would hide MCP tools (per pi docs). *Test:* a
      session with `tools: ['read']` + an MCP server; verify MCP tools remain
      reachable (likely via `exposure: 'codemode'` + codemode, or by not
      intersecting `tools` with MCP names).
- [ ] **Project trust is acceptable.** `.pi/mcp.json` is only read after trust.
      *Test:* document the trust requirement; verify global `mcp.json` works
      without it.

## MVP Scope

**In**

- Π option `session?: string` — **shipped**, along with the CLI path:
  `pizx --Pi --session <name> "prompt"` runs one agent turn against the named
  conversation.
- Persistent `SessionManager` — **shipped against pi's own store** instead of
  `.pizx/sessions/`; create + `appendSessionInfo(name)` when the name is new,
  `SessionManager.open()` on a name hit, and a per-process claim that refuses a
  second handle on one name.
- `--list-sessions` / `pizx sessions` to list named sessions (id, name, cwd,
  message count, modified) — pending.
- Π option `mcp?: boolean | { servers?: string[] }` (default **off**, so no
  behavior change and no surprise network/tool surface).
- Wire `createMcpExtension` + `createToolSearchExtension` + codemode into Π's
  loader when `mcp` is enabled; call `session.bindExtensions({})`.
- Trace events for session resume (`session-open`, `session-resume`) and a
  checkpoint event per word step.

A1 shipped the first two bullets; everything else in this list is still open.

**Out**

- Forking/branching UX, remote sessions, cross-machine resume.
- Automatic (default-on) MCP — must be explicit.
- Caching agent sessions (Π stays `cache: false`).
- Image/classifier letters, virtual-model router (Track C, deferred).

## Not Doing (and Why)

- **Codemode as a first-class letter** — pizx scripts are already arbitrary JS;
  a sandbox letter adds surface without a new capability.
- **RPC / `runRpcMode`** — the in-process SDK is strictly better for pizx;
  RPC only pays off across a process boundary pizx does not have.
- **Pi packages distribution** — low value until the runtime features land; a
  packaging story on top of an unfinished surface is premature.
- **Exposing pizx letters as a pi extension** — interesting inversion, but a
  separate product question, not an improvement to pizx itself.
- **Auto-persisting every Π call** — silent session accumulation is the bug we
  are fixing; durability must be opt-in and named.

## Open Questions

- **Answered — reuse pi's `~/.pi/agent/sessions/`.** Sharing the store with
  the `pi` CLI and its session picker is worth more than self-containment: a
  pizx conversation can be opened and steered in pi itself. The cost is that
  durable sessions live outside the project (and outside `.pizx/`).
- When `mcp` is on and the user passes `tools`, do we (a) reject the combo,
  (b) treat MCP tools as `codemode`-exposure only and keep `tools` for the
  built-ins, or (c) union the sets? Needs a decision before implementation.
- Does a resumed Π session need its own `mcp`/`tools` fingerprint re-validated,
  since the pool key currently includes those? A resumed session must not
  silently run with a different tool set than the one it was created with.
- **Answered — yes, with caveats.** `session_info.name` (pi's latest name
  entry) is the public name. The caveats: names share a namespace with the
  user's other pi sessions in that cwd, so generic names can resume unrelated
  conversations; resolving a name costs a full `SessionManager.list()` scan per
  new pool key. A pizx-side index stays an option if that scan ever matters.

## Suggested Sequencing

1. **A1** — `SessionManager` wiring + `--session` / `.pizx/sessions/` (self-contained, no MCP).
2. **A2** — session listing + resume traces + word checkpoint/resume.
3. **B1** — `mcp` option + extension factories + `bindExtensions`; resolve the
   `tools` × MCP interaction from Open Questions.
4. **B2** — codemode/tool-search on top of MCP; annotation-driven `confirm`
   using pi's `readOnlyHint`/`destructiveHint`.

Track A1 is the smallest slice that tests the core "resume works" assumption;
Track B resolves the one real integration risk (tool-set interaction).
