#!/usr/bin/env pizx
/**
 * ─── ralph-loop.mjs — RALPH Loop: Read–Analyze–Logic–Patch–Harden ──────────
 *
 * A self-correcting feedback loop using both π (analysis) and Π (agent).
 *
 * Pattern:
 *   π  → Analyze / generate a plan
 *   Π  → Execute the plan with tools (read, bash, edit, write)
 *   π  → Review the result
 *   ↺  → Repeat until quality threshold met
 *
 * This implements the popular RALPH (Read-Analyze-Logic-Patch-Harden) loop
 * popularized in AI coding patterns.
 *
 * Run:
 *   node dist/cli.js examples/ralph-loop.mjs
 *   pizx examples/ralph-loop.mjs
 *
 * Requires Pi configured with a DeepSeek API key:
 *   pi auth login  or  DEEPSEEK_API_KEY env var
 */

import { chalk, question } from 'zx'

const MODEL = 'deepseek/deepseek-v4-flash'
const MAX_ITERATIONS = 5

console.log(chalk.bold.cyan('\n ⚡ RALPH Loop — π + Π feedback loop\n'))
console.log(chalk.dim(` Model: ${MODEL}  Max iterations: ${MAX_ITERATIONS}\n`))

// ── Step 1: π analyzes the problem ──────────────────────────────────────────
console.log(chalk.yellow(' [π] Analyzing the project structure...\n'))

const analysis = await π({ model: MODEL })`
You are a senior code reviewer. Analyze the current directory structure.

Run this command to see the structure:
ls -la

Look at the package.json, check what files are in src/ and examples/.

Then produce a brief analysis (2-3 sentences):
1. What is the project?
2. One small improvement you would make (be specific — name a file)
3. How would you implement it (one paragraph)
`

console.log(chalk.cyan(`\n Analysis:\n${analysis}`))
console.log(chalk.dim(`   model: ${analysis.modelUsed}  duration: ${analysis.duration + 'ms'}\n`))

// ── Step 2: Loop — π analyzes → Π implements → π reviews ──────────────────
async function ralphIteration(goal, iteration) {
  console.log(chalk.bold.yellow(`\n ── Iteration ${iteration} ────────────────────────────────`))

  // π: Generate an implementation plan
  console.log(chalk.yellow(` [π] Planning: ${goal.slice(0, 80)}...\n`))

  const plan = await π({ model: MODEL, maxTokens: 2048, thinkingLevel: 'high' })`
You are a precise coding assistant. The user wants to:

${goal}

Generate a minimal implementation plan. For each step, say WHICH file to change
and WHAT to change. Be specific — mention function names, line numbers if known.
Keep it under 200 words. Output only the plan.
`

  console.log(chalk.cyan(`  Plan:\n${chalk.dim(plan)}`))
  console.log(chalk.dim(`   model: ${plan.modelUsed}\n`))

  // Π: Execute the plan with the coding agent
  console.log(chalk.yellow(' [Π] Executing plan with tools...\n'))

  const result = await Π({ model: MODEL, maxTurns: 15, quiet: true })`
You are implementing this plan:

${plan}

Work through it step by step. Use read_file, edit_file, and write_file tools.
After each change, verify the file looks correct by reading it back.
When done, summarize what you changed and in which files.
`

  console.log(chalk.green(`  Done: ${result.text}\n`))
  console.log(chalk.dim(`   model: ${MODEL}  turns: ${result.turnCount}  duration: ${result.duration + 'ms'}\n`))

  // π: Review the result
  console.log(chalk.yellow(' [π] Reviewing the changes...\n'))

  const review = await π({ model: MODEL, maxTokens: 1024 })`
A coding agent just implemented this plan:

${plan}

They reported: ${result.text}

Review the result:
1. Was the plan fully implemented? Say "FULLY" or "PARTIALLY"
2. Any issues? (1 sentence max)
3. Should we iterate again to fix anything? Say "ITERATE" or "DONE"
`

  console.log(chalk.magenta(`  Review:\n${chalk.dim(review)}`))
  console.log(chalk.dim(`   model: ${review.modelUsed}\n`))

  const shouldIterate = review.includes('PARTIALLY') && review.includes('ITERATE')
  const fixGoal = review.includes('FIX') || review.includes('fix') || review.includes('improve')
    ? `Fix these issues: ${review}`
    : null

  return { shouldIterate, fixGoal }
}

// ── The loop driver ─────────────────────────────────────────────────────────

const initialGoal = `Improve the project by:
1. Reading package.json and examples/hello-pizx.mjs
2. Making sure the example script has proper pizx shebang lines
3. Adding a helpful comment to each example file if missing
4. Reporting what was changed`

let currentGoal = initialGoal
let iteration = 1

while (iteration <= MAX_ITERATIONS) {
  const { shouldIterate, fixGoal } = await ralphIteration(currentGoal, iteration)

  if (!shouldIterate || !fixGoal) {
    console.log(chalk.bold.green('\n ✓ RALPH loop complete — quality threshold reached\n'))
    break
  }

  currentGoal = fixGoal
  iteration++
}

if (iteration > MAX_ITERATIONS) {
  console.log(chalk.yellow(`\n ⚠ Max iterations (${MAX_ITERATIONS}) reached. Manual review recommended.\n`))
}

// ── Final π summary ─────────────────────────────────────────────────────────
console.log(chalk.yellow(' [π] Generating final summary...\n'))

const summary = await π({ model: MODEL, maxTokens: 1024 })`
Summarize the RALPH loop session that just completed after ${iteration} iterations.

The loop performed:
1. π: Analysis of project structure
2. π → Π → π: Implement and review cycle (${iteration - 1} iteration(s))

Write a one-paragraph summary of what the loop accomplished.
`

console.log(chalk.bold.cyan(`\n ╔══════════════════════════════════════════════════╗`))
console.log(chalk.bold.cyan(` ║          RALPH Loop Session Complete              ║`))
console.log(chalk.bold.cyan(` ╚══════════════════════════════════════════════════╝`))
console.log(`\n${chalk.white(summary)}`)
console.log(chalk.dim(`   model: ${summary.modelUsed}  duration: ${summary.duration + 'ms'}\n`))
