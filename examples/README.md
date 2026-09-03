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

## User-defined letters & words

```bash
pizx --letters examples/custom-letter.mjs       # Σ + the word library listed alongside π/Π/α
pizx --trace --export-log examples/custom-letter.mjs
pizx examples/words.mjs                         # the word library tour (all 7 words)
```

One focused, runnable example per word (all loaded via `pizx.config.mjs`):

```bash
pizx examples/word-ralph.mjs        # ralph — analyze → plan → execute → review loop
pizx examples/word-fleet.mjs        # fleet — parallel sectioning (fan-out)
pizx examples/word-chain.mjs        # chain — prompt chaining + optional gate
pizx examples/word-route.mjs        # route — classify, then dispatch
pizx examples/word-vote.mjs         # vote — N parallel answers, tallied (majority/best)
pizx examples/word-refine.mjs       # refine — generate → evaluate → revise until PASS
pizx examples/word-orchestrate.mjs  # orchestrate — decompose → fan out → synthesize
```

Each ends with "swap the slots" notes showing how to exchange the letters
(and nest other words) inside its pattern. The three words with agent slots —
`word-ralph.mjs`, `word-fleet.mjs`, `word-orchestrate.mjs` — also include a
**gated α section**: the ACP letter fills the slot live (read-only prompts),
skipping cleanly when kiro-cli is not installed. Or use the npm scripts:
`npm run example:word-chain`, `npm run example:word-route`, …

And the α letter inside the word slots (ACP agents as executors/workers,
writing into a scratch directory):

```bash
pizx examples/acp-word-slots.mjs    # α in ralph/fleet/orchestrate (needs kiro-cli login)
```

- `custom-letter.mjs` — uses the Σ letter defined in `plugins/summarize.mjs`,
  loaded via `pizx.config.mjs` (picked up automatically from the script's
  directory).
- `words.mjs` — tours the seven words (ralph, fleet, chain, route, vote,
  refine, orchestrate) and shows slot replacement (swapping `execute` Π → π,
  `worker` π → Π, …).
- `pizx.config.mjs` — loads every plugin below; words are globals in scripts.
- `plugins/summarize.mjs` — the canonical "define your own letter" example.

### The word plugins (AI patterns)

Each word is a self-contained cordis plugin built on the `ctx.words` service
(see [docs/words.md](../docs/words.md) for the full reference). Their only
imports are `schemastery` and `@topce/pizx` (for `PizxError`) — both resolve
against a local install. Bad usage is reported as `PizxError` with
`code: 'VALIDATION'` (CLI exit code `2`), matching the rest of pizx.

| Plugin | Word | Pattern |
|---|---|---|
| `plugins/ralph.mjs` | `ralph` (`loop`) | Agent loop — iterative analyze/plan/execute/review |
| `plugins/fleet.mjs` | `fleet` (`parallel`) | Parallelization: sectioning — split prompt, fan out |
| `plugins/chain.mjs` | `chain` (`pipeline`) | Prompt chaining — sequential steps + optional gate |
| `plugins/route.mjs` | `route` (`branch`) | Routing — classify, then dispatch |
| `plugins/vote.mjs` | `vote` (`jury`) | Voting — N parallel answers, tallied |
| `plugins/refine.mjs` | `refine` (`optimize`) | Evaluator-optimizer — revise until PASS |
| `plugins/orchestrate.mjs` | `orchestrate` (`director`) | Orchestrator-workers — decompose, fan out, synthesize |

## Trace & cache

```bash
pizx --cache --trace --export-log examples/trace-and-cache.mjs
```

Runs the same cacheable π prompt twice: the second call is served from
`.pizx/cache` and the JSONL log in `.pizx/logs/` shows `cache-miss` →
`llm-call` → `cache-hit`.
