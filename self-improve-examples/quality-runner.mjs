#!/usr/bin/env pizx
/**
 * ─── quality-runner.mjs — Quality Suite Orchestrator ────────────────────
 *
 * Runs all 5 quality-focused self-improvement scripts in sequence,
 * merges their .patch files, and prints a unified summary.
 *
 * Scripts run in order:
 *   1. review-debate.mjs       — Multi-perspective code review
 *   2. review-self-verify.mjs  — Code self-consistency check
 *   3. hunt-bugs.mjs           — 6-category bug scan
 *   4. heal-build.mjs          — Broken test auto-healer (OPTIONAL — skip with --skip heal)
 *   5. fuzz-adversarial.mjs    — Edge case attacker vs defender
 *
 * After all scripts complete, patches are merged and a summary is printed.
 *
 * Run:
 *   pizx self-improve-examples/quality-runner.mjs
 *   pizx self-improve-examples/quality-runner.mjs --skip heal-build
 *   pizx self-improve-examples/quality-runner.mjs --target src/patterns/
 */

import { chalk } from 'zx'
import { readdir, stat, mkdir, readFile, writeFile } from 'node:fs/promises'
import { join, basename } from 'node:path'

const PLANNER_MODEL = 'deepseek/deepseek-v4-pro'

// ════════════════════════════════════════════════════════════════════════

// Parse CLI args
const args = process.argv.slice(2)
const skipSet = new Set(args.filter((_, i) => args[i - 1] === '--skip').map(a => a.toLowerCase()))
const targetArg = args.includes('--target') ? args[args.indexOf('--target') + 1] : ''

const SCRIPTS_DIR = import.meta.dirname
const PATCHES_DIR = join(SCRIPTS_DIR, 'patches')

// Scripts to run (in order)
const SCRIPTS = [
  { name: 'review-debate', file: 'review-debate.mjs', emoji: '🔍' },
  { name: 'review-self-verify', file: 'review-self-verify.mjs', emoji: '🔄' },
  { name: 'hunt-bugs', file: 'hunt-bugs.mjs', emoji: '🐛' },
  { name: 'heal-build', file: 'heal-build.mjs', emoji: '🩺', skippable: true },
  { name: 'fuzz-adversarial', file: 'fuzz-adversarial.mjs', emoji: '🧨' },
]

// ════════════════════════════════════════════════════════════════════════

console.log(chalk.bold.blue('\n ╔══════════════════════════════════════════════╗'))
console.log(chalk.bold.blue(' ║  🛡️  Quality Suite — Full Self-Improvement   ║'))
console.log(chalk.bold.blue(' ╚══════════════════════════════════════════════╝\n'))

const toSkip = []
const toRun = []

for (const script of SCRIPTS) {
  if (script.skippable && skipSet.has(script.name)) {
    toSkip.push(script)
  } else {
    toRun.push(script)
  }
}

if (toSkip.length > 0) {
  console.log(chalk.dim(` Skipping: ${toSkip.map(s => s.name).join(', ')}\n`))
}
if (targetArg) {
  console.log(chalk.dim(` Target: ${targetArg}\n`))
}

console.log(chalk.dim(` Running ${toRun.length} quality script(s)...\n`))

// Track results
const results = []
const startTime = Date.now()

// ─── Run each script sequentially ────────────────────────────────────────

for (const script of toRun) {
  const scriptPath = join(SCRIPTS_DIR, script.file)
  console.log(chalk.yellow(`\n ${script.emoji} Running ${script.name}...`))
  console.log(chalk.dim(` ─${'─'.repeat(40)}`))

  const scriptStart = Date.now()
  let success = false
  let error = ''

  try {
    const targetEnv = targetArg ? { TARGET: targetArg } : {}
    const result = await $`${process.execPath} ${SCRIPTS_DIR}/../dist/cli.js ${scriptPath}`.env({
      ...process.env,
      ...targetEnv,
      FORCE_COLOR: '1',
    })

    success = result.exitCode === 0
    if (!success) {
      error = result.stderr?.slice(0, 500) || `Exit code: ${result.exitCode}`
    }

    // Print last few lines of output
    const lines = (result.stdout || '').trim().split('\n')
    console.log(chalk.dim(lines.slice(-5).join('\n')))

  } catch (e) {
    success = false
    error = e.message?.slice(0, 500) || 'Unknown error'
    console.log(chalk.red(`   ✗ Failed: ${error}`))
  }

  const duration = Date.now() - scriptStart
  results.push({ name: script.name, emoji: script.emoji, success, duration, error })
  console.log(chalk.dim(`   ${success ? chalk.green('✓') : chalk.red('✗')} ${duration}ms`))
}

// ─── Collect and count all .patch files ──────────────────────────────────

console.log(chalk.yellow('\n\n Collecting .patch files from all scripts...\n'))

let totalPatches = 0
const patchesByScript = {}

for (const scriptDir of toRun.map(s => s.name)) {
  const dir = join(PATCHES_DIR, scriptDir)
  try {
    const files = await readdir(dir)
    const patchFiles = files.filter(f => f.endsWith('.patch'))
    patchesByScript[scriptDir] = patchFiles.length
    totalPatches += patchFiles.length
  } catch {
    patchesByScript[scriptDir] = 0
  }
}

// ─── Merge all patches into a unified summary ────────────────────────────

const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19)
const summaryPath = join(PATCHES_DIR, `quality-summary-${timestamp}.txt`)

let summaryContent = [
  `╔══════════════════════════════════════════════╗`,
  `║  Quality Suite Summary                       ║`,
  `╚══════════════════════════════════════════════╝`,
  ``,
  `Date: ${new Date().toISOString().replace('T', ' ').slice(0, 19)} UTC`,
  `Target: ${targetArg || 'full project'}`,
  `Total scripts: ${toRun.length}  |  Skipped: ${toSkip.length}`,
  `Total duration: ${((Date.now() - startTime) / 1000).toFixed(1)}s`,
  ``,
  `─── Results ───`,
]

for (const r of results) {
  const icon = r.success ? '✓' : '✗'
  summaryContent.push(`  ${icon} ${r.name}: ${patchesByScript[r.name] || 0} patch(es) — ${r.duration}ms${!r.success ? ` (${r.error})` : ''}`)
}

summaryContent.push(``)
summaryContent.push(`─── Patch Summary ───`)
summaryContent.push(`Total .patch files: ${totalPatches}`)

for (const [script, count] of Object.entries(patchesByScript)) {
  summaryContent.push(`  ${script}/: ${count} patch(es)`)
}

summaryContent.push(``)
summaryContent.push(`Apply all patches:`)
summaryContent.push(`  for d in ${PATCHES_DIR}/*/; do git apply "$d"*.patch; done`)
summaryContent.push(``)
summaryContent.push(`Or review per-category:`)
for (const script of toRun) {
  summaryContent.push(`  ls ${PATCHES_DIR}/${script.name}/`)
}

await writeFile(summaryPath, summaryContent.join('\n') + '\n', 'utf-8')

// ─── Final Report ─────────────────────────────────────────────────────────

const totalDuration = ((Date.now() - startTime) / 1000).toFixed(1)
const successCount = results.filter(r => r.success).length

console.log(chalk.bold.green('\n ╔══════════════════════════════════════════════╗'))
console.log(chalk.bold.green(' ║  Quality Suite Complete                      ║'))
console.log(chalk.bold.green(' ╚══════════════════════════════════════════════╝\n'))

console.log(chalk.dim(`   ${successCount}/${results.length} scripts passed in ${totalDuration}s\n`))

if (totalPatches === 0) {
  console.log(chalk.green(' 🎉 Zero issues found! Your code is solid.\n'))
} else {
  console.log(chalk.yellow(` 📝 ${totalPatches} total patch(es) found across all scripts:\n`))
  for (const [script, count] of Object.entries(patchesByScript)) {
    if (count > 0) {
      console.log(`   ${chalk.white(count)} ${chalk.dim(`from ${script}`)}`)
    }
  }
  console.log(chalk.dim(`\n   Summary: ${summaryPath}`))
  console.log(chalk.dim('   Review patches per-category, then apply with: git apply <patch>\n'))
}

// Show any failures
const failures = results.filter(r => !r.success)
if (failures.length > 0) {
  console.log(chalk.red(' Failed scripts:'))
  for (const f of failures) {
    console.log(chalk.red(`   ✗ ${f.name}: ${f.error}`))
  }
  console.log()
}

console.log(chalk.dim(' ─── Run weekly to keep quality trending upward ───\n'))
