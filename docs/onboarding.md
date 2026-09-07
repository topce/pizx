# pizx Onboarding Guide

> **A zx fork with native Pi AI integration on cordis** — shell scripting,
> AI text generation, a coding agent, an ACP agent, user-definable letters,
> traceable runs with JSONL export, and a local result cache.

## Table of Contents

1. [Project Overview](#project-overview)
2. [Architecture](#architecture)
3. [Key Concepts](#key-concepts)
4. [Getting Started](#getting-started)
5. [File Map](#file-map)

---

## Project Overview

| Attribute | Value |
|---|---|
| **Name** | `@topce/pizx` |
| **Version** | 1.0.0 |
| **License** | MIT |
| **Languages** | TypeScript, JavaScript, Markdown, Shell |
| **Frameworks** | cordis (`@cordisjs/core`), Pi AI, Pi Coding Agent, Agent Client Protocol (ACP), zx, schemastery, Vitest, Biome, esbuild |
| **Prerequisites** | Node.js ≥ 22.19.0, Pi AI (`pi auth login`) |

## Architecture

```
┌──────────────────────────────────────────────────────────┐
│ CLI (src/cli.ts) / createPizx (src/core/context.ts)     │
│   boots a cordis Context, mounts core services + plugins │
├──────────────────────────────────────────────────────────┤
│ services (each a cordis Service)                         │
│   trace   — spans, events, JSONL/JSON export             │
│   cache   — content-addressed local result cache         │
│   llm     — model/auth resolution, ask/stream, Π session │
│   letters — the template-tag registry                    │
│   words   — compose letters into AI patterns (words)     │
├──────────────────────────────────────────────────────────┤
│ letters (each a cordis plugin)                           │
│   π  — text generation      Π — coding agent             │
│   α  — any ACP agent (server required)                   │
│   …your plugins: Σ, ralph, fleet, chain, route, vote, …  │
└──────────────────────────────────────────────────────────┘
```

Every layer is a plugin; every capability is a service reachable through
`ctx` with dependency gating via `inject`. Letters are template tags
registered on `ctx.letters` — built-ins and user letters share one
mechanism, one trace, one cache.

## Key Concepts

- **Letter** — a template tag (`π`, `Π`, `α`, your `Σ`). See
  [docs/extension.md](extension.md) to define your own.
- **Word** — a named AI pattern (loop, fan-out, chaining, routing, …)
  composed from letters; a word is itself a letter, so patterns compose
  recursively. Seven word plugins ship in `examples/plugins/`. See
  [docs/words.md](words.md).
- **Service** — a named capability on `ctx` (`ctx.llm`, `ctx.trace`,
  `ctx.cache`, `ctx.letters`). Cordis gates plugin startup on `inject`.
- **Span** — one letter invocation in the trace; nested LLM calls and cache
  events attach to it by span id.
- **Trace event** — a JSON record (`llm-call`, `cache-hit`, …). Runs export
  as JSONL. See [docs/trace.md](trace.md).
- **Cache** — a content-addressed local cache for side-effect-free letters.
- **Config file** — `pizx.config.mjs` next to your script: `export const
  plugins = [...]`.

## Getting Started

```bash
npm install -g @earendil-works/pi && pi auth login
npm install @topce/pizx
```

```js
#!/usr/bin/env pizx
const answer = await π`what is the capital of France?`
echo(answer)

await Π`fix the TypeScript errors in src/`

await α({ server: ['kiro-cli', 'acp'] })`run the linter and fix issues`
```

```bash
pizx script.mjs               # run a script (letters are globals)
pizx -p "your prompt"         # quick query
pizx --acp --acp-server "kiro-cli acp" "your prompt"   # quick ACP agent query
pizx --trace script.mjs       # token/cache/cost summary at the end
pizx --export-log script.mjs  # JSONL run log in .pizx/logs/
pizx --cache script.mjs       # enable the local result cache
pizx --letters                # list registered letters
```

## File Map

| Path | What |
|---|---|
| `src/core/context.ts` | `createPizx()`, config-file loading, the Pizx handle |
| `src/core/letters.ts` | the `Letters` service (registry + effects) |
| `src/core/harnesses.ts` | the `Harnesses` service (CLI-harness specs for ε) |
| `src/core/words.ts` | the `Words` service (slots, `call`/`parallel`/`loop` operators) |
| `src/core/trace.ts` | the `Trace` service (spans, events, export) |
| `src/core/cache.ts` | the `Cache` service (keys, TTL, LRU) |
| `src/core/llm.ts` | the `Llm` service (auth, models, ask/stream, Π sessions) |
| `src/core/tags.ts` | `createLetterTag`, `LetterOutput`, `LetterPromise` |
| `src/plugins/pi.ts` | the π letter |
| `src/plugins/pi-agent.ts` | the Π letter |
| `src/plugins/acp.ts` | the α letter |
| `src/plugins/epsilon.ts` | the ε letter (zx wrapper + flag passthrough) |
| `src/plugins/harness-kiro.ts` / `harness-claude.ts` | built-in harness spec plugins |
| `src/plugins/core.ts` | mounts the framework services |
| `src/index.ts` / `src/globals.ts` | package entry / global injection |
| `src/cli.ts` | the `pizx` CLI |
| `examples/plugins/` | example letters and words (`summarize.mjs`, plus the seven word plugins: `ralph.mjs`, `fleet.mjs`, `chain.mjs`, `route.mjs`, `vote.mjs`, `refine.mjs`, `orchestrate.mjs`) |
| `docs/extension.md` | authoring guide for user letters |
| `docs/words.md` | words reference — the word catalog, slots/options, pattern map |
| `docs/acp.md` | the α letter reference |
| `docs/epsilon.md` | the ε letter reference + harness spec plugin guide |
| `docs/trace.md` | trace format, export, cache-friendliness |
