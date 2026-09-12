#!/usr/bin/env pizx
// ─── trace-and-cache.mjs — the same review twice, paid for once ────────────
//
// Two things make an AI script affordable to run repeatedly:
//
//   1. the local result cache (`.cache`), keyed by prompt + options, so an
//      unchanged input never costs a second call;
//   2. the trace (--trace, --export-log), so you can see what each call
//      actually cost.
//
// The job below is the kind you would wire into CI: compare the documented
// CLI contract against the code. On a clean branch the prompt is identical
// run to run — so the second call is free, and the log proves it.
//
// level 2/5 ●●○○○ · previous: examples/basic-capital-pi.mjs (Π runs and triages the test suite) · next: examples/custom-letter.mjs
//
// Run:   pizx --cache --trace --export-log examples/trace-and-cache.mjs
//
// Log lands in .pizx/logs/<runId>.jsonl — one JSON event per line:
// run-start, letter-start, cache-miss, llm-call, cache-hit, letter-end, run-end.

import { chalk } from 'zx'

const MODEL = 'deepseek/deepseek-v4-flash'

// ── Real, deterministic input: the CLI's own contract ──────────────────────
const help = (await $`node dist/cli.js --help`).stdout
const exitCodes = (await fs.readFile('AGENTS.md', 'utf-8'))
  .split('\n')
  .filter((l) => /^\|\s*`?\d`?\s*\|/.test(l))
  .join('\n')

echo(chalk.bold(`\n trace + cache (${MODEL})\n`))
echo(chalk.dim(`  input: ${help.split('\n').length} lines of --help + ${exitCodes.split('\n').length} exit codes`))

// ── First call: a cache miss, so the model runs ────────────────────────────
// `.cache` enables the result cache for this one letter, regardless of how
// the CLI was invoked (`--cache` would enable it app-wide).
const prompt = `
Below are a CLI's --help output and its documented exit codes.

Help:
${help}

Exit codes:
${exitCodes}

List every exit code that the help text does not explain, and every flag that
appears in the help but not in the exit-code table. Reply with one line per
finding, or "consistent" if there are none.
`

const first = await π.cache({ model: MODEL, maxTokens: 16384 })`${prompt}`
echo(`\n  first call  ${first.isFromCache ? chalk.yellow('(cache)') : chalk.green('(model)')}  ${chalk.cyan(first.text.trim().split('\n')[0])}`)

// ── Second call: identical prompt, served from .pizx/cache ────────────────
// No model call, no tokens, no cost — isFromCache is true and duration drops
// to a disk read.
const second = await π.cache({ model: MODEL, maxTokens: 16384 })`${prompt}`
echo(`  second call ${second.isFromCache ? chalk.green('(cache hit)') : chalk.red('(model)')}  ${chalk.cyan(second.text.trim().split('\n')[0])}`)

// ── What the cache saved, measured rather than claimed ────────────────────
const saved = first.totalTokens + first.totalCost
echo(
  `\n  first:  ${first.duration}ms · ${first.totalTokens} tokens · $${first.totalCost.toFixed(6)}` +
    `\n  second: ${second.duration}ms · ${second.totalTokens} tokens · $${second.totalCost.toFixed(6)}`
)
echo(chalk.dim(`  identical text: ${first.text.trim() === second.text.trim()}`))
if (saved > 0) echo(chalk.dim(`  avoided on the second run: ${first.totalTokens} tokens, $${first.totalCost.toFixed(6)}`))

echo(chalk.dim('\n  with --trace:      stderr shows the token/cache/cost summary'))
echo(chalk.dim('  with --export-log: .pizx/logs/<runId>.jsonl records cache-miss → llm-call → cache-hit'))
echo(chalk.dim('  invalidation:      change the prompt or any option and the key changes — a fresh call\n'))
