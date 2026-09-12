#!/usr/bin/env pizx
/// <reference types="@topce/pizx/globals" />

// ── fleet — parallelization: sectioning ─────────────────────────────────────
// Pattern (from Anthropic's "Building effective agents"): split a task into
// independent subtasks and run them in parallel, then aggregate. Each subtask
// gets a focused call instead of one overloaded prompt.
//
// Slot:   worker → π  (runs each task)
// Run:    pizx examples/word-fleet.mjs
//
// fleet splits its template into tasks: one per line, or a bullet/numbered
// list. The worker letter runs them `concurrency` at a time and the results
// come back as a numbered list, first 200 chars each — this word is for many
// *small* answers (subjects, verdicts, one-line summaries), not for N essays.
//
// The tasks below are built from the repo, one per file in the last commit.
//
// level 4/5 ●●●●○ · previous: examples/acp-basic.mjs (run any ACP agent (α)) · next: examples/word-chain.mjs

import { chalk } from 'zx'

const MODEL = 'deepseek/deepseek-v4-flash'

// A CLI can be on PATH and still be unusable (wrong version, not logged in).
// Probing `--version` before an optional section keeps these examples honest:
// they either do the real work or say plainly why they did not.
async function usable(bin) {
  const probe = await $({ nothrow: true })`${bin} --version`
  return probe.exitCode === 0
}

// ── Real work: one commit subject per file in the current change ───────────
// Building tasks from git means the demo re-runs meaningfully on any commit.
const changed = (await $`git show --name-only --format= HEAD`).stdout.trim().split('\n').filter(Boolean)
const files = changed.slice(0, 6)
const fallbackDiff = files.length === 0 ? (await $`git show HEAD`).stdout.trim() : ''

// One task per line — fleet's splitter drops the bullet and runs the rest.
const tasks = []
for (const file of files) {
  const diff = (await $({ nothrow: true })`git show --format= -- ${file}`).stdout.trim()
  tasks.push(
    `Write one conventional-commit subject (max 60 chars) for the change to ${file}, in this diff: ${(diff || fallbackDiff).replace(/\s+/g, ' ').slice(0, 500)}`
  )
}

if (tasks.length === 0) {
  echo(chalk.yellow('\n no changed files in HEAD to describe\n'))
  process.exit(0)
}

echo(chalk.bold(`\n fleet — ${tasks.length} commit subjects in parallel (concurrency 3)\n`))
for (const file of files) echo(chalk.dim(`  · ${file}`))

const result = await fleet({ model: MODEL, concurrency: 3 })`${tasks.join('\n')}`

echo(`\n${chalk.green(result.text)}`)
echo(chalk.dim(`\nduration: ${result.duration}ms\n`))

// Swap the worker slot by name or tag — the fan-out stays, the letter changes:
//
//   await fleet({ worker: 'Π' })`
//   fix the failing tests in src/core/llm.test.ts
//   update the CHANGELOG for the new letter`          // parallel coding agents
//   await fleet({ worker: 'Ξ' })`…`                    // the custom commit letter
//   await fleet({ worker: 'vote', concurrency: 1 })`…` // every worker votes
//   await fleet({ worker: π({ model: 'cheap-model' }), concurrency: 8 })`…`
//
// Tasks can come from anywhere. A release-notes pass over git history:
//   const commits = (await $`git log --oneline -12`).stdout.trim().split('\n')
//   const prompts = commits.map((c) => `Rewrite as one user-facing bullet: ${c}`)
//   await fleet({ concurrency: 4 })`${prompts.join('\n')}`

// ── α live — the same fan-out with parallel ACP agents ──────────────────────
// `server` is forwarded through the word to each α worker. Needs kiro-cli on
// PATH and authenticated (`kiro-cli login` once); skips cleanly otherwise.
// See examples/acp-word-slots.mjs for the version that lets agents write.
const SERVER = ['kiro-cli', 'acp']
if (await usable(SERVER[0])) {
  echo(chalk.bold(`\nfleet — worker → α (${SERVER.join(' ')})\n`))
  const acpFleet = await fleet({
    worker: 'α',
    server: SERVER,
    concurrency: 2,
    quiet: true,
  })`
name the letters that src/plugins/pi.ts registers, with their aliases
name the letters that src/plugins/acp.ts registers, with their aliases
`
  echo(chalk.green(acpFleet.text))
  echo(chalk.dim(`\nduration: ${acpFleet.duration}ms\n`))
} else {
  echo(chalk.dim(`\n(skipped — ${SERVER[0]} is not usable here; point \`server\` at any ACP v1 agent)\n`))
}
