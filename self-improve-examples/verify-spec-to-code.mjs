#!/usr/bin/env pizx
/**
 * ─── verify-spec-to-code.mjs — Spec-to-Code Consistency Check ────────────
 *
 * Pipeline that reads documentation (docs/*.md, ADRs) and verifies
 * that the actual source code implements what the docs claim.
 * If docs say "Orchestrator supports confirm gates" but the code doesn't
 * expose that option — it gets flagged.
 *
 * Three pipeline stages:
 *   Stage 1: EXTRACT — Read all docs/ and extract every concrete claim
 *   Stage 2: VERIFY — Check each claim against src/ implementation
 *   Stage 3: REPORT — Produce discrepancy report with fix suggestions
 *
 * Output: gap report showing docs that are wrong, missing, or stale.
 *
 * Run:
 *   pizx self-improve-examples/verify-spec-to-code.mjs
 */

import { chalk } from 'zx'

const PLANNER_MODEL = 'deepseek/deepseek-v4-pro'
const WORKER_MODEL = 'deepseek/deepseek-v4-flash'

console.log(chalk.bold.blue('\n 📋 Spec-to-Code Verifier — Docs vs Implementation\n'))
console.log(chalk.dim(` Planner: ${PLANNER_MODEL}  |  Worker: ${WORKER_MODEL}\n`))
console.log(chalk.dim(' Pipeline: Extract Claims → Verify Against Code → Report Gaps\n'))

// ─── Pipeline: 3 stages ────────────────────────────────────────────────

const result = await pipeline({
  plannerModel: PLANNER_MODEL,
  workerModel: WORKER_MODEL,
  mode: 'agent',
  stages: [
    // ─── Stage 1: EXTRACT claims from documentation ─────────────────
    (async () => {
      const stage1 = await pi({ model: PLANNER_MODEL, maxTokens: 4096 })`
Read ALL files in docs/*.md (excluding docs/decisions/). For each pattern doc (pi.md, capital-pi.md, ralph.md, fleet.md, orchestrator.md, pipeline.md, critique.md, debate.md, subagent.md, thread.md, memory.md, broadcast.md, adaptive.md, graph.md, nu.md, chi.md, tau.md, onboarding.md, advanced-features.md), extract EVERY concrete claim about behavior, options, and capabilities.

A "concrete claim" is something testable — for example:
- "Orchestrator supports the confirm option" → check src/patterns/orchestrator.ts for confirm handling
- "Fleet accepts concurrency up to 5" → check src/patterns/fleet.ts
- "qualityCheck is supported by 12 patterns" → check src/patterns/*.ts
- "π.stream returns an async generator" → check src/pi.ts
- "All patterns accept thinkingLevel" → check src/patterns/types.ts

Output as a structured table:

| # | Doc File | Claim | Expected Behavior | Source Line(s) in Docs |
|---|----------|-------|-------------------|----------------------|
| 1 | orchestrator.md | supports confirm gates | confirm option pauses before execution | line ~45 |
| 2 | fleet.md | concurrency defaults to 5 | FleetOptions.concurrency default is 5 | line ~30 |
...etc.

Read EVERY doc file. Be thorough — extract at least 3-5 claims per documented feature.
`
      return stage1.text
    })(),

    // ─── Stage 2: VERIFY claims against source ─────────────────────
    (prevOutput) => pi({ model: WORKER_MODEL, maxTokens: 4096 })`
You are a code auditor. Here is a list of claims extracted from pizx documentation:

${prevOutput.slice(0, 6000)}

For EACH claim, read the corresponding source file in src/patterns/ or src/ and verify whether the claim is true. Use bash to grep for specific option names, function signatures, and type definitions.

For each claim, report:

| # | Claim | Status | Evidence | Fix Needed |
|---|-------|--------|----------|------------|
| 1 | [claim] | ✅ TRUE / ❌ FALSE / ⚠️ PARTIAL / ❓ UNCLEAR | [file:line showing the behavior] | [if false, what needs to change] |

Be precise — cite exact file paths and line numbers from grep/read output.
`
  ],
})

// ─── Phase 3: Synthesize final report ──────────────────────────────────

console.log(chalk.yellow('\n Synthesizing discrepancy report...\n'))

const stageResults = []
for (const stage of result.stages || []) {
  stageResults.push(stage.output?.slice(0, 4000) || 'no output')
}

const report = await pi({ model: PLANNER_MODEL, maxTokens: 4096 })`
Synthesize the spec-to-code verification results into a clear discrepancy report.

Stage 1 (Claims extracted from docs):
${stageResults[0]}

Stage 2 (Verification against code):
${stageResults[1]}

Format the final report as:

## 📋 Spec-to-Code Discrepancy Report

### ❌ Docs Are WRONG (code does something different)
[Claims that are false — the docs say one thing, code does another]

### 📝 Docs Are MISSING (code exists but isn't documented)
[Features/options that exist in src/ but aren't mentioned in docs/]

### 🗑️ Docs Are STALE (docs describe removed/deprecated features)
[Claims about features that no longer exist]

### ⚠️ Docs Are AMBIGUOUS (unclear whether claim is true)
[Claims that couldn't be verified definitively]

### ✅ Docs Are CORRECT (verified true)
[Quick summary of verified claims count]

### 🔧 Top 3 Doc Fixes Needed
[Most impactful documentation corrections, with suggested text]
`

console.log(chalk.bold.green('\n ✓ Spec-to-code verification complete\n'))

// Show stage summaries
for (let i = 0; i < (result.stages || []).length; i++) {
  const stage = result.stages[i]
  const label = i === 0 ? 'Extract' : 'Verify'
  const icon = stage.success ? chalk.green('✓') : chalk.red('✗')
  console.log(chalk.dim(`   ${icon} Stage ${i + 1} (${label}): ${stage.durationMs || '?'}ms`))
}

console.log()
console.log(report.text)
console.log(chalk.dim('\n ─── Docs rot in silence. Verify regularly. ───\n'))
