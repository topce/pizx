# pizx English Examples

Same agent patterns as the Greek letter examples, but using English word aliases
(`orchestrator` instead of `Ω`, `fleet` instead of `Φ`, etc.).

```js
import { pi, Pi, orchestrator, fleet, ralph } from '@topce/pizx'
```

## Examples

| Alias | Greek | Example | What |
|-------|-------|---------|------|
| `hello` | — | `english-examples/hello.mjs` | Basic pizx script with English aliases |
| `orchestrator` | Ω | `english-examples/orchestrator.mjs` | Plan → Dispatch → Synthesize |
| `fleet` | Φ | `english-examples/fleet.mjs` | Parallel execution |
| `debate` | Δ | `english-examples/debate.mjs` | Multiple perspectives converge |
| `pipeline` | Λ | `english-examples/pipeline.mjs` | Sequential stages |
| — | — | `english-examples/all-patterns.mjs` | Quick tour of all 15 patterns |
| — | — | `english-examples/import-verify.mjs` | Verifies all English aliases import correctly |

## Execution Modes (hitl / semi / auto)

Uses English aliases to demonstrate execution modes across all 9 supported patterns
(pi, Pi, orchestrator, subagent, fleet, pipeline, ralph, debate, critique):

```bash
# All patterns, all modes
pizx english-examples/execution-modes.mjs

# Just Ralph in semi mode
MODE=semi WHICH=ralph pizx english-examples/execution-modes.mjs

# Just debate in hitl mode
MODE=hitl WHICH=debate pizx english-examples/execution-modes.mjs
```

**Modes:**
- `auto` — no gates, runs to completion (default)
- `semi` — gates at major decision points (backward-compatible with `confirm: true`)
- `hitl` — gates before EVERY phase, human approves each step

**Filter with env vars:** `MODE=auto|semi|hitl|all` `WHICH=pi|Pi|orchestrator|subagent|fleet|pipeline|ralph|debate|critique|all`

> **Note:** Running without filters fires all 9 patterns × 3 modes = many LLM calls. Use `MODE` and `WHICH` to limit scope and avoid burning API credits. For a quick smoke test, try `MODE=semi WHICH=ralph`.
