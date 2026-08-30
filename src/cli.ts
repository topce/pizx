#!/usr/bin/env node

/**
 * pizx CLI — a zx-compatible script runner with π/Π/α (and every registered
 * letter) available globally.
 *
 * Usage:
 *   pizx script.mjs                Run a pizx script
 *   pizx -p "prompt"               Quick pi-ai query (print mode)
 *   pizx --acp --acp-server "kiro-cli acp" "prompt"   Quick ACP agent query
 *   pizx --trace script.mjs        Print a trace summary when done
 *   pizx --export-log script.mjs   Write the run trace as JSONL
 *   pizx --cache script.mjs        Enable the local result cache
 *   pizx --config ./cfg.mjs ...    Load plugins from a config file
 *   pizx --letters                 List registered letters
 *   pizx --version | --help
 */

import { realpathSync } from 'node:fs'
import { createRequire } from 'node:module'
import process from 'node:process'
import url, { fileURLToPath } from 'node:url'
import { chalk, VERSION as zxVersion } from 'zx'
import { createPizx, type Pizx } from './core/context.ts'
import { isPizxError } from './core/errors.ts'
import { getErrorMessage } from './core/utils.ts'

const require = createRequire(import.meta.url)
const pkg = require('../package.json') as { version: string }
const VERSION = pkg.version

// A token ending with one of these is a script to run, not a log path.
const SCRIPT_EXT_RE = /\.(m|c)?[jt]s$/

// ── Arg parsing ─────────────────────────────────────────────────────────────

interface Flags {
  version: boolean
  help: boolean
  print: boolean
  acp: boolean
  acpServer?: string
  trace: boolean
  letters: boolean
  cache: boolean
  noCache: boolean
  model?: string
  system?: string
  config?: string
  exportLog: string | undefined | null // null = flag given without path
  quiet: boolean
}

/** Parse CLI arguments (exported for tests). */
export function parseArgs(argv: string[]): { flags: Flags; positional: string[] } {
  const flags: Flags = {
    version: false,
    help: false,
    print: false,
    acp: false,
    trace: false,
    letters: false,
    cache: false,
    noCache: false,
    exportLog: undefined,
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
      case '--acp':
        flags.acp = true
        break
      case '--acp-server':
        if (argv[i + 1] && !argv[i + 1].startsWith('-')) flags.acpServer = argv[++i]
        break
      case '--trace':
        flags.trace = true
        break
      case '--letters':
        flags.letters = true
        break
      case '--cache':
        flags.cache = true
        break
      case '--no-cache':
        flags.noCache = true
        break
      case '--export-log':
        // Consume the next token as the log path only when it is not a
        // script: "pizx --export-log script.mjs" uses the default path,
        // "pizx --export-log /tmp/run.jsonl s.mjs" an explicit one.
        if (argv[i + 1] && !argv[i + 1].startsWith('-') && !SCRIPT_EXT_RE.test(argv[i + 1])) {
          flags.exportLog = argv[++i]
        } else {
          flags.exportLog = null
        }
        break
      case '-m':
      case '--model':
        if (argv[i + 1] && !argv[i + 1].startsWith('-')) flags.model = argv[++i]
        break
      case '--system':
        if (argv[i + 1] && !argv[i + 1].startsWith('-')) flags.system = argv[++i]
        break
      case '--config':
        if (argv[i + 1] && !argv[i + 1].startsWith('-')) flags.config = argv[++i]
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
   pizx --acp <prompt>          Quick query to an ACP agent
   pizx --letters               List registered letters

 ${chalk.bold('Options')}
   -p, --print <prompt>   Send to pi-ai and print response
   --acp <prompt>         Send to an ACP agent (needs --acp-server)
   --acp-server <line>    ACP server command line, e.g. "kiro-cli acp"
   -m, --model <id>       Model to use (e.g. anthropic/claude-sonnet-4-5)
   --system <text>        System context for pi-ai
   --trace                Print a token/cache/cost summary when done
   --export-log [path]    Export the run trace as JSONL (default .pizx/logs/)
   --cache / --no-cache   Enable/disable the local result cache
   --config <file>        Load letter plugins from a config file
   --letters              List registered letters and their descriptions
   -q, --quiet            Suppress status output
   -v, --version          Print version
   -h, --help             This help

 ${chalk.bold('Letters')}
   \`$\`   Shell commands (unchanged from zx)
   \`π\`   Pi AI text generation (small pi)
   \`Π\`   Pi coding agent (capital pi, tools: read/bash/edit/write)
   \`α\`   Any ACP-compatible coding agent (acp/agent, server required)

   Plugins loaded from pizx.config.mjs can define more letters — they appear
   as globals in scripts and in \`pizx --letters\`. See docs/extension.md.

 ${chalk.bold('Example Script')}
   #!/usr/bin/env pizx
   const files = (await \`$\`ls src/\`).stdout.trim()
   const review = await \`π\`review these files for bugs: \${files}\`
   if (review.includes('BUG')) {
     await \`Π\`fix the bugs found in: \${review}\`
   }

   # Any ACP agent (e.g. Kiro) — no pi involved:
   await \`α\`({ server: ['kiro-cli', 'acp'] })\`fix the TypeScript errors in src/\`

 ${chalk.dim('https://github.com/topce/pizx')}
`)
}

// ── App boot ────────────────────────────────────────────────────────────────

async function bootApp(flags: Flags, configDir?: string): Promise<Pizx> {
  return createPizx({
    model: flags.model,
    quiet: flags.quiet,
    cache: flags.cache ? true : flags.noCache ? false : undefined,
    configFile: flags.config,
    configDir,
  })
}

function injectGlobals(app: Pizx): void {
  const g = globalThis as Record<string, unknown>
  for (const entry of app.ctx.letters.entries()) {
    g[entry.name] = entry.fn
    for (const alias of entry.aliases) g[alias] = entry.fn
  }
}

/** Render an error for the CLI: pizx errors print as-is, foreign errors get the `pizx:` prefix. */
function displayMessage(err: unknown): string {
  const message = getErrorMessage(err)
  if (isPizxError(err) || message.startsWith('pizx:')) return message
  return `pizx: ${message}`
}

// ── Print mode ──────────────────────────────────────────────────────────────

async function runPrintMode(flags: Flags, args: string[]): Promise<void> {
  const prompt = args.join(' ') || ''
  if (!prompt) {
    console.error('pizx: no prompt provided. Use: pizx -p "your prompt"')
    process.exit(1)
  }

  const app = await bootApp(flags)
  try {
    const opts: Record<string, unknown> = { cache: flags.cache || undefined }
    if (flags.model) opts.model = flags.model
    if (flags.system) opts.system = flags.system
    if (flags.quiet) opts.quiet = true

    const tag = Object.keys(opts).length > 0 ? app.π(opts) : app.π
    const result = await tag`${prompt}`
    if (flags.quiet) process.stdout.write(`${result.toString()}\n`)
  } finally {
    await finishRun(app, flags)
  }
}

// ── ACP quick-ask mode ───────────────────────────────────────────────────────

async function runAcpMode(flags: Flags, args: string[]): Promise<void> {
  const prompt = args.join(' ') || ''
  if (!prompt) {
    console.error('pizx: no prompt provided. Use: pizx --acp "your prompt"')
    process.exit(1)
  }
  const server = (flags.acpServer ?? '').split(/\s+/).filter(Boolean)
  if (server.length === 0) {
    console.error(
      'pizx: --acp needs an ACP server. Use: pizx --acp --acp-server "kiro-cli acp" "your prompt"'
    )
    process.exit(1)
  }

  const app = await bootApp(flags)
  try {
    const result = await app.α({ server })`${prompt}`
    if (flags.quiet) process.stdout.write(`${result.toString()}\n`)
  } finally {
    await finishRun(app, flags)
  }
}

// ── Script mode ─────────────────────────────────────────────────────────────

async function runScriptMode(flags: Flags, scriptPath: string): Promise<void> {
  const path = await import('node:path')
  const absPath = path.resolve(process.cwd(), scriptPath)

  // Import zx globals first (sets up $, cd, chalk, etc.)
  await import('zx/globals')

  const app = await bootApp(flags, path.dirname(absPath))
  injectGlobals(app)

  // Inject __filename, __dirname, require for CommonJS compat
  const { createRequire } = await import('node:module')
  const __filename = absPath
  const __dirname = path.dirname(absPath)
  const require = createRequire(absPath)
  Object.assign(globalThis, { __filename, __dirname, require })

  try {
    await import(url.pathToFileURL(absPath).toString())
  } catch (err) {
    const message = getErrorMessage(err)
    app.ctx.trace.record({ kind: 'error', message: `script failed: ${message}` })
    console.error(displayMessage(err))
    await finishRun(app, flags)
    process.exit(1)
  }
  await finishRun(app, flags)
}

// ── Teardown: trace summary + log export + dispose ─────────────────────────

async function finishRun(app: Pizx, flags: Flags): Promise<void> {
  try {
    if (flags.trace) {
      process.stderr.write(`${app.traceSummary()}\n`)
    }
    if (flags.exportLog !== undefined) {
      const dest = await app.flushLog(flags.exportLog ?? undefined)
      if (!flags.quiet) process.stderr.write(`pizx: trace exported to ${dest}\n`)
    }
  } finally {
    await app.dispose()
  }
}

// ── Letters listing ─────────────────────────────────────────────────────────

async function runLettersMode(flags: Flags): Promise<void> {
  const app = await bootApp(flags)
  try {
    for (const entry of app.ctx.letters.entries()) {
      const aliases = entry.aliases.length > 0 ? ` (aliases: ${entry.aliases.join(', ')})` : ''
      console.log(
        `  ${chalk.bold(entry.name)}${aliases}${entry.cacheable ? '' : chalk.dim(' [no-cache]')}`
      )
      if (entry.description) console.log(`      ${entry.description}`)
    }
  } finally {
    await app.dispose()
  }
}

// ── Main ────────────────────────────────────────────────────────────────────

async function main() {
  const { flags, positional } = parseArgs(process.argv.slice(2))

  if (flags.version) {
    console.log(`pizx/${VERSION} (zx/${zxVersion}) node/${process.version}`)
    return
  }

  if (flags.help) {
    printHelp()
    return
  }

  if (flags.letters) {
    await runLettersMode(flags)
    return
  }

  if (flags.print) {
    await runPrintMode(flags, positional)
    return
  }

  if (flags.acp) {
    await runAcpMode(flags, positional)
    return
  }

  if (positional.length === 0) {
    printHelp()
    process.exit(0)
  }

  await runScriptMode(flags, positional[0])
}

// ── Entry ───────────────────────────────────────────────────────────────────

// Run only when executed directly (not when imported, e.g. by tests). Compare
// real paths so the guard also holds when cli.js is reached through a symlink
// (npm's node_modules/.bin entries and `npm link` both symlink the bin).
const invokedAsMain = (() => {
  if (!process.argv[1]) return false
  try {
    return realpathSync(process.argv[1]) === fileURLToPath(import.meta.url)
  } catch {
    return false
  }
})()

if (invokedAsMain) {
  main().catch((err) => {
    console.error(displayMessage(err))
    process.exit(1)
  })
}
