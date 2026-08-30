# pizx Examples

Run examples with `pizx <file>` or `npm run example:<name>`.

## Getting Started

```bash
pizx examples/hello-pizx.mjs          # basic pizx script ($ + π + Π)
pizx examples/basic-pi.mjs            # π — text generation
pizx examples/basic-capital-pi.mjs    # Π — coding agent
pizx examples/acp-basic.mjs           # α — any ACP agent (needs kiro installed)
pizx -p "what is 7! + 5?"             # quick query
pizx --acp --acp-server "kiro-cli acp" "list the source files"   # ACP quick query
```

## User-defined letters

```bash
pizx --letters examples/custom-letter.mjs       # Σ/Ρ listed alongside π/Π/α
pizx --trace --export-log examples/custom-letter.mjs
```

- `custom-letter.mjs` — uses the Σ letter defined in `plugins/summarize.mjs`,
  loaded via `pizx.config.mjs` (picked up automatically from the script's
  directory).
- `plugins/summarize.mjs` — the canonical "define your own letter" example.
- `plugins/ralph.mjs` — a compact Ralph-style improve loop ported from pizx
  0.9 as a user plugin.

## Trace & cache

```bash
pizx --cache --trace --export-log examples/trace-and-cache.mjs
```

Runs the same cacheable π prompt twice: the second call is served from
`.pizx/cache` and the JSONL log in `.pizx/logs/` shows `cache-miss` →
`llm-call` → `cache-hit`.
