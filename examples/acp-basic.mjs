#!/usr/bin/env pizx
// ─── acp-basic.mjs — α: any ACP-compatible coding agent ────────────────────
//
// α speaks the generic Agent Client Protocol (agentclientprotocol.com): it
// spawns the server command you name and streams that agent's session events.
// No pi involvement — π/Π use pi's SDK, α needs only the agent CLI.
//
// Because it is just a command line, α is how you run *the agent your team
// already pays for* inside a pizx script. The three calls below are the three
// shapes you will actually use: a question, a pass/fail gate, and a stream.
//
// Prerequisites: Kiro CLI (https://kiro.dev/docs/cli/acp/) installed and
// logged in. Swap SERVER for any ACP v1 server, e.g.
// ['npx', '@github/copilot', '--acp'] or ['gemini', '--experimental-acp'].
//
// level 3/5 ●●●○○ · previous: examples/epsilon-basic.mjs (run any CLI harness (ε)) · next: examples/word-fleet.mjs
//
// Run:   pizx examples/acp-basic.mjs

import { chalk } from 'zx'

// A CLI can be on PATH and still be unusable (wrong version, not logged in).
// Probing `--version` before an optional section keeps these examples honest:
// they either do the real work or say plainly why they did not.
async function usable(bin) {
  const probe = await $({ nothrow: true })`${bin} --version`
  return probe.exitCode === 0
}

const SERVER = ['kiro-cli', 'acp']
const LABEL = SERVER.join(' ')

if (!(await usable(SERVER[0]))) {
  echo(chalk.yellow(`\n  skipped — ${SERVER[0]} is missing or not runnable here.`))
  echo(chalk.dim('  Install Kiro CLI (https://kiro.dev/docs/cli/acp/) and log in, or point'))
  echo(chalk.dim("  SERVER at any ACP v1 agent, e.g. ['npx', '@github/copilot', '--acp'].\n"))
  process.exit(0)
}

// ── Real input: this repo's documented CLI contract ────────────────────────
const help = (await $`node dist/cli.js --help`).stdout
const exitCodes = (await fs.readFile('AGENTS.md', 'utf-8'))
  .split('\n')
  .filter((l) => /^\|\s*`?\d`?\s*\|/.test(l))
  .join('\n')

echo(chalk.bold(`\n α — ${LABEL}\n`))
echo(chalk.dim(`  handing the agent ${help.split('\n').length} lines of --help\n`))

// ── 1. A question the agent answers from the repo ──────────────────────────
// Streams by default: you watch the agent work in real time. A server can be
// on PATH and still fail to negotiate a session (wrong version, expired
// login), so the first call is guarded and the rest of the tour is honest
// about being skipped.
let review
try {
  review = await α({ server: SERVER })`
Here is a CLI's --help output and its documented exit codes.

Help:
${help}

Exit codes:
${exitCodes}

Cross-check them: name any exit code the help text does not explain, and any
flag mentioned only in one of the two. Be brief.
`
} catch (err) {
  echo(chalk.yellow(`\n  ${LABEL} is installed but did not complete a session.`))
  echo(chalk.dim(`  ${err.message.split('\n')[0]}`))
  echo(chalk.dim('  check that the agent is logged in and its ACP mode is supported:'))
  echo(chalk.dim(`    ${LABEL}      # should start an ACP session on stdin/stdout`))
  echo(chalk.dim("  or point SERVER at another ACP v1 agent, e.g. ['npx', '@github/copilot', '--acp'].\n"))
  process.exit(0)
}
echo(`\n  ${chalk.green(review.text.trim())}`)
echo(
  chalk.dim(
    `\n  server: ${review.modelId} · turns: ${review.turnCount} · ${review.duration}ms`
  )
)

// ── 2. Quiet mode: a verdict the script can branch on ──────────────────────
// No streaming, just the answer — this is the shape you put in CI.
const subject = (await $`git log -1 --format=%s`).stdout.trim()
const gate = await α.quiet({ server: SERVER })`
Commit subject: "${subject}"

Check it against the change it describes (\`git show --stat HEAD\`). Reply with
exactly one word — PASS if the subject accurately describes the change, FAIL
otherwise — followed by a dash and at most eight words of justification.
`
const passed = /^pass\b/i.test(gate.text.trim())
echo(`\n  commit gate: ${passed ? chalk.green('PASS') : chalk.red('FAIL')} ${chalk.dim(gate.text.trim())}`)

// ── 3. Streaming: consume the agent's output as it arrives ─────────────────
// Every letter has .stream; for α it is the natural mode, because the agent
// may run for minutes and you want progress, not a spinner.
echo(chalk.dim(`\n  streaming a second opinion from ${LABEL}:`))
process.stdout.write('    ')
for await (const chunk of α({ server: SERVER }).stream`
In one sentence: what is the single biggest risk in shipping the change
described by this commit?
${(await $`git show --stat HEAD`).stdout.trim().slice(0, 2000)}
`) {
  process.stdout.write(chunk)
}
process.stdout.write('\n\n')

// ── Notes ──────────────────────────────────────────────────────────────────
// * α ignores pi credentials entirely — the agent brings its own auth.
// * Forward `cwd`, `env`, and `timeoutMs` for agents working in a subdirectory.
// * `α({ confirm: { hitl: true } })`…`` asks before every phase.
// * α also fills word slots: see examples/acp-word-slots.mjs.
