#!/usr/bin/env pizx
// ─── basic-capital-pi.mjs — the coding agent as a triage step ──────────────
//
// Π runs pi-coding-agent with real tools (read, bash, edit, write, grep…).
// That is what separates it from π: it can go and look things up in the repo
// instead of working from whatever you pasted into the prompt.
//
// This script uses it the way CI would — run the suite, and only when it
// fails, let an agent diagnose *with the actual files in front of it*. Note
// the read-only tool list: triage reports, it does not edit.
//
// level 2/5 ●●○○○ · previous: examples/typed-globals.mjs (letters as typed values; exit codes) · next: examples/trace-and-cache.mjs
//
// Run:   pizx examples/basic-capital-pi.mjs
//        pizx examples/basic-capital-pi.mjs --trace

import { chalk } from 'zx'

const MODEL = 'deepseek/deepseek-v4-flash'

echo(chalk.bold('\n Π — coding agent on the real test suite\n'))

// ── 1. The shell runs the suite (nothrow: a red suite is data, not a crash) ─
echo(chalk.dim('  $ npm test --silent  (this takes a moment)'))
const suite = await $({ nothrow: true })`npm test --silent`
const output = `${suite.stdout}\n${suite.stderr}`.trim()
const passed = suite.exitCode === 0
const summary = output.split('\n').filter((l) => /Test Files|Tests |FAIL|✗|×/.test(l)).slice(0, 12)

echo(`  result: ${passed ? chalk.green('green') : chalk.red(`red (exit ${suite.exitCode})`)}`)
for (const line of summary) echo(chalk.dim(`    ${line.trim()}`))

if (passed) {
  // Green suite still has a job for an agent: say what the tests no longer
  // cover. Cheap check, real answer, no edits.
  const gaps = await Π({ model: MODEL, quiet: true, tools: ['read', 'bash', 'ls'] })`
The test suite passes. Look at src/ and src/*.test.ts and report the two most
valuable untested behaviours, with the file each belongs in. Be specific and
brief — no code, just the two gaps and why they matter.
`
  echo(chalk.dim('\n  Π coverage gaps (read-only):'))
  echo(gaps.text.trim().split('\n').map((l) => `    │ ${l}`).join('\n'))
  echo(chalk.dim(`\n    ${gaps.turnCount} turns · ${gaps.duration}ms`))
} else {
  // ── 2. Π diagnoses, with repo access and the failure output ──────────────
  // The tool list is the contract: read/bash/ls can look, not touch.
  const triage = await Π({
    model: MODEL,
    quiet: true,
    tools: ['read', 'bash', 'ls'],
    maxRetries: 2,
  })`
The test suite is failing. Diagnose it against the real files.

Failure output:
${output.slice(-4000)}

Do not change any files. Reply with:
  cause:  the most likely root cause, naming the file and symbol
  check:  the single command a human should run to confirm it
  fix:    the minimal change, described in two sentences
`
  echo(chalk.dim('\n  Π triage (read-only tools):'))
  echo(triage.text.trim().split('\n').map((l) => `    │ ${l}`).join('\n'))
  echo(chalk.dim(`\n    ${triage.turnCount} turns · ${triage.duration}ms`))
  echo(chalk.yellow('\n  → to let it actually fix the failure, drop `tools` (or add edit/write)'))
}

// ── Notes ──────────────────────────────────────────────────────────────────
// * Π is never cached — agent runs mutate the filesystem. π calls are.
// * `tools: ['read','bash','ls']` is how you get an agent you can put in CI.
// * Sessions are pooled per (model, cwd, tools): a second Π call in this
//   script would continue the same conversation with the files already read.
// * `await Π({ confirm: { semi: true } })`…`` gates each phase on approval.
