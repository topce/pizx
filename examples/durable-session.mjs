#!/usr/bin/env pizx
// ─── durable-session.mjs — a Π conversation that outlives the process ──────
//
// Π starts each run with a fresh conversation. Give it a `session` name and
// the conversation is written to pi's session store; a later run opens that
// name and continues where it left off — same context, same files already read.
//
// This script proves it in one run: it boots a pizx app, tells the session a
// secret, disposes the app (the conversation leaves the process), then boots a
// brand-new app and asks the session to recall the secret. Nothing is passed in
// memory — the second answer can only come from disk.
//
// level 2/5 ●●○○○ · side trip after examples/basic-capital-pi.mjs · back to examples/trace-and-cache.mjs
//
// Run:   pizx examples/durable-session.mjs

import { createPizx } from '@topce/pizx'
import { chalk } from 'zx'

const MODEL = 'deepseek/deepseek-v4-flash'
const SESSION = 'pizx-durable-demo'
const SECRET = String(1000 + Math.floor(Math.random() * 9000))

echo(chalk.bold('\n durable Π sessions\n'))
echo(chalk.dim(`  session "${SESSION}" · secret ${SECRET} (told only to run 1)\n`))

// ── Run 1: a fresh app stores the secret, then exits ───────────────────────
const first = await createPizx()
echo(chalk.dim('  run 1 · new session, store the secret'))
const told = await first.Π({ session: SESSION, model: MODEL, quiet: true })`
Remember this verification code: ${SECRET}
Reply with exactly: stored
`
echo(`    │ ${told.text.trim()}`)
await first.dispose()
echo(chalk.dim('  run 1 · app disposed — the conversation has left the process\n'))

// ── Run 2: a brand-new app resumes the same session by name ────────────────
const second = await createPizx()
echo(chalk.dim('  run 2 · brand-new app, resume by name'))
const recalled = await second.Π({ session: SESSION, model: MODEL, quiet: true })`
What verification code did I most recently ask you to remember?
Reply with just the code.
`
await second.dispose()
echo(`    │ ${recalled.text.trim()}`)

const resumed = recalled.text.includes(SECRET)
echo(
  `\n  ${resumed ? chalk.green('✓ resumed') : chalk.red('✗ not resumed')} — run 2 ${
    resumed ? 'read' : 'failed to read'
  } a secret it was never told in its own process.\n`
)

// ── Notes ──────────────────────────────────────────────────────────────────
// * `session` names a conversation. Omit it and Π uses an in-memory session:
//   pooled within the process (same model/cwd/tools reuse it), gone at exit.
// * The conversation lives in pi's standard session store, so `pi /session`
//   can open the very same one — and every run of this script appends to it.
//   Delete "pizx-durable-demo" in that picker when you are done with it.
// * The app boundary here stands in for a process boundary. Two `pizx` runs
//   with the same `session` name resume the same conversation.
// * One process holds one open handle per name, so parallel Π calls must not
//   share a `session` — run them sequentially (as this script does) or give
//   each its own name.
