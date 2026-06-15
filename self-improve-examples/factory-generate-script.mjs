#!/usr/bin/env pizx
/**
 * ─── factory-generate-script.mjs — Improvement Script Generator ───────────
 *
 * A meta-script that generates new pizx improvement scripts on demand.
 * You describe a problem domain (e.g., "our error messages are inconsistent"),
 * and it produces a ready-to-run pizx script targeting that domain.
 *
 * How it works:
 *   1. Orchestrator plans what pattern(s) to use for the domain
 *   2. Workers research the relevant parts of the codebase
 *   3. Synthesis generates a complete, runnable pizx script
 *   4. Chi (Learn) analyzes the output to improve future generations
 *   5. Script is written to self-improve-examples/generated/
 *
 * Run:
 *   pizx self-improve-examples/factory-generate-script.mjs
 *
 * Customize: edit the PROBLEM variable below to generate different scripts.
 */

import { chalk } from 'zx'
import { writeFile, mkdir } from 'node:fs/promises'
import { join } from 'node:path'

// ════════════════════════════════════════════════════════════════════════════
// CONFIG — change PROBLEM to generate a different improvement script
// ════════════════════════════════════════════════════════════════════════════

const PROBLEM = `error handling patterns across src/patterns/ are inconsistent — some use try/catch, some use .catch(), some propagate errors, some swallow them. We need a script that analyzes all error handling and suggests a unified approach.`

const PLANNER_MODEL = 'deepseek/deepseek-v4-pro'
const WORKER_MODEL = 'deepseek/deepseek-v4-flash'
const OUTPUT_DIR = join(import.meta.dirname, 'generated')

// ════════════════════════════════════════════════════════════════════════════

console.log(chalk.bold.magenta('\n 🏭 Improvement Script Factory\n'))
console.log(chalk.dim(` Planner: ${PLANNER_MODEL}  |  Worker: ${WORKER_MODEL}\n`))
console.log(chalk.yellow(' Problem:'), chalk.white(PROBLEM.slice(0, 120) + '...\n'))

// ─── Phase 1: Orchestrate script generation ─────────────────────────────

console.log(chalk.yellow(' Phase 1: Planning and generating improvement script...\n'))

const plan = await orchestrator({
  plannerModel: PLANNER_MODEL,
  workerModel: WORKER_MODEL,
  workers: 4,
  mode: 'agent',
})`
You are a meta-programming system. Your job is to generate a COMPLETE, RUNNABLE pizx script that solves this problem:

"${PROBLEM}"

Follow this process with your 4 workers:

Worker 1 — RESEARCH THE DOMAIN:
Read relevant source files in src/patterns/ and src/ that relate to this problem. Understand the current implementation, patterns used, and conventions. Report: what files are relevant, what patterns exist, what inconsistencies you found.

Worker 2 — DESIGN THE SOLUTION:
Based on Worker 1's research, design the improvement script's architecture:
- What pizx pattern(s) should it use? (fleet, pipeline, critique, ralph, orchestrator, debate, etc.)
- Should it use agent mode (file tools) or text mode?
- What options are needed? (models, concurrency, iterations, etc.)
- What's the 3-4 step flow?

Worker 3 — IDENTIFY PATCHES:
Based on Worker 1's findings, identify specific, concrete patches the generated script should look for. List them as: file path → what's wrong → suggested fix. Be specific — reference actual code from Worker 1's findings.

Worker 4 — GENERATE THE COMPLETE SCRIPT:
Using Workers 1-3's output, generate a COMPLETE, RUNNABLE pizx script. It must:
- Start with #!/usr/bin/env pizx
- Import from '@topce/pizx' (use English aliases: pi, Pi, fleet, orchestrator, pipeline, critique, ralph, etc.)
- Import { chalk } from 'zx'
- Use appropriate pizx patterns
- Produce concrete, specific output (not vague suggestions)
- Include comments explaining each step
- Define model constants at the top
- Match the style of existing pizx examples
- Be ready to run with: pizx self-improve-examples/generated/[script-name].mjs

Output the COMPLETE script as your response. DO NOT wrap it in markdown fences — output raw JavaScript starting with the shebang.
`

console.log(chalk.green(' ✓ Orchestration complete\n'))
console.log(chalk.dim(`   Plan: ${plan.plan?.slice(0, 200) || 'N/A'}...\n`))

// ─── Phase 2: Extract the generated script from synthesis ──────────────

// The synthesis should contain the generated script.
// Parse it out — it starts with #!/usr/bin/env pizx
let generatedScript = plan.synthesis || ''

// If synthesis contains markdown fences, extract the code block
const fenceMatch = generatedScript.match(/```(?:js|javascript|mjs)?\n([\s\S]*?)```/)
if (fenceMatch) {
  generatedScript = fenceMatch[1].trim()
}

// If it doesn't start with shebang, try to find it
if (!generatedScript.startsWith('#!/usr/bin/env pizx')) {
  const shebangIdx = generatedScript.indexOf('#!/usr/bin/env pizx')
  if (shebangIdx !== -1) {
    generatedScript = generatedScript.slice(shebangIdx)
  }
}

// ─── Phase 3: Critique and refine ─────────────────────────────────────

console.log(chalk.yellow(' Phase 2: Critiquing and refining generated script...\n'))

const refined = await critique({
  plannerModel: PLANNER_MODEL,
  workerModel: WORKER_MODEL,
  rounds: 1,
})`
Review this generated pizx improvement script and improve it:

${generatedScript.slice(0, 8000)}

Focus on:
1. Is the shebang correct? (#!/usr/bin/env pizx)
2. Are all imports correct and available? (from '@topce/pizx', from 'zx')
3. Are the patterns used correctly with valid options?
4. Is the script actually runnable as-is?
5. Does it produce concrete, actionable output?
6. Are there any syntax errors or typos?

If you find issues, output the CORRECTED COMPLETE SCRIPT. DO NOT wrap it in markdown fences.
`

const finalScript = refined.finalContent || generatedScript

// Clean up any markdown fences from critique output
let cleanScript = finalScript
const fenceMatch2 = cleanScript.match(/```(?:js|javascript|mjs)?\n([\s\S]*?)```/)
if (fenceMatch2) {
  cleanScript = fenceMatch2[1].trim()
}
if (!cleanScript.startsWith('#!/usr/bin/env pizx')) {
  const idx = cleanScript.indexOf('#!/usr/bin/env pizx')
  if (idx !== -1) cleanScript = cleanScript.slice(idx)
}

// ─── Phase 4: Chi — learn from this generation ────────────────────────

console.log(chalk.yellow(' Phase 3: Learning from generation quality...\n'))

const learnings = await learn`
A pizx improvement script factory was asked to generate a script for:
"${PROBLEM}"

The generated script (after critique and refinement):
${cleanScript.slice(0, 3000)}

The generation process:
- An orchestrator with 4 workers planned and generated the script
- A critique pass reviewed and refined it
- The output was cleaned of markdown fences and validated

Extract:
1. What pattern choices worked well for this domain?
2. What would improve future script generation?
3. Any anti-patterns to avoid in generated scripts?
`

console.log(chalk.cyan(' Learnings from this generation:'))
for (const insight of learnings.insights || []) {
  console.log(chalk.dim(`   [${insight.category}] ${insight.pattern} → ${insight.recommendation}`))
}

// ─── Phase 5: Save the generated script ────────────────────────────────

await mkdir(OUTPUT_DIR, { recursive: true })

const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19)
const safeName = PROBLEM.slice(0, 50)
  .toLowerCase()
  .replace(/[^a-z0-9\s-]/g, '')
  .replace(/\s+/g, '-')
  .replace(/-+/g, '-')
  || 'improvement-script'

const scriptPath = join(OUTPUT_DIR, `improve-${safeName}.mjs`)

await writeFile(scriptPath, cleanScript, 'utf-8')
await $`chmod +x ${scriptPath}`

console.log(chalk.bold.green(`\n ✓ Generated script saved to:`))
console.log(chalk.white(`   ${scriptPath}\n`))

console.log(chalk.yellow(' Run it with:'))
console.log(chalk.white(`   pizx ${scriptPath}\n`))

console.log(chalk.dim(` Learnings saved. Edit PROBLEM variable to generate more scripts.\n`))
