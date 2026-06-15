#!/usr/bin/env pizx
/**
 * ─── gap-test-hunter.mjs — Test Coverage Gap Analysis ────────────────────
 *
 * Maps every exported function, pattern, and utility against its test
 * coverage, then critiques the gaps to produce a risk-ranked report
 * with concrete test suggestions.
 *
 * Two-phase approach:
 *   Phase 1: Fleet maps exports → checks test existence → ranks gaps
 *   Phase 2: Critique evaluates risk severity and generates test strategies
 *
 * Output: risk-ranked gap report with suggested test cases for each gap.
 * Does NOT auto-generate tests — you review and implement.
 *
 * Run:
 *   pizx self-improve-examples/gap-test-hunter.mjs
 */

import { chalk } from 'zx'

const PLANNER_MODEL = 'deepseek/deepseek-v4-pro'
const WORKER_MODEL = 'deepseek/deepseek-v4-flash'

console.log(chalk.bold.yellow('\n 🎯 Test Gap Hunter — Coverage Risk Analysis\n'))
console.log(chalk.dim(` Planner: ${PLANNER_MODEL}  |  Worker: ${WORKER_MODEL}\n`))

// ─── Phase 1: Run coverage to get raw data ─────────────────────────────

console.log(chalk.yellow(' Gathering test coverage data...\n'))

let coverageData = ''
try {
  const cov = await $`npx vitest --run --coverage --reporter=verbose 2>&1 || true`
  coverageData = cov.stdout.slice(-12000) // tail — coverage summary is at the end
} catch {
  coverageData = 'Coverage not available — proceeding with static analysis only'
}

// ─── Phase 2: Fleet — parallel gap analysis ────────────────────────────

console.log(chalk.yellow(' Analyzing coverage gaps with 4 parallel agents...\n'))

const gapResult = await fleet({
  plannerModel: PLANNER_MODEL,
  workerModel: WORKER_MODEL,
  mode: 'agent',
  concurrency: 4,
})`
1. PATTERN EXPORTS vs TESTS: Read EVERY .ts file in src/patterns/ (excluding index.ts, types.ts, role-sets.ts). For each exported function and exported pattern tag, check src/patterns.test.ts and src/patterns.integration.test.ts for corresponding tests. Flag exports with ZERO test coverage. For each gap, note: file, export name, export complexity (line count, cyclomatic estimate), and whether it's a public API (likely called by users). Rank by: public API + complex + untested = critical gap.

2. CORE UTILITIES vs TESTS: Read src/utils.ts, src/model-picker.ts, src/pi-output.ts, src/skill-loader.ts, src/load-pi-auth.ts, src/load-pi-settings.ts. For each exported function, check src/core.test.ts, src/model-picker.test.ts, and src/pizx.test.ts for test coverage. Flag untested exports. Pay special attention to: error handling paths (are error cases tested?), edge cases (null/undefined/empty inputs), and async functions (are rejection paths tested?).

3. CLI vs TESTS: Read src/cli.ts. This is the CLI entry point — it parses args, handles --help, --version, -p (prompt mode), etc. Check src/pizx.test.ts for CLI-specific tests. Flag: every CLI flag/option combination that isn't tested, every error path (missing args, invalid model, auth failure) that isn't tested, and every output format (quiet, verbose, error) that isn't tested.

4. TEST QUALITY AUDIT: Read ALL test files: src/core.test.ts, src/patterns.test.ts, src/pizx.test.ts, src/model-picker.test.ts, src/patterns.integration.test.ts. For each test file, evaluate: are tests actually asserting meaningful behavior, or just checking that functions don't throw? Are there tests that mock everything and test nothing? Are edge cases covered? Identify the 5 weakest tests and suggest how to strengthen them.

Raw coverage data:
${coverageData.slice(0, 4000)}
`

// ─── Phase 3: Critique — risk-rank the gaps ────────────────────────────

console.log(chalk.yellow(' Critiquing and risk-ranking the gaps...\n'))

// Combine agent outputs for the critique
const gapAnalysis = gapResult.members
  .map((m, i) => `### Analysis ${i + 1}\n${m.success ? m.text : `FAILED: ${m.error}`}`)
  .join('\n\n')

const critiqueResult = await critique({
  plannerModel: PLANNER_MODEL,
  workerModel: WORKER_MODEL,
  rounds: 1,
})`
Here is a test coverage gap analysis for the pizx project:

${gapAnalysis.slice(0, 10000)}

Critique and refine this into a RISK-RANKED gap report. Consider:

1. Impact of the gap (what breaks if the code is wrong? user-facing? internal?)
2. Likelihood of bugs in the untested area (complex logic? edge cases? async?)
3. Difficulty of testing (easy to test = low-hanging fruit)

Format the final output as:

## 🎯 Test Gap Risk Report

### 🔴 CRITICAL — Test immediately (high impact + high bug risk)
[Gaps that could cause user-facing bugs or breakages]
For each: file, export, risk rationale, suggested test strategy

### 🟡 HIGH — Test this sprint
[Important gaps in well-used APIs]
For each: file, export, test suggestion (specific test cases to write)

### 🟢 MEDIUM — Test when touching the code
[Lower-risk gaps in internal utilities]

### ⚪ LOW — Documented risk acceptance
[Gaps that are low-impact or hard-to-test, OK to leave untested for now]

### 📊 Summary
- Total exports analyzed: X
- Untested exports: X
- Critical: X | High: X | Medium: X | Low: X
- Estimated test-writing effort: X hours

### 🧪 Top 3 Test Cases to Write First
[Specific, concrete test descriptions — not vague suggestions]
`

console.log(chalk.bold.green('\n ✓ Test gap analysis complete\n'))
console.log(chalk.dim(`   ${gapResult.successCount}/${gapResult.members.length} gap analysis checks passed\n`))

for (const member of gapResult.members) {
  if (!member.success) {
    console.log(chalk.red(`   ✗ ${member.task?.slice(0, 80)} — ${member.error}`))
  }
}

console.log(chalk.bold.cyan('\nFinal Risk-Ranked Report:'))
console.log(critiqueResult.finalContent || critiqueResult.text)
console.log(chalk.dim('\n ─── Good tests prove correctness; great tests prevent regressions ───\n'))
