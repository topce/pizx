# Self-Improvement Scripts

> **pizx scripts that analyze and improve pizx itself** — dogfooding the agent patterns to create a project that gets better every time you run an improvement pass.

## Philosophy

Every script produces **analysis with concrete patches and evidence** — never auto-commits. You review and decide. The goal is to make the project *easier to improve*, not to replace human judgment.

### Baseline (Analysis & Reports)

| # | Script | Pattern | What It Does | Run When |
|---|--------|---------|-------------|----------|
| 1 | `audit-morning-coffee.mjs` | Fleet → π synthesis | 7 parallel checks (lint, coverage, dead code, docs, deps, complexity, types) → ranked report | Daily |
| 2 | `factory-generate-script.mjs` | Orchestrator → Critique → Chi | Generates **new** improvement scripts on demand for any problem domain | When you need a new check |
| 3 | `prune-why-is-this-here.mjs` | Fleet → π synthesis | Hunts deletion candidates — zero-import exports, dead code, orphan tests, unused deps, stale config, redundant abstractions | Weekly |
| 4 | `verify-spec-to-code.mjs` | Pipeline (2-stage) | Reads docs → verifies claims against source → flags discrepancies | After doc/code changes |
| 5 | `gap-test-hunter.mjs` | Fleet → Critique | Maps exports against tests → risk-ranks coverage gaps with test suggestions | Before releases |
| 6 | `health-architecture-tracker.mjs` | Tau → Adaptive → persistent store | Periodic architecture audit with trend tracking — gets smarter with every run | Weekly |

### Quality & Correctness (`.patch` Files)

| # | Script | Pattern | What It Does | Run When |
|---|--------|---------|-------------|----------|
| 7 | `review-debate.mjs` | Δ Debate (4 roles × 2 rounds) | Security, performance, readability, correctness review → `.patch` per confirmed issue | Before merging PRs |
| 8 | `review-self-verify.mjs` | Λ Pipeline (2-stage) | Extract implied promises → verify against code → `.patch` for broken contracts | After doc/test changes |
| 9 | `hunt-bugs.mjs` | Φ Fleet (6 agents) | 6-category parallel bug scan → per-category `.patch` files | Weekly / pre-release |
| 10 | `heal-build.mjs` | Ρ Ralph Loop (max 3) | Diagnose → Plan → Fix → Verify loop on failing tests → cumulative `.patch` | When tests fail |
| 11 | `fuzz-adversarial.mjs` | Δ Debate (attacker vs defender) | Semantic edge-case fuzzing → `.patch` with test case + fix | Pre-release safety net |
| 12 | `quality-runner.mjs` | Orchestrator (sequential) | Runs all 5 quality scripts → merged patch summary | Full quality pass |

## Quick Start

```bash
# ─── Full quality pass (runs all 5 quality scripts) ───
pizx self-improve-examples/quality-runner.mjs
pizx self-improve-examples/quality-runner.mjs --skip heal-build    # skip build healer
pizx self-improve-examples/quality-runner.mjs --target src/patterns/  # focus on one area

# ─── Individual quality scripts ───
pizx self-improve-examples/review-debate.mjs        # multi-perspective review
pizx self-improve-examples/review-self-verify.mjs   # code self-consistency
pizx self-improve-examples/hunt-bugs.mjs            # 6-category bug scan
pizx self-improve-examples/heal-build.mjs           # auto-heal failing tests
pizx self-improve-examples/fuzz-adversarial.mjs     # edge-case fuzzing

# ─── Baseline scripts (analysis & reports) ───
pizx self-improve-examples/audit-morning-coffee.mjs # daily health scan
pizx self-improve-examples/factory-generate-script.mjs # generate new scripts
pizx self-improve-examples/prune-why-is-this-here.mjs  # hunt deletion candidates
pizx self-improve-examples/verify-spec-to-code.mjs     # docs vs code check
pizx self-improve-examples/gap-test-hunter.mjs         # test coverage gaps
pizx self-improve-examples/health-architecture-tracker.mjs # trend tracking
```

### Applying Patches

Quality scripts (7-12) write `.patch` files to `self-improve-examples/patches/<script-name>/`. Review and apply:

```bash
# Review patches from a specific script
ls self-improve-examples/patches/review-debate/
cat self-improve-examples/patches/review-debate/*.patch

# Apply all quality patches
git apply self-improve-examples/patches/review-debate/*.patch
git apply self-improve-examples/patches/hunt-bugs/*.patch

# Or apply everything at once
for d in self-improve-examples/patches/*/; do git apply "$d"*.patch 2>/dev/null; done
```

## Generated Scripts

The Improvement Factory (`factory-generate-script.mjs`) writes generated scripts to `self-improve-examples/generated/`. Edit the `PROBLEM` variable in the factory script to generate scripts for different domains.

The Architecture Health Tracker persists its data to `self-improve-examples/generated/architecture-health.json` — each run builds on the last.

Quality scripts (7-12) write `.patch` files to `self-improve-examples/patches/<script-name>/`. Each patch includes a machine-readable header with confidence score, severity, risk assessment, and review notes.

## Model Configuration

All scripts default to:
- **Planner:** `deepseek/deepseek-v4-pro` (high-level reasoning)
- **Worker:** `deepseek/deepseek-v4-flash` (execution)

Edit the `PLANNER_MODEL` and `WORKER_MODEL` constants at the top of each script to use different models. You can also pass models via environment or cli options.

## Design Patterns

These scripts follow consistent patterns:

1. **English aliases** — all scripts use `fleet`, `orchestrator`, `pipeline`, `critique`, `pi`, `learn`, `store`, `adaptive` instead of Greek letters for readability
2. **Agent mode where needed** — scripts that read/write files use `mode: 'agent'`
3. **Structured output** — every script produces tiered reports (🔴 Critical / 🟡 Important / 🟢 Nice to Have)
4. **No auto-commit** — all scripts produce analysis + patches, never auto-apply changes (except the factory which writes *new* scripts to `generated/`)
5. **Planner/Worker model separation** — complex reasoning uses pro models, execution uses flash models
