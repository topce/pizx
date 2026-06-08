#!/usr/bin/env node

/**
 * pizx CLI — a zx-compatible script runner with π (pi-ai) and Π (pi-coding-agent)
 * template tags available globally.
 *
 * Usage:
 *   pizx script.mjs       # Run a pizx script
 *   pizx -p "prompt"      # Quick pi-ai query (print mode)
 *   pizx --version        # Print version
 */

import { createRequire } from 'node:module'
import process from 'node:process'
import url from 'node:url'
import { chalk, VERSION as zxVersion } from 'zx'

// Load Pi auth config (reads ~/.pi/agent/auth.json, injects env vars)
// Must run before any pi-ai/pi-coding-agent code touches getModels()
import { loadPiAuth } from './load-pi-auth.ts'

loadPiAuth()

// Agent patterns — loaded so they can be injected as globals
import {
  Α as _Α,
  Β as _Β,
  Γ as _Γ,
  Δ as _Δ,
  Θ as _Θ,
  Λ as _Λ,
  Μ as _Μ,
  Ρ as _Ρ,
  Σ as _Σ,
  Φ as _Φ,
  Ψ as _Ψ,
  Ω as _Ω,
} from './patterns/index.ts'
// Static imports — these get bundled by esbuild
import { π as _pi } from './pi.ts'
import { Π as _pi_agent } from './pi-agent.ts'

const require = createRequire(import.meta.url)
const pkg = require('../package.json') as { version: string }

const VERSION = pkg.version

// ── Arg parsing ─────────────────────────────────────────────────────────────

function parseArgs(argv: string[]) {
  const flags = {
    version: false,
    help: false,
    print: false,
    model: undefined as string | undefined,
    system: undefined as string | undefined,
    quiet: false,
  }
  const positional: string[] = []
  let i = 0

  while (i < argv.length) {
    const a = argv[i]
    switch (a) {
      case '-v':
      case '--version':
        flags.version = true
        break
      case '-h':
      case '--help':
        flags.help = true
        break
      case '-p':
      case '--print':
        flags.print = true
        break
      case '-m':
      case '--model':
        if (argv[i + 1] && !argv[i + 1].startsWith('-')) flags.model = argv[++i]
        break
      case '--system':
        if (argv[i + 1]) flags.system = argv[++i]
        break
      case '-q':
      case '--quiet':
        flags.quiet = true
        break
      default:
        positional.push(a)
    }
    i++
  }

  return { flags, positional }
}

// ── Help ────────────────────────────────────────────────────────────────────

function printHelp() {
  // language=txt
  console.log(`
 ${chalk.bold(`pizx ${VERSION}`)}   zx/${zxVersion}
   zx-compatible script runner with Pi AI built-in

 ${chalk.bold('Usage')}
   pizx [options] <script>      Run a pizx script
   pizx -p <prompt>             Quick pi-ai query

 ${chalk.bold('Options')}
   -p, --print <prompt>   Send to pi-ai and print response
   -m, --model <id>       Model to use (e.g. anthropic/claude-sonnet-4-5)
   --system <text>        System context for pi-ai
   -q, --quiet            Suppress status output
   -v, --version          Print version
   -h, --help             This help

 ${chalk.bold('Script Tag Reference')}
   \`$\`   Shell commands (unchanged from zx)
   \`π\`   Pi AI text generation (small pi, pi-ai)
   \`Π\`   Pi coding agent (capital pi, tools: read/bash/edit/write)
   \`Ρ\`   Ralph Loop — iterative self-correcting loop
   \`Φ\`   Fleet — parallel agent execution
   \`Σ\`   Subagents — hierarchical task delegation
   \`Δ\`   Debate — multi-perspective convergence
   \`Λ\`   Pipeline — sequential agent chain
   \`Ψ\`   Critique — generate, critique, improve
   \`Ω\`   Orchestrator — plan, dispatch, synthesize

 ${chalk.bold('Communication Patterns')}
   \`Θ\`   Thread — multi-agent conversation
   \`Μ\`   Memory — shared blackboard
   \`Β\`   Broadcast — one-to-many messaging

 ${chalk.bold('Orchestration Topologies')}
   \`Α\`   Adaptive — self-adjusting orchestration
   \`Γ\`   Graph — DAG-based task execution

 ${chalk.bold('Example Script')}
   #!/usr/bin/env pizx
   const files = (await \`$\`ls src/\`).stdout.trim()
   const review = await \`π\`review these files for bugs: \${files}\`
   if (review.includes('BUG')) {
     await \`Π\`fix the bugs found in: \${review}\`
   }

 ${chalk.dim('https://github.com/topce/pizx')}
`)
}

// ── Print mode: quick pi-ai query ──────────────────────────────────────────

async function runPrintMode(flags: ReturnType<typeof parseArgs>['flags'], args: string[]) {
  const prompt = args.join(' ') || ''
  if (!prompt) {
    console.error('pizx: no prompt provided. Use: pizx -p "your prompt"')
    process.exit(1)
  }

  const opts: Record<string, unknown> = {}
  if (flags.model) opts.model = flags.model
  if (flags.system) opts.system = flags.system
  if (flags.quiet) opts.quiet = true

  const tag = Object.keys(opts).length > 0 ? _pi(opts) : _pi

  try {
    const result = await tag`${prompt}`
    if (flags.quiet) {
      process.stdout.write(`${result.toString()}\n`)
    }
  } catch (err) {
    console.error('pizx: pi-ai error:', err instanceof Error ? err.message : err)
    process.exit(1)
  }
}

// ── Script mode: run a user script with π/Π available ──────────────────────

async function runScriptMode(scriptPath: string) {
  // Resolve script path to absolute
  const path = await import('node:path')
  const absPath = path.resolve(process.cwd(), scriptPath)

  // Import zx globals first (sets up $, cd, chalk, etc.)
  await import('zx/globals')

  // Import pizx globals (sets up π, Π, configurePi, configureAgent, patterns)
  const g = globalThis as Record<string, unknown>
  g.π = _pi
  g.Π = _pi_agent
  g.Ρ = _Ρ
  g.Φ = _Φ
  g.Σ = _Σ
  g.Δ = _Δ
  g.Λ = _Λ
  g.Ψ = _Ψ
  g.Ω = _Ω
  g.Θ = _Θ
  g.Μ = _Μ
  g.Β = _Β
  g.Α = _Α
  g.Γ = _Γ

  // Inject __filename, __dirname, require for CommonJS compat
  const { createRequire } = await import('node:module')
  const __filename = absPath
  const __dirname = path.dirname(absPath)
  const require = createRequire(absPath)
  Object.assign(globalThis, { __filename, __dirname, require })

  // Run the script
  try {
    await import(url.pathToFileURL(absPath).toString())
  } catch (err) {
    if (err instanceof Error) {
      console.error('pizx:', err.message)
    } else {
      console.error('pizx:', err)
    }
    process.exit(1)
  }
}

// ── Main ────────────────────────────────────────────────────────────────────

async function main() {
  const argv = process.argv.slice(2)
  const { flags, positional } = parseArgs(argv)

  if (flags.version) {
    console.log(`pizx/${VERSION} (zx/${zxVersion}) node/${process.version}`)
    return
  }

  if (flags.help) {
    printHelp()
    return
  }

  if (flags.print) {
    await runPrintMode(flags, positional)
    return
  }

  // Script mode
  if (positional.length === 0) {
    printHelp()
    process.exit(0)
  }

  const script = positional[0]
  await runScriptMode(script)
}

main().catch((err) => {
  console.error('pizx:', err instanceof Error ? err.message : err)
  process.exit(1)
})
