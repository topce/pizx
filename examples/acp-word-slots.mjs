#!/usr/bin/env pizx
/// <reference types="@topce/pizx/globals" />

// ── α in the word slots — ACP agents inside the word patterns ───────────────
// The α letter drives any ACP-compatible coding agent. Like Π, it fills the
// agent slots of the word library: pass `server` next to the slot name and
// the word forwards it (plus `cwd`, `timeoutMs`, …) to the α slot.
//
// Three slots get exercised, all inside a scratch directory so the agents'
// file writes stay out of the repo:
//   ralph       execute → α   (analyze/plan/review stay on π)
//   fleet       worker  → α   (parallel ACP agents — sectioning)
//   orchestrate worker  → α   (decompose + parallel ACP agents + synthesis)
//
// Needs: kiro-cli on PATH and authenticated (`kiro-cli login` once). The
// sections skip cleanly when the binary is missing; any ACP v1 server works
// — point SERVER at ['npx', '@github/copilot', '--acp'] or your own.
//
// Run:    node dist/cli.js examples/acp-word-slots.mjs
//         pizx examples/acp-word-slots.mjs

import { $, chalk, fs, os, path } from 'zx'

const SERVER = ['kiro-cli', 'acp']
const MODEL = 'deepseek/deepseek-v4-flash'
const TIMEOUT = 300000

const hasServer = (await $({ nothrow: true })`which ${SERVER[0]}`).exitCode === 0
if (!hasServer) {
  console.log(chalk.dim(`(skipped — ${SERVER[0]} not found; point \`server\` at any ACP v1 agent)\n`))
  process.exit(0)
}

// Scratch dir: the word forwards `cwd` to the α slot, so the agents' writes
// land here instead of the repo.
const demo = path.join(os.tmpdir(), `pizx-acp-words-${Date.now()}`)
await fs.promises.mkdir(demo, { recursive: true })

console.log(chalk.bold('\n1) ralph — the agent loop with an ACP executor\n'))
console.log(chalk.dim(`(execute → α, cwd → ${demo})\n`))

const looped = await ralph({
  execute: 'α', // slot replacement: the ACP letter fills the executor
  server: SERVER, // forwarded to the α slot by the word
  cwd: demo, // … and so is the working directory
  model: MODEL, // forwarded to the π slots (analyze/plan/review)
  maxIterations: 2, // a second pass if the review says ITERATE
  timeoutMs: TIMEOUT,
})`
create NOTES.md containing exactly one line: A pizx word is an AI pattern composed from replaceable letter slots
`
console.log(chalk.green(looped.text))
console.log(chalk.dim(`\nduration: ${looped.duration}ms\n`))

// Tolerant verification: report instead of crashing when the agent chose not
// to write the file — the demo continues either way.
console.log(chalk.cyan('verifying NOTES.md:'))
const notes = path.join(demo, 'NOTES.md')
if (fs.existsSync(notes)) {
  console.log(await fs.promises.readFile(notes, 'utf-8'))
} else {
  console.log(chalk.yellow('  (NOTES.md not created — the agent skipped it; see the result text above)\n'))
}

console.log(chalk.bold('\n2) fleet — two parallel ACP agents (sectioning)\n'))

const fanned = await fleet({
  worker: 'α',
  server: SERVER,
  cwd: demo,
  concurrency: 2,
  timeoutMs: TIMEOUT,
})`
create A.md containing one line that summarizes git merge
create B.md containing one line that summarizes git rebase
`
console.log(chalk.green(fanned.text))
console.log(chalk.dim(`\nduration: ${fanned.duration}ms\n`))

// Tolerant verification: report per file, never crash the demo.
console.log(chalk.cyan('verifying A.md and B.md:'))
for (const file of ['A.md', 'B.md']) {
  const p = path.join(demo, file)
  if (fs.existsSync(p)) {
    console.log(`${file}: ${(await fs.promises.readFile(p, 'utf-8')).trim()}`)
  } else {
    console.log(chalk.yellow(`  (${file} not created — that agent failed or skipped; see the ✗ above)\n`))
  }
}

console.log(chalk.bold('\n3) orchestrate — decompose, parallel ACP agents, synthesize\n'))

const orchestrated = await orchestrate({
  worker: 'α',
  server: SERVER,
  cwd: demo,
  model: MODEL,
  maxWorkers: 2,
  concurrency: 2,
  timeoutMs: TIMEOUT,
})`
create two files, REASON-1.md and REASON-2.md, each containing one different
reason to use a plugin framework for AI scripting
`
console.log(chalk.green(orchestrated.text))
console.log(chalk.dim(`\nduration: ${orchestrated.duration}ms\n`))
console.log(chalk.cyan('verifying the scratch dir:'))
console.log((await $({ cwd: demo })`ls`).stdout)

await fs.promises.rm(demo, { recursive: true, force: true })
console.log(chalk.dim(`(scratch dir removed: ${demo})\n`))

// Bind a pre-configured tag instead — the tag carries its own options:
//   await ralph({ execute: α({ server: SERVER }) })`…`
// α alone (no word) is covered in examples/acp-basic.mjs — direct calls,
// quiet mode, and streaming.
