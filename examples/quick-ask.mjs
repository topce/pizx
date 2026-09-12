#!/usr/bin/env pizx
/**
 * ─── quick-ask.mjs — one question about real code, in one π call ───────────
 *
 * The smallest useful pizx script is not "what is 2+2" — it is a question
 * whose answer depends on code you did not write down. This one fact-checks
 * a commit message against the diff it describes: release hygiene that is
 * tedious to do by hand and trivial to automate.
 *
 * The shell collects the evidence; π only reads it. That division is the
 * trick: models are unreliable at *finding* facts and good at *reasoning
 * about facts you hand them*.
 *
 * Run:   pizx examples/quick-ask.mjs
 *        COMMIT=HEAD~1 pizx examples/quick-ask.mjs
 */
//
// level 1/5 ●○○○○ · previous: README.md (learning path) · next: examples/release-notes.mjs

import { chalk } from 'zx'

const MODEL = 'deepseek/deepseek-v4-flash'

// ── 1. Evidence, straight from the repo ────────────────────────────────────
const ref = process.env.COMMIT ?? 'HEAD'
const subject = (await $`git log -1 --format=%s ${ref}`).stdout.trim()
const stat = (await $`git show --stat --format= ${ref}`).stdout.trim()
const files = (await $`git show --name-only --format= ${ref}`).stdout.trim().split('\n').filter(Boolean)

echo(chalk.bold(`\n quick ask — does ${ref} do what it says?\n`))
echo(`  claimed: ${chalk.cyan(subject)}`)
echo(chalk.dim(`  touched: ${files.length} files, ${stat.split('\n').length} stat lines`))

// ── 2. One π call, with the evidence interpolated ──────────────────────────
// Quiet: the answer is data for this script, not text for a terminal.
const answer = await π.quiet({ model: MODEL, maxTokens: 16384 })`
A commit claims the following. Check it against the files it touched.

Claim: ${subject}

Files changed:
${files.join('\n')}

Per-file change sizes:
${stat}

Reply in three short lines and nothing else:
  supported: yes|partly|no — one sentence of evidence
  missing:   anything the claim promises that the file list does not support (or "none")
  risk:      one sentence on what a reviewer should check first
`

// ── 3. Show the answer, keep the output script-friendly ────────────────────
echo(`\n${answer.text.trim()}`)
echo(chalk.dim(`\n  ${answer.modelId} · ${answer.duration}ms · ${answer.inputTokens} in / ${answer.outputTokens} out`))

// ── Try it from the CLI, no script at all ──────────────────────────────────
//   pizx -p "which flags in this help text are undocumented?" < help.txt
//   git diff | pizx -p -                        # prompt from stdin
//   pizx -p "explain this" --json | jq -r .text # machine-readable envelope
