#!/usr/bin/env pizx
/// <reference types="@topce/pizx/globals" />

/**
 * ε (epsilon) — run any CLI AI harness from a pizx script.
 *
 * The harness comes from the HARNESS env var so the example runs without
 * edits; default 'claude':
 *
 *   HARNESS=claude pizx examples/epsilon-basic.mjs
 *   HARNESS=kiro  pizx examples/epsilon-basic.mjs
 *
 * Options pizx does not own are forwarded to the harness CLI as flags:
 * `model` → --model, camelCase → --kebab-case, booleans bare, etc.
 */

const h = process.env.HARNESS ?? 'claude'

// Basic call: `claude -p "..."` / `kiro-cli run "..."`
const answer = await ε({ harness: h, model: process.env.MODEL ?? 'sonnet' })`
  What is the capital of France? Answer in one short line.
`
echo(`--- ${h} answered ---`)
echo(answer.text)

// Any harness option passes through — unknown keys become CLI flags.
const fileCount = await run({ harness: h, maxTurns: 2 })`
  Count the files in this directory and print just the number.
`
echo(`--- ${h} second answer (via the run alias) ---`)
echo(fileCount.text)

// Stream output lines as they arrive (ε.stream, like every letter).
echo(`--- ${h} streaming ---`)
for await (const chunk of ε({ harness: h }).stream`say hi`) process.stdout.write(chunk)

// Same thing from the CLI, no script needed:
//   pizx --run --run-harness claude "review this diff"
