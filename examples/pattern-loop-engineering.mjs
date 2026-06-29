#!/usr/bin/env pizx
/**
 * ─── pattern-loop-engineering.mjs — Loop Engineering (Addy Osmani, June 2026)
 *
 * "Loop engineering is replacing yourself as the person who prompts the agent.
 *  You design the system that does it instead." — Addy Osmani
 *
 * This implements the full loop shape from the article:
 *
 *   SCHEDULE ─→ Triage ─→ State File ─→ Find + Isolate + Fix + Verify ─→ Report
 *       ↑                                                                      │
 *       └──────────────────── (cron runs it again) ─────────────────────────────┘
 *
 * THE FIVE PIECES (mapped to pizx):
 *
 *   1. AUTOMATIONS (the heartbeat)
 *      This script IS the automation. Schedule it with cron, systemd timer,
 *      or `pizx -p "..."` in CI. It writes a state file so each run picks
 *      up where the last one stopped.
 *
 *   2. WORKTREES (isolation)
 *      Each fix runs in `git worktree add --detach` so parallel agents
 *      never collide on the same files.
 *
 *   3. SKILLS (stop re-explaining)
 *      Skills like `code-simplification` and `test-driven-development` are
 *      loaded once and injected into every sub-agent. Same as the article's
 *      SKILL.md pattern.
 *
 *   4. SUB-AGENTS (maker ≠ checker)
 *      γ Goal tag: writes a contract → worker executes → DIFFERENT model
 *      family verifies. Both must agree before work passes.
 *
 *   5. STATE FILE (the spine)
 *      A markdown file at `.loop-state.md` remembers what was tried, what
 *      passed, what's still open. Tomorrow's run starts from here.
 *
 *   6. CONNECTORS (touch real tools)
 *      Uses $`gh` (GitHub CLI) to open PRs, comment on issues, check CI.
 *      Replace with `glab` for GitLab or `linear` CLI for Linear tickets.
 *
 * ─── THE LOOP ─────────────────────────────────────────────────────────────
 *
 *   08:00 cron fires this script
 *         │
 *         ├─ 1. Read .loop-state.md (or create fresh)
 *         ├─ 2. Triage: git log --since="yesterday" → classify commits
 *         ├─ 3. For each open/actionable finding:
 *         │     ├─ git worktree add /tmp/pizx-loop-$ID
 *         │     ├─ γ Goal: contract → fix → verify (separate model)
 *         │     └─ git worktree remove /tmp/pizx-loop-$ID
 *         ├─ 4. Update .loop-state.md with results
 *         ├─ 5. Open PRs for successfully verified fixes
 *         └─ 6. Report findings that need human attention
 *
 *   08:05 cron fires it again tomorrow — picks up from .loop-state.md
 *
 * Run (manual):
 *   pizx examples/pattern-loop-engineering.mjs
 *
 * Run (scheduled — add to crontab):
 *   # Every morning at 8 AM
 *   0 8 * * * cd /path/to/project && pizx examples/pattern-loop-engineering.mjs
 *
 * Run (CI — add to GitHub Actions):
 *   on: schedule: [{ cron: '0 8 * * *' }]
 *   steps: [{ run: 'npx pizx examples/pattern-loop-engineering.mjs' }]
 *
 * Real-world use: daily codebase triage, automated PR review, CI failure
 * investigation, technical debt sweeps.
 */

import { chalk } from 'zx'
import { loadSkillContent } from '@topce/pizx'

const PLANNER_MODEL = 'deepseek/deepseek-v4-pro'
const WORKER_MODEL = 'deepseek/deepseek-v4-flash'
const VERIFIER_MODEL = 'anthropic/claude-sonnet-4-5' // different family!

// ══════════════════════════════════════════════════════════════════════════
// CONFIGURATION — tune these for your project
// ══════════════════════════════════════════════════════════════════════════
const STATE_FILE = '.loop-state.md'
const WORKTREE_PREFIX = '/tmp/pizx-loop'
const MAX_FINDINGS_PER_RUN = 3 // safety: don't go wild
const GH_REPO = 'topce/pizx' // for PR creation
const SKILLS_TO_LOAD = ['code-simplification', 'test-driven-development']

console.log(chalk.bold.cyan('\n 🔄 Loop Engineering — pizx\n'))
console.log(chalk.dim(" \"Loop engineering is replacing yourself as the person who prompts"))
console.log(chalk.dim("  the agent. You design the system that does it instead.\" — Addy Osmani\n"))

// ══════════════════════════════════════════════════════════════════════════
// STEP 0: Load skills once (stop re-explaining every session)
// ══════════════════════════════════════════════════════════════════════════
console.log(chalk.yellow('📚 Loading skills...'))

const skills = []
for (const name of SKILLS_TO_LOAD) {
  try {
    const content = await loadSkillContent(name)
    if (content) {
      skills.push(`# Skill: ${name}\n${content}`)
      console.log(chalk.dim(`   ✓ ${name}`))
    }
  } catch {
    console.log(chalk.dim(`   ✗ ${name} (not found, skipping)`))
  }
}

const skillsContext = skills.join('\n\n---\n\n')
console.log()

// ══════════════════════════════════════════════════════════════════════════
// STEP 1: Read (or create) the state file — the spine of the loop
// ══════════════════════════════════════════════════════════════════════════
console.log(chalk.yellow('📋 Reading state file...'))

let stateContent = ''
try {
  stateContent = (await $`cat ${STATE_FILE}`.quiet()).stdout
  console.log(chalk.dim(`   Found ${STATE_FILE} (${stateContent.split('\n').length} lines)`))
} catch {
  stateContent = `# Loop State — ${new Date().toISOString().slice(0, 10)}

## Status: Active

## Open Findings
_None yet — first run_

## Completed Fixes
_None yet_

## Needs Human Attention
_None yet_

## Run History
`
  await $`echo ${stateContent} > ${STATE_FILE}`.quiet()
  console.log(chalk.dim(`   Created fresh ${STATE_FILE}`))
}
console.log()

// ══════════════════════════════════════════════════════════════════════════
// STEP 2: TRIAGE — find the work (the "automation heartbeat")
// ══════════════════════════════════════════════════════════════════════════
console.log(chalk.yellow('🔍 TRIAGE: Finding work...\n'))

// 2a. Get recent changes
const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000)
  .toISOString()
  .slice(0, 10)

let gitLog = ''
let hasGit = false
try {
  gitLog = (await $`git log --since="${yesterday}" --oneline --no-merges -- .`.quiet()).stdout
  hasGit = gitLog.trim().length > 0
} catch {
  console.log(chalk.dim('   (No git history available — using demo mode)\n'))
}

// 2b. Get current repo status
let gitStatus = ''
try {
  gitStatus = (await $`git status --short -- .`.quiet()).stdout
} catch { /* not a git repo */ }

// 2c. AI triage: what's worth acting on?
const triagePrompt = hasGit
  ? `
You are a TRIAGE AGENT for the ${GH_REPO} project. Analyze recent activity
and current state to identify actionable findings.

RECENT COMMITS (since ${yesterday}):
${gitLog || '(none)'}

CURRENT UNCOMMITTED CHANGES:
${gitStatus || '(none)'}

LOOP STATE (what we already know):
${stateContent}

Your job:
1. Classify each finding as ACTIONABLE (worth fixing autonomously),
   NEEDS_HUMAN (complex, risky, or ambiguous), or IGNORE (trivial/noise)
2. For ACTIONABLE findings: describe the specific fix in ONE sentence
3. For NEEDS_HUMAN findings: explain why a human should handle it
4. Only classify up to ${MAX_FINDINGS_PER_RUN} findings — don't overwhelm

Format:
### Findings
- [ACTIONABLE] path/to/file.ts — one-sentence description of the fix
- [NEEDS_HUMAN] path/to/other.ts — why this needs a human
- [IGNORE] path/to/third.ts — why it's noise
`
  : `
You are a TRIAGE AGENT for the ${GH_REPO} project. This is a demo/dry run
(no git history available).

Analyze the LOOP STATE and suggest 1-2 small, safe improvements that could
be made to the pizx project itself. Focus on:
- Missing JSDoc comments on exported functions in src/patterns/
- Minor README clarity improvements
- Example file improvements

Classify findings as ACTIONABLE or NEEDS_HUMAN.

LOOP STATE:
${stateContent}
`

const triage = await π({
  model: PLANNER_MODEL,
  quiet: true,
})`${triagePrompt}`

console.log(chalk.green('✓ Triage complete\n'))
console.log(chalk.dim(triage.text.trim()))
console.log()

// ══════════════════════════════════════════════════════════════════════════
// STEP 3: Parse findings and act on ACTIONABLE ones
// ══════════════════════════════════════════════════════════════════════════
const findings = triage.text
  .split('\n')
  .filter((line) => line.trim().startsWith('- [ACTIONABLE]'))
  .slice(0, MAX_FINDINGS_PER_RUN)

const needsHuman = triage.text
  .split('\n')
  .filter((line) => line.trim().startsWith('- [NEEDS_HUMAN]'))

if (findings.length === 0) {
  console.log(chalk.green('✨ No actionable findings — everything is clean!\n'))

  // Update state file
  const runEntry = `\n### Run ${new Date().toISOString()} — No findings`
  await $`echo ${runEntry} >> ${STATE_FILE}`.quiet()
} else {
  console.log(chalk.bold.yellow(`🎯 ${findings.length} actionable finding(s) to process\n`))

  for (let i = 0; i < findings.length; i++) {
    const finding = findings[i].trim()
    const id = `${Date.now()}-${i}`
    const worktreePath = `${WORKTREE_PREFIX}-${id}`

    console.log(chalk.bold.cyan(`\n─── Finding ${i + 1}/${findings.length} ───`))
    console.log(chalk.white(`  ${finding}\n`))

    // ══════════════════════════════════════════════════════════════════════
    // STEP 3a: Open isolated WORKTREE (piece #2 from the article)
    // ══════════════════════════════════════════════════════════════════════
    console.log(chalk.yellow(`  📁 Creating isolated worktree at ${worktreePath}...`))

    let worktreeReady = false
    try {
      await $`git worktree add --detach ${worktreePath} HEAD`.quiet()
      worktreeReady = true
      console.log(chalk.dim('     ✓ Worktree created'))
    } catch (e) {
      console.log(chalk.red(`     ✗ Worktree failed: ${e.stderr?.slice(0, 100)}`))
    }

    if (!worktreeReady) {
      console.log(chalk.yellow('     → Skipping (no git worktree support)\n'))
      continue
    }
    console.log()

    // ══════════════════════════════════════════════════════════════════════
    // STEP 3b: γ GOAL — contract → fix → verify (pieces #3 + #4 + #5)
    //
    // This is the core of the loop: maker ≠ checker, different model families,
    // contract-first execution. The entire point of the article.
    // ══════════════════════════════════════════════════════════════════════
    console.log(chalk.yellow('  🎯 γ Goal: contract → fix → verify...'))
    console.log(chalk.dim(`     Worker: ${WORKER_MODEL}`))
    console.log(chalk.dim(`     Verifier: ${VERIFIER_MODEL} (different family!)\n`))

    let fixResult
    try {
      fixResult = await γ({
        verifierModel: VERIFIER_MODEL,
        workerModel: WORKER_MODEL,
        maxIterations: 3,
        antiSpin: true,
        streakMode: 1,
        budgetCapUsd: 2.00,
        cwd: worktreePath,
        skills: SKILLS_TO_LOAD,
        quiet: false,
      })`
You are fixing ONE specific issue in the ${GH_REPO} project.

${skillsContext}

THE FINDING:
${finding}

PROJECT CONTEXT:
- This is a zx fork with 16+ multi-agent orchestration patterns
- Source code is in src/patterns/ (one file per pattern)
- Docs are in docs/ (one .md per pattern)
- Examples are in examples/ (one .mjs per pattern)
- Core utilities are in src/ (pi.ts, pi-agent.ts, utils.ts)

YOUR JOB:
1. Analyze the finding and understand what needs to change
2. Make the minimal fix — ONE file, ONE change
3. Do NOT propose new features, refactor, or change architecture
4. Keep changes small and verifiable

If creating a new file is needed, create it in the worktree directory.
`
    } catch (e) {
      console.log(chalk.red(`     ✗ Goal execution failed: ${e.message?.slice(0, 100)}`))
      fixResult = { passed: false, text: e.message }
    }
    console.log()

    // ══════════════════════════════════════════════════════════════════════
    // STEP 3c: Report result
    // ══════════════════════════════════════════════════════════════════════
    if (fixResult?.passed) {
      console.log(chalk.green(`  ✅ FIX VERIFIED — both model families agree\n`))
      console.log(chalk.dim(`     ${fixResult.text.slice(0, 200)}...`))
    } else {
      console.log(chalk.yellow(`  ⚠️  Could not verify fix — needs human attention\n`))
      const reason = fixResult?.terminationReason || 'verification failed'
      console.log(chalk.dim(`     Reason: ${reason}`))
    }

    // Cost tracking
    if (fixResult?.totalCost) {
      console.log(chalk.dim(`     Cost: $${fixResult.totalCost.toFixed(4)} (${fixResult.callCount} calls)`))
    }

    // ══════════════════════════════════════════════════════════════════════
    // STEP 3d: Clean up worktree
    // ══════════════════════════════════════════════════════════════════════
    console.log(chalk.yellow(`\n  🧹 Cleaning up worktree...`))
    try {
      await $`git worktree remove --force ${worktreePath}`.quiet()
      console.log(chalk.dim('     ✓ Worktree removed'))
    } catch {
      console.log(chalk.dim(`     (manual cleanup: rm -rf ${worktreePath})`))
    }

    // ══════════════════════════════════════════════════════════════════════
    // STEP 3e: Update state file (the spine — piece #6)
    // ══════════════════════════════════════════════════════════════════════
    const timestamp = new Date().toISOString()
    const status = fixResult?.passed ? '✅ FIXED & VERIFIED' : '⚠️ NEEDS HUMAN'
    const costInfo = fixResult?.totalCost
      ? ` ($${fixResult.totalCost.toFixed(4)})`
      : ''

    const stateEntry = `
### ${timestamp}
- ${status}: ${finding}${costInfo}
${fixResult?.terminationReason ? `- Stopped: ${fixResult.terminationReason}` : ''}
`

    await $`echo ${stateEntry} >> ${STATE_FILE}`.quiet()
    console.log(chalk.dim(`  📝 State file updated\n`))
  }
}

// ══════════════════════════════════════════════════════════════════════════
// STEP 4: Report — what needs human attention?
// ══════════════════════════════════════════════════════════════════════════
console.log(chalk.bold.magenta('\n══════════════════════════════════════════════'))
console.log(chalk.bold.magenta('═══ Loop Run Complete ═══'))
console.log(chalk.bold.magenta('══════════════════════════════════════════════\n'))

// Re-read state to show final picture
try {
  stateContent = (await $`cat ${STATE_FILE}`.quiet()).stdout
} catch { /* ignore */ }

const humanItems = needsHuman.filter((l) => l.trim())
if (humanItems.length > 0) {
  console.log(chalk.yellow('⚠️  Needs human attention:'))
  for (const item of humanItems) {
    console.log(chalk.white(`  ${item.trim()}`))
  }
  console.log()
} else {
  console.log(chalk.green('✅ No items need human attention\n'))
}

console.log(chalk.cyan('📋 State file:'))
console.log(chalk.dim(`  ${STATE_FILE} — ${stateContent.split('\n').length} lines`))
console.log()

// ══════════════════════════════════════════════════════════════════════════
// STEP 5: Connector — open PR for successfully verified fixes (if any)
// ══════════════════════════════════════════════════════════════════════════
const hasGh = await (async () => {
  try {
    await $`which gh`.quiet()
    return true
  } catch {
    return false
  }
})()

if (hasGh) {
  console.log(chalk.yellow('🔗 Connector: GitHub CLI available'))
  console.log(chalk.dim('   To auto-open PRs, uncomment the gh commands in the script.'))
  console.log(chalk.dim('   Example:'))
  console.log(chalk.dim('     await $`gh pr create --title "auto: fix XYZ" --body "..."``'))
  console.log(chalk.dim('     await $`gh issue comment 42 --body "Auto-fix opened in PR #43"``'))
} else {
  console.log(chalk.dim('🔗 Connector: gh CLI not found (install for auto-PR creation)'))
  console.log(chalk.dim('   brew install gh && gh auth login'))
}
console.log()

// ══════════════════════════════════════════════════════════════════════════
// LOOP ENGINEERING PRINCIPLES — what this example demonstrates
// ══════════════════════════════════════════════════════════════════════════
console.log(chalk.bold.cyan('─── Loop Engineering Principles ───\n'))
console.log(chalk.white(`
  1. 🔄 AUTOMATION (the heartbeat)
     This script IS the automation. Schedule it with cron, systemd timer,
     or CI. Each run picks up from .loop-state.md.

  2. 📁 WORKTREES (isolation)
     Each fix runs in git worktree add --detach. Parallel agents never
     collide on the same files. Two agents writing the same file is the
     exact same headache as two engineers committing to the same lines.

  3. 📚 SKILLS (stop re-explaining)
     Skills like code-simplification and test-driven-development are
     loaded once and injected into every sub-agent. Same as the article's
     SKILL.md pattern. The loop remembers your project context.

  4. 🤖 SUB-AGENTS (maker ≠ checker)
     γ Goal tag writes a contract → worker executes → DIFFERENT model
     family verifies. Both must agree before work passes. The model that
     wrote the code is way too nice grading its own homework.

  5. 🧠 STATE FILE (the spine)
     .loop-state.md remembers what was tried, what passed, what's still
     open. Tomorrow's run picks up where today left off. Without this,
     every run starts from zero.

  6. 🔌 CONNECTORS (touch real tools)
     Uses gh CLI to interact with GitHub. Swap for glab (GitLab),
     linear CLI, or Slack webhooks. The loop acts inside your actual
     environment instead of just telling you what it would do.
`))

console.log(chalk.bold.cyan('─── What the loop still does NOT do for you ───\n'))
console.log(chalk.white(`
  🧐 Verification is still on you.
     A loop running unattended is also a loop making mistakes unattended.
     The γ Goal verifier helps but "done" is a claim, not a proof.

  📖 Your understanding still rots if you allow it.
     The faster the loop ships code you didn't write, the bigger the gap
     between what exists and what you actually get.

  😴 Cognitive surrender is the real risk.
     When the loop runs itself it's tempting to stop having an opinion
     and just take whatever it gives back.

  Build the loop. Stay the engineer.
`))

console.log(chalk.green('\n✓ Loop Engineering — example complete'))
console.log(chalk.dim('  Schedule me: 0 8 * * * cd /path/to/project && pizx examples/pattern-loop-engineering.mjs\n'))
