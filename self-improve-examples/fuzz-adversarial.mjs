#!/usr/bin/env pizx
/**
 * ─── fuzz-adversarial.mjs — Adversarial Edge-Case Testing ────────────────
 *
 * Uses a 2-role Debate to surface edge cases that could break your code.
 * The Attacker generates semantic edge cases (valid but unexpected inputs),
 * and the Defender produces fixes. After 2 rounds, converges on a final
 * .patch containing BOTH the failing test AND the fix.
 *
 * This is NOT random fuzzing — the Attacker thinks like a malicious user
 * or edge-case environment, finding semantic gaps in input validation,
 * error handling, and state management.
 *
 * Output: .patch in self-improve-examples/patches/fuzz-adversarial/
 * Each .patch includes the failing test case + the code fix.
 *
 * Run:
 *   pizx self-improve-examples/fuzz-adversarial.mjs
 *   TARGET=src/patterns/orchestrator.ts pizx self-improve-examples/fuzz-adversarial.mjs
 */

import { chalk } from 'zx'
import { writeFile, mkdir } from 'node:fs/promises'
import { join } from 'node:path'

const PLANNER_MODEL = 'deepseek/deepseek-v4-pro'
const WORKER_MODEL = 'deepseek/deepseek-v4-flash'
const PATCHES_DIR = join(import.meta.dirname, 'patches', 'fuzz-adversarial')
const TARGET = process.env.TARGET || 'src/'

// ════════════════════════════════════════════════════════════════════════

console.log(chalk.bold.magenta('\n 🧨 Fuzz Adversarial — Attacker vs Defender\n'))
console.log(chalk.dim(` Planner: ${PLANNER_MODEL}  |  Worker: ${WORKER_MODEL}\n`))
console.log(chalk.dim(` Target: ${TARGET}\n`))

await mkdir(PATCHES_DIR, { recursive: true })

// ─── Phase 1: Gather target code ─────────────────────────────────────────

console.log(chalk.yellow(' Reading target files...\n'))

let targetContent = ''
try {
  // List target files
  const fileList = (await $`find ${TARGET} -name '*.ts' -not -name '*.test.ts' -not -name '*.d.ts' 2>/dev/null | head -20`).stdout.trim()
  console.log(chalk.dim(`   Files to fuzz: ${fileList.split('\n').filter(Boolean).length}\n`))

  // Read key files (limit total content)
  for (const file of fileList.split('\n').filter(Boolean).slice(0, 8)) {
    try {
      const content = await readFile(file, 'utf-8')
      targetContent += `\n=== ${file} ===\n${content.slice(0, 2000)}\n`
    } catch {
      // skip unreadable files
    }
  }
} catch {
  targetContent = 'Could not read target files'
}

if (!targetContent.trim()) {
  console.log(chalk.red(' ✗ No target files found.'))
  process.exit(0)
}

// ─── Phase 2: Adversarial Debate ─────────────────────────────────────────

console.log(chalk.yellow(' Running Attacker vs Defender debate...\n'))

const debateResult = await debate({
  plannerModel: PLANNER_MODEL,
  workerModel: WORKER_MODEL,
  perspectives: 2,
  rounds: 2,
  mode: 'agent',
  qualityCheck: true,
  roles: [
    `Attacker: Your mission is to find edge cases that would BREAK this code. Think about:
- NULL/UNDEFINED: What if every optional parameter is undefined? Every string is empty?
- BOUNDARY VALUES: Empty arrays, MAX_INT, negative numbers, zero, NaN, Infinity
- TYPE CONFUSION: What if a number is passed as string? Array passed where object expected?
- CONCURRENCY: What if this function is called twice simultaneously? Called during cleanup?
- STATE: What if called out of order? Before init? After dispose? During transition?
- ENVIRONMENT: What if the file system is read-only? Network is down? Memory is exhausted?
- INJECTION: What if input contains control characters, HTML, SQL fragments, shell metacharacters?
For each edge case, output: what input/scenario, what would break, why it's a real risk.`,
    `Defender: Your mission is to fix the code so it handles the Attacker\\'s edge cases gracefully. For each edge case:
- Determine if it\\'s a realistic risk (not all edge cases deserve guards)
- If realistic, produce the MINIMAL fix — add a guard, early return, default value, or validation
- Prefer defensive patterns: fail fast with clear errors, not silent degradation
- Output the exact code change needed`,
  ],
})`
Fuzz-test this code for edge cases. Target files:

${targetContent.slice(0, 12000)}

The Attacker generates edge cases that could break the code.
The Defender produces minimal fixes for realistic edge cases.
After 2 rounds, converge on confirmed edge cases with fixes.

For each CONFIRMED edge case, output:

ISSUE:
  file: <path>
  function: <function or section name>
  edge_case: <what input/scenario triggers the bug>
  impact: <what would break>
  severity: <HIGH|MEDIUM|LOW>
  confidence: <0.0-1.0>
ATTACK:
<the test case that demonstrates the issue — valid code that triggers the bug>
FIX:
<exact code fix to handle this edge case>

DO NOT wrap in markdown fences. Use the ISSUE:/ATTACK:/FIX: format exactly.
`

// ─── Phase 3: Generate .patch files (test + fix together) ────────────────

console.log(chalk.yellow(' Generating .patch files with test case + fix...\n'))

const synthesis = debateResult.synthesis || ''
const issueBlocks = synthesis.split(/^ISSUE:/m).filter(b => b.trim())

let patchCount = 0

for (const block of issueBlocks) {
  const attackMatch = block.match(/^ATTACK:\n([\s\S]*?)(?=^FIX:|$)/m)
  const fixMatch = block.match(/^FIX:\n([\s\S]*?)(?=^ISSUE:|$)/m)
  if (!fixMatch) continue

  const fix = fixMatch[1].trim()
  if (!fix) continue

  const attack = attackMatch ? attackMatch[1].trim() : 'No test case provided'
  const fileMatch = block.match(/file:\s*(.+)/)
  const fnMatch = block.match(/function:\s*(.+)/)
  const edgeMatch = block.match(/edge_case:\s*(.+)/)
  const impactMatch = block.match(/impact:\s*(.+)/)
  const severityMatch = block.match(/severity:\s*(.+)/)
  const confidenceMatch = block.match(/confidence:\s*([\d.]+)/)

  const filename = fileMatch ? fileMatch[1].trim() : 'unknown'
  const fn = fnMatch ? fnMatch[1].trim() : 'unknown'
  const edgeCase = edgeMatch ? edgeMatch[1].trim() : 'unknown'
  const impact = impactMatch ? impactMatch[1].trim() : 'N/A'
  const severity = severityMatch ? severityMatch[1].trim() : 'MEDIUM'
  const confidence = confidenceMatch ? parseFloat(confidenceMatch[1]) : 0.5

  const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19)
  const safeName = fn.slice(0, 40).toLowerCase().replace(/[^a-z0-9-]/g, '-').replace(/-+/g, '-')
  const patchName = `${timestamp}-fuzz-${safeName}.patch`

  const patchContent = [
    `# Generated by: fuzz-adversarial.mjs`,
    `# Date: ${new Date().toISOString().replace('T', ' ').slice(0, 19)} UTC`,
    `# Target: ${filename} — ${fn}`,
    `# Edge case: ${edgeCase}`,
    `# Impact: ${impact}`,
    `# Severity: ${severity}`,
    `# Confidence: ${confidence.toFixed(2)}`,
    ``,
    `# ─── ATTACK (test case that demonstrates the bug) ───`,
    `# Apply this test FIRST, verify it fails, then apply the fix`,
    attack,
    ``,
    `# ─── FIX ───`,
    fix,
    ``,
    `# VERIFY: Run the test above, confirm it fails, then apply the fix and confirm it passes`,
    ``,
  ].join('\n')

  await writeFile(join(PATCHES_DIR, patchName), patchContent, 'utf-8')
  patchCount++
}

// ─── Report ──────────────────────────────────────────────────────────────

console.log(chalk.bold.green(`\n ✓ Fuzz adversarial complete\n`))
console.log(chalk.dim(`   Quality score: ${(debateResult.qualityReview?.score ?? 0).toFixed(2)}\n`))

if (patchCount === 0) {
  console.log(chalk.green(' 🎉 No exploitable edge cases found! Defense holds.\n'))
} else {
  console.log(chalk.yellow(` 🧨 ${patchCount} edge case(s) found. Patches in:`))
  console.log(chalk.white(`   ${PATCHES_DIR}/\n`))
  console.log(chalk.dim('   Each .patch contains the ATTACK (test case) + FIX — apply test first, verify it fails,'))
  console.log(chalk.dim('   then apply the fix and confirm the test passes.\n'))
}

if (debateResult.qualityReview?.recommendation) {
  console.log(chalk.cyan(' Quality assessment:'))
  console.log(chalk.dim(`   ${debateResult.qualityReview.recommendation}\n`))
}

console.log(chalk.dim(' ─── The best defense is knowing how you would be attacked ───\n'))
