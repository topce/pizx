#!/usr/bin/env pizx
/**
 * ─── review-self-verify.mjs — Code Self-Verification Pipeline ────────────
 *
 * Checks code against ITSELF — verifies that type assertions, comments,
 * and internal contracts are actually enforced in the implementation.
 * Unlike verify-spec-to-code.mjs (docs vs code), this checks for internal
 * inconsistency: broken promises, misleading types, untested assertions.
 *
 * Two pipeline stages:
 *   Stage 1: EXTRACT implied promises from code
 *   Stage 2: VERIFY each promise against the actual implementation
 *
 * Output: .patch files in self-improve-examples/patches/review-self-verify/
 *
 * Run:
 *   pizx self-improve-examples/review-self-verify.mjs
 *   TARGET=src/patterns/ pizx self-improve-examples/review-self-verify.mjs
 */

import { chalk } from 'zx'
import { writeFile, mkdir } from 'node:fs/promises'
import { join } from 'node:path'

const PLANNER_MODEL = 'deepseek/deepseek-v4-pro'
const WORKER_MODEL = 'deepseek/deepseek-v4-flash'
const PATCHES_DIR = join(import.meta.dirname, 'patches', 'review-self-verify')
const TARGET = process.env.TARGET || 'src/'

// ════════════════════════════════════════════════════════════════════════

console.log(chalk.bold.magenta('\n 🔄 Self-Verify — Code Against Itself\n'))
console.log(chalk.dim(` Planner: ${PLANNER_MODEL}  |  Worker: ${WORKER_MODEL}\n`))
console.log(chalk.dim(` Target: ${TARGET}\n`))

await mkdir(PATCHES_DIR, { recursive: true })

// ─── Pipeline: Extract → Verify ──────────────────────────────────────────

console.log(chalk.yellow(' Stage 1: Extracting implied promises from code...\n'))

const result = await pipeline({
  plannerModel: PLANNER_MODEL,
  workerModel: WORKER_MODEL,
  mode: 'agent',
  stages: [
    // ─── Stage 1: EXTRACT ────────────────────────────────────────────
    (async () => {
      const claims = await pi({ model: PLANNER_MODEL, maxTokens: 4096 })`
Read source files in the ${TARGET} directory (excluding test files and generated/).
For each file, extract EVERY implied promise — things the code claims about itself:

1. TYPE ASSERTIONS that aren't tested:
   - "as Type" casts — what if the value is NOT that type at runtime?
   - "!" non-null assertions — is there a path where this IS null?
   - "@ts-ignore" / "@ts-expect-error" — is the suppression still needed?

2. CONTRACT PROMISES made in comments/docstrings:
   - "must be called after init()" — check all callers
   - "returns null if not found" — check all callers handle null
   - "throws if X" — check all callers have try/catch
   - "accepts string or string[]" — check for type narrowing bugs

3. CONTROL FLOW promises:
   - Early returns followed by code that assumes the return didn't happen
   - "if (x) { ... }" followed by code that assumes x is true/false
   - "try { ... } catch" where the catch assumes what error type was thrown

4. TEST ASSERTIONS:
   - Tests that assert specific behavior but don't test the inverse
   - Tests that mock in a way that hides real behavior

For EACH promise found, output:
PROMISE:
  file: <path>
  line: <number>
  claim: <what the code claims/asserts>
  type: <TYPE_ASSERTION|CONTRACT|CONTROL_FLOW|TEST_GAP>

DO NOT wrap in markdown fences.
`
      return claims.text
    })(),

    // ─── Stage 2: VERIFY ─────────────────────────────────────────────
    (prevOutput) => pi({ model: WORKER_MODEL, maxTokens: 4096 })`
You are a code correctness auditor. Here are implied promises extracted from the ${TARGET} codebase:

${prevOutput.slice(0, 8000)}

For EACH promise, verify it against the actual code:

1. Read the file at the specified line
2. Determine if the promise is actually enforced
3. If BROKEN: the code claims one thing but does another
4. If WEAK: the promise is technically true but fragile
5. If OK: the promise is verified true

For each BROKEN or WEAK promise, output:

ISSUE:
  file: <path>
  line: <number>
  claim: <what the code claims>
  status: <BROKEN|WEAK>
  evidence: <why it's broken/weak>
  severity: <HIGH|MEDIUM|LOW>
  confidence: <0.0-1.0>
FIX:
<exact code fix>

For each OK promise, output:
OK: <file>:<line> — <one-line summary of verification>

DO NOT wrap in markdown fences.
`
  ],
})

// ─── Phase 2: Generate .patch files ──────────────────────────────────────

console.log(chalk.yellow(' Generating .patch files from verification results...\n'))

const stageOutput = (result.stages?.[1]?.output || result.stages?.[0]?.output || '').slice(0)
const issueBlocks = stageOutput.split(/^ISSUE:/m).filter(b => b.trim())

let patchCount = 0
let okCount = 0

for (const block of issueBlocks) {
  const fixMatch = block.match(/^FIX:\n([\s\S]*?)(?=^ISSUE:|^OK:|$)/m)
  if (!fixMatch) continue

  const fix = fixMatch[1].trim()
  if (!fix) continue

  const fileMatch = block.match(/file:\s*(.+)/)
  const lineMatch = block.match(/line:\s*(\d+)/)
  const claimMatch = block.match(/claim:\s*(.+)/)
  const statusMatch = block.match(/status:\s*(.+)/)
  const severityMatch = block.match(/severity:\s*(.+)/)
  const confidenceMatch = block.match(/confidence:\s*([\d.]+)/)
  const evidenceMatch = block.match(/evidence:\s*(.+)/)

  const filename = fileMatch ? fileMatch[1].trim() : 'unknown'
  const line = lineMatch ? parseInt(lineMatch[1]) : 0
  const claim = claimMatch ? claimMatch[1].trim() : 'unknown'
  const status = statusMatch ? statusMatch[1].trim() : 'UNKNOWN'
  const severity = severityMatch ? severityMatch[1].trim() : 'MEDIUM'
  const confidence = confidenceMatch ? parseFloat(confidenceMatch[1]) : 0.5
  const evidence = evidenceMatch ? evidenceMatch[1].trim() : 'N/A'

  const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19)
  const safeClaim = claim.slice(0, 60).toLowerCase().replace(/[^a-z0-9-]/g, '-').replace(/-+/g, '-')
  const patchName = `${timestamp}-${status.toLowerCase()}-${safeClaim}.patch`

  const patchContent = [
    `# Generated by: review-self-verify.mjs`,
    `# Date: ${new Date().toISOString().replace('T', ' ').slice(0, 19)} UTC`,
    `# Claim: ${claim}`,
    `# Status: ${status}`,
    `# Confidence: ${confidence.toFixed(2)}`,
    `# Severity: ${severity}`,
    `# Target: ${filename}:${line}`,
    `# Evidence: ${evidence}`,
    ``,
    `# ─── Fix ───`,
    fix,
    ``,
  ].join('\n')

  await writeFile(join(PATCHES_DIR, patchName), patchContent, 'utf-8')
  patchCount++
}

// Count OK items
const okMatches = stageOutput.match(/^OK:/gm)
okCount = okMatches ? okMatches.length : 0

// ─── Report ──────────────────────────────────────────────────────────────

console.log(chalk.bold.green(`\n ✓ Self-verification complete\n`))

for (let i = 0; i < (result.stages || []).length; i++) {
  const stage = result.stages[i]
  const icon = stage.success ? chalk.green('✓') : chalk.red('✗')
  const label = i === 0 ? 'Extract' : 'Verify'
  console.log(chalk.dim(`   ${icon} Stage ${i + 1} (${label}): ${stage.durationMs || '?'}ms`))
}

if (patchCount === 0 && okCount > 0) {
  console.log(chalk.green(`\n 🎉 All ${okCount} promises verified OK! No issues found.\n`))
} else if (patchCount > 0) {
  console.log(chalk.yellow(`\n 📝 ${patchCount} broken/weak promise(s) found (${okCount} OK)`))
  console.log(chalk.white(`   Patches: ${PATCHES_DIR}/\n`))
  console.log(chalk.dim('   Review and apply with: git apply') + chalk.white(` ${PATCHES_DIR}/*.patch\n`))
}

console.log(chalk.dim(' ─── Self-consistency is the first line of correctness ───\n'))
