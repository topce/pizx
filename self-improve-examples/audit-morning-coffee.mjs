#!/usr/bin/env pizx
/**
 * ─── audit-morning-coffee.mjs — Daily Project Health Scan ─────────────────
 *
 * Runs a Fleet of parallel checks across the project, producing a ranked
 * report with concrete patches. Think of it as your morning coffee ritual —
 * run it daily, get 1-3 actionable fixes every time.
 *
 * Checks performed (all in parallel):
 *   1. Lint & format issues (biome check)
 *   2. Test coverage gaps
 *   3. Dead code / unused exports
 *   4. Missing documentation (undocumented exports)
 *   5. Outdated or missing dependencies
 *   6. TypeScript strictness violations
 *   7. File size / complexity hotspots
 *
 * Output: ranked report with severity, evidence, and suggested patches.
 * Nothing is auto-applied — you review and decide.
 *
 * Run:
 *   pizx self-improve-examples/audit-morning-coffee.mjs
 */

import { chalk } from 'zx'

const PLANNER_MODEL = 'deepseek/deepseek-v4-pro'
const WORKER_MODEL = 'deepseek/deepseek-v4-flash'

console.log(chalk.bold.cyan('\n ☕ Morning Coffee Audit — Daily Project Health Scan\n'))
console.log(chalk.dim(` Planner: ${PLANNER_MODEL}  |  Worker: ${WORKER_MODEL}\n`))

// ─── Phase 1: Gather raw data via shell commands ───────────────────────

console.log(chalk.yellow(' Gathering project data...\n'))

const [biomeResult, depsResult, fileStats, testCoverage] = await Promise.allSettled([
  $`npx biome check src/ --max-diagnostics=200 2>&1 || true`,
  $`npx depcheck --ignores="@types/*" 2>&1 || true`,
  $`find src/ -name '*.ts' -not -name '*.test.ts' | head -50`,
  $`npx vitest --run --coverage --reporter=verbose 2>&1 || true`,
])

// ─── Phase 2: Run Fleet of 7 parallel AI checks ──────────────────────

console.log(chalk.yellow(' Running 7 parallel AI checks...\n'))

const result = await fleet({
  plannerModel: PLANNER_MODEL,
  workerModel: WORKER_MODEL,
  mode: 'agent',
  concurrency: 7,
})`
1. LINT & FORMAT: Review the biome output and list every lint/format issue in src/. For each, show the file, line, rule violated, and a suggested fix. Output as a markdown table. Raw biome output: ${biomeResult.status === 'fulfilled' ? biomeResult.value.stdout.slice(0, 8000) : 'biome not available'}

2. TEST COVERAGE: Analyze the test coverage data. Identify the top 5 most critical untested or under-tested functions/patterns. Rank by risk (exported + complex + untested = high risk). For each, suggest what kind of tests are needed. Raw coverage: ${testCoverage.status === 'fulfilled' ? testCoverage.value.stdout.slice(0, 8000) : 'coverage not available'}

3. DEAD CODE: Scan src/ for dead code — exports that are never imported, functions that are never called, variables that are never read. Use grep to check imports. List each candidate with file, line, and evidence (e.g., "exported but grep finds zero imports"). Think: what would break if we deleted this?

4. DOCUMENTATION GAPS: Check src/patterns/*.ts and src/*.ts (excluding tests). List every exported function, class, or pattern tag that lacks a JSDoc comment. Also check docs/ — are there documented patterns whose implementation has diverged? Output a table: file, export, doc status.

5. DEPENDENCY HEALTH: Review the dependency check output. Are there unused dependencies? Missing dependencies (imported but not in package.json)? Outdated versions vs latest? List each finding with a suggested npm command to fix it. Raw deps: ${depsResult.status === 'fulfilled' ? depsResult.value.stdout.slice(0, 4000) : 'depcheck not available'}

6. COMPLEXITY HOTSPOTS: Identify the most complex files in src/ by line count and function count. Flag any file over 300 lines, any function over 50 lines, any deeply nested logic. Suggest specific refactoring strategies for the worst 3 offenders. List each with file path, line count, and the specific section that needs attention.

7. TYPE SAFETY: Check tsconfig.json and src/ for TypeScript strictness. Are there any \`any\` types? \`as\` casts? \`// @ts-ignore\` or \`// @ts-expect-error\` comments? Non-null assertions (\`!\`)? List each with file, line, and a suggestion to make it properly typed.
`

// ─── Phase 3: Synthesize into ranked report ────────────────────────

console.log(chalk.yellow('\n Synthesizing ranked report...\n'))

const synthesis = await pi({ model: PLANNER_MODEL, maxTokens: 4096 })`
You are a technical lead reviewing an automated project audit. Synthesize these 7 parallel check results into a single ranked, actionable report.

Format the report as:

## ☕ Morning Coffee Audit — $(date)

### 🔴 Critical (fix today)
[Items that could cause bugs, security issues, or broken builds]

### 🟡 Important (fix this week)
[Quality issues, coverage gaps, complexity problems]

### 🟢 Nice to Have (when you have time)
[Docs improvements, minor lint, refactoring suggestions]

### 📊 Summary Stats
- Total findings: X
- Critical: X | Important: X | Nice to Have: X
- Estimated effort: X hours

### 🔧 Suggested Patch for #1 Priority Issue
[Concrete code change — what file, what to change, the exact edit]

Here are the 7 check results:

${result.members.map((m, i) => `\n### Check ${i + 1}: ${m.task?.slice(0, 100) || 'result'}\n${m.success ? m.text : `FAILED: ${m.error}`}`).join('\n')}
`

console.log(chalk.bold.green('\n ✓ Morning Coffee Audit complete\n'))
console.log(chalk.dim(`   ${result.successCount}/${result.members.length} checks passed\n`))

// Show failures if any
for (const member of result.members) {
  if (!member.success) {
    console.log(chalk.red(`   ✗ ${member.task?.slice(0, 80)} — ${member.error}`))
  }
}

console.log(synthesis.text)
console.log(chalk.dim('\n ─── Run again tomorrow for a fresh scan ───\n'))
