#!/usr/bin/env pizx
/**
 * ─── health-architecture-tracker.mjs — Persistent Architecture Health ────
 *
 * A recurring architecture audit that gets smarter with every run. Uses
 * Tau (shared key-value store) to persist findings between runs and
 * Adaptive orchestration to self-adjust the depth of analysis based on
 * what changed since last time.
 *
 * How it works:
 *   1. Restore previous findings from Tau's persistent store
 *   2. Adaptive workflow scans the codebase, focusing on what changed
 *   3. Compare current state to historical trends
 *   4. Update the Tau store with new findings
 *   5. Produce a trend report showing degradation/improvement over time
 *
 * Run weekly to track architectural health as a time series.
 *
 * Run:
 *   pizx self-improve-examples/health-architecture-tracker.mjs
 *
 * The Tau store persists between runs — each run builds on the last.
 */

import { chalk } from 'zx'
import { readFile, writeFile, mkdir } from 'node:fs/promises'
import { join } from 'node:path'

const PLANNER_MODEL = 'deepseek/deepseek-v4-pro'
const WORKER_MODEL = 'deepseek/deepseek-v4-flash'
const HEALTH_DIR = join(import.meta.dirname, 'generated')
const HEALTH_FILE = join(HEALTH_DIR, 'architecture-health.json')

// ════════════════════════════════════════════════════════════════════════

console.log(chalk.bold.magenta('\n 🏥 Architecture Health Tracker — Persistent Audit\n'))
console.log(chalk.dim(` Planner: ${PLANNER_MODEL}  |  Worker: ${WORKER_MODEL}\n`))

// ─── Restore previous health state ─────────────────────────────────────

await mkdir(HEALTH_DIR, { recursive: true })

let previousHealth = {
  runs: [],
  findings: {},
  trends: {},
  firstRun: new Date().toISOString(),
}

try {
  const raw = await readFile(HEALTH_FILE, 'utf-8')
  previousHealth = JSON.parse(raw)
  console.log(chalk.green(` ✓ Restored previous health data — ${previousHealth.runs.length} previous run(s)\n`))
  if (previousHealth.runs.length > 0) {
    const last = previousHealth.runs[previousHealth.runs.length - 1]
    console.log(chalk.dim(`   Last run: ${last.timestamp} — ${last.totalFindings || '?'} findings\n`))
  }
} catch {
  console.log(chalk.yellow(' ⚠ No previous health data found — starting fresh baseline\n'))
}

// ─── Phase 1: Calculate what changed ───────────────────────────────────

console.log(chalk.yellow(' Calculating changes since last run...\n'))

let gitDiffSummary = 'First run — no previous state'
let changedFiles = ''

try {
  if (previousHealth.runs.length > 0) {
    const lastRunDate = previousHealth.runs[previousHealth.runs.length - 1].timestamp
    gitDiffSummary = (await $`git log --oneline --since="${lastRunDate}" -- src/ docs/ 2>&1 || echo "no changes"`).stdout.trim()
    changedFiles = (await $`git diff --name-only HEAD~5..HEAD -- src/ 2>&1 || echo ""`).stdout.trim()
  } else {
    gitDiffSummary = (await $`git log --oneline -20 -- src/ docs/ 2>&1 || echo "no git history"`).stdout.trim()
    changedFiles = (await $`git diff --name-only HEAD~10..HEAD -- src/ 2>&1 || echo ""`).stdout.trim()
  }
} catch {
  gitDiffSummary = 'Git history unavailable'
}

console.log(chalk.dim(`   Recent changes: ${changedFiles.split('\n').length} files\n`))

// ─── Phase 2: Tau — distributed architecture audit ─────────────────────

console.log(chalk.yellow(' Running distributed architecture audit via Tau store...\n'))

const tauResult = await store({
  plannerModel: PLANNER_MODEL,
  workerModel: WORKER_MODEL,
  agents: 5,
  rounds: 1,
  mode: 'agent',
})`
Audit the pizx project architecture for health and degradation. Use the Tau shared key-value store to write findings under these keys. Each agent should write to their assigned keys and then read other agents' findings to avoid duplication:

Previous health state (from prior runs):
${JSON.stringify(previousHealth.findings, null, 2).slice(0, 3000)}

Git changes since last run:
${gitDiffSummary.slice(0, 2000)}

Agent 1 — COMPLEXITY TRENDS (write to key "complexity"):
Check src/patterns/*.ts and src/*.ts. Identify the most complex files by line count. Compare to previous findings if they exist. Flag: files that grew significantly (>20% line increase since last run), files approaching 400+ lines (candidate for splitting). Write: { files: [{ path, lines, trend: "stable"|"growing"|"shrinking", recommendation }] }

Agent 2 — DEPENDENCY HEALTH (write to key "dependencies"):
Check the dependency graph between src/ files. Identify: circular dependencies, files with too many imports (>10 other src files), patterns that depend on other patterns (tight coupling). Write: { cycles: [...], highFanIn: [...], tightCoupling: [...] }

Agent 3 — PATTERN CONSISTENCY (write to key "patterns"):
Compare all 15 pattern implementations in src/patterns/. Check: do they all use the same type patterns? Same error handling? Same option propagation? Consistent naming? Flag inconsistencies. Write: { consistent: [...], inconsistent: [{ pattern, issue, file }] }

Agent 4 — ERROR HANDLING (write to key "errors"):
Audit error handling across ALL src/ files. Check: are errors propagated correctly? Are there swallowed errors (empty catch blocks)? Missing try/catch on async operations? Inconsistent error message formats? Write: { propagated: X, swallowed: X, missing: X, issues: [...] }

Agent 5 — CONFIG & BUILD HEALTH (write to key "config"):
Check tsconfig.json, tsconfig.build.json, biome.json, vitest.config.ts, package.json (scripts section), scripts/build.mjs. Flag: outdated compiler targets, missing strict flags, build script complexity, duplicated config between files. Write: { issues: [...], recommendations: [...] }
`

// ─── Phase 3: Adaptive — refine and deepen based on findings ──────────

console.log(chalk.yellow(' Adaptive audit — deepening analysis on hotspots...\n'))

const tauFindingsSummary = JSON.stringify(tauResult.finalState || {}, null, 2)

const adaptiveResult = await adaptive({
  plannerModel: PLANNER_MODEL,
  workerModel: WORKER_MODEL,
  maxSteps: 3,
  qualityThreshold: 0.8,
  mode: 'agent',
})`
You are continuing an architecture health audit for the pizx project. Here are initial findings from a distributed Tau audit:

${tauFindingsSummary.slice(0, 6000)}

Based on these findings, adapt your analysis:
- If complexity is growing, deep-dive the worst files and suggest specific refactorings
- If dependency cycles exist, trace them and suggest how to break them
- If error handling is inconsistent, audit src/patterns/ for the worst offenders
- If config is stale, propose specific fixes

Focus on TRENDS since last run — is the architecture improving or degrading? If this is the first run, establish a baseline.

For each finding, provide:
1. Concrete evidence (file:line)
2. Trend direction (↗ getting worse, ↘ improving, → stable)
3. Specific fix recommendation (code change, not vague advice)
`

// ─── Phase 4: Trend comparison and health score ────────────────────────

console.log(chalk.yellow(' Computing architecture health score...\n'))

// Calculate file stats for trend comparison
const fileCount = parseInt((await $`find src/ -name '*.ts' | wc -l`).stdout.trim()) || 0
const lineCount = parseInt((await $`find src/ -name '*.ts' -exec cat {} + | wc -l`).stdout.trim()) || 0
const testCount = parseInt((await $`find src/ -name '*.test.ts' -exec grep -c 'it(' {} + | awk -F: '{s+=$2} END {print s}'`).stdout.trim()) || 0

const healthScore = await pi({ model: PLANNER_MODEL, maxTokens: 2048 })`
Based on this architecture audit data, compute a health score (0-100) for the pizx project:

File stats: ${fileCount} source files, ~${lineCount} lines of code, ${testCount} tests
Previous runs: ${previousHealth.runs.length}
Previous scores: ${JSON.stringify(previousHealth.runs.map(r => ({ date: r.timestamp, score: r.healthScore })))}

Tau findings:
${tauFindingsSummary.slice(0, 3000)}

Adaptive findings:
${adaptiveResult.finalResult?.slice(0, 3000) || 'not available'}

Output:
HEALTH_SCORE: [number 0-100]
TREND: [↗ improving / ↘ degrading / → stable]
SUMMARY: [one sentence explaining the score]
`

// ─── Phase 5: Save updated health state ────────────────────────────────

const runRecord = {
  timestamp: new Date().toISOString(),
  healthScore: parseInt((healthScore.text.match(/HEALTH_SCORE:\s*(\d+)/) || [0, 0])[1]) || 0,
  trend: (healthScore.text.match(/TREND:\s*(.+)/) || [0, 'stable'])[1].trim(),
  fileCount,
  lineCount,
  testCount,
  gitChanges: changedFiles.split('\n').filter(Boolean).length,
  tauFindings: tauResult.finalState,
  adaptiveFindings: adaptiveResult.finalResult?.slice(0, 2000),
}

previousHealth.runs.push(runRecord)
previousHealth.findings = tauResult.finalState || {}

// Keep last 20 runs max
if (previousHealth.runs.length > 20) {
  previousHealth.runs = previousHealth.runs.slice(-20)
}

await writeFile(HEALTH_FILE, JSON.stringify(previousHealth, null, 2), 'utf-8')

// ─── Phase 6: Generate report ──────────────────────────────────────────

console.log(chalk.bold.green('\n ✓ Architecture health audit complete\n'))
console.log(chalk.dim(`   Saved to ${HEALTH_FILE}\n`))

// Trend visualization
console.log(chalk.bold.cyan('📈 Health Trend:'))
const runs = previousHealth.runs.slice(-8) // last 8 runs
for (const run of runs) {
  const date = run.timestamp.slice(0, 10)
  const score = run.healthScore || 0
  const bar = '█'.repeat(Math.round(score / 5))
  const color = score >= 80 ? chalk.green : score >= 60 ? chalk.yellow : chalk.red
  console.log(`   ${chalk.dim(date)}  ${color(bar)} ${score}`)
}

console.log(chalk.bold.yellow(`\n Current Health Score: ${chalk.bold(runRecord.healthScore)}/100`))
console.log(chalk.dim(`   Trend: ${runRecord.trend}`))
console.log(chalk.dim(`   Files: ${fileCount}  |  Lines: ${lineCount}  |  Tests: ${testCount}`))

// Show top issues from adaptive findings
if (adaptiveResult.finalResult) {
  console.log(chalk.bold.red('\n 🔍 Top Issues Found:'))
  console.log(chalk.dim(`   ${adaptiveResult.finalResult.slice(0, 600)}`))
}

console.log(chalk.dim('\n ─── Run weekly to track architectural health over time ───\n'))
