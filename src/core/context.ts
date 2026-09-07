/**
 * pizx application context — the cordis root that ties everything together.
 *
 * createPizx() mounts the core services (trace, cache, llm, letters) and the
 * built-in π/Π letters, mounts user plugins, waits for the app to be ready,
 * and returns a Pizx handle: dispose it to tear everything down cleanly.
 */

import { pathToFileURL } from 'node:url'
import { Context, type Plugin } from '@cordisjs/core'
import { type AlphaOpts, acpPlugin } from '../plugins/acp.ts'
import { corePlugin } from '../plugins/core.ts'
import { type EpsilonOpts, epsilonPlugin } from '../plugins/epsilon.ts'
import { claudeHarnessPlugin } from '../plugins/harness-claude.ts'
import { kiroHarnessPlugin } from '../plugins/harness-kiro.ts'
import { type PiOpts, piPlugin } from '../plugins/pi.ts'
import { type AgentOpts, piAgentPlugin } from '../plugins/pi-agent.ts'
import type { CacheConfig } from './cache.ts'
import type { LlmConfig } from './llm.ts'
import type { LetterDefinition, LetterFn } from './tags.ts'
import type { TraceConfig } from './trace.ts'
import { getErrorMessage } from './utils.ts'
import type { Words } from './words.ts'

export interface PizxConfig extends LlmConfig {
  /** Suppress status output across letters. */
  quiet?: boolean
  /** Enable the local result cache for cacheable letters. */
  cache?: boolean
  /** Cache storage tuning. */
  cacheConfig?: Omit<CacheConfig, 'enabled'>
  /** Trace storage tuning. */
  traceConfig?: TraceConfig
  /** Extra plugins to mount before ready (letter plugins, exporters, …). */
  plugins?: Plugin[]
  /** Path to a config file exporting `plugins` (default: ./pizx.config.mjs). */
  configFile?: string
  /** Extra directory searched for the default config file (e.g. the script's directory). */
  configDir?: string
}

export interface Pizx {
  /** The cordis application context. */
  ctx: Context
  /** Boot configuration. */
  config: PizxConfig
  /** The π letter (text generation) — also available as ctx.letters.get('π'). */
  π: LetterFn<PiOpts>
  /** The Π letter (coding agent) — also available as ctx.letters.get('Π'). */
  Π: LetterFn<AgentOpts>
  /** The α letter (any ACP agent) — also available as ctx.letters.get('α'). */
  α: LetterFn<AlphaOpts>
  /** The ε letter (any CLI harness) — also available as ctx.letters.get('ε'). */
  ε: LetterFn<EpsilonOpts>
  /** Look up any registered letter (user-defined ones included). */
  letter<T extends Record<string, unknown> = Record<string, unknown>>(
    name: string
  ): LetterFn<T> | undefined
  /** Imperatively register a new letter. Prefer a plugin for reusable letters. */
  define<T extends Record<string, unknown> = Record<string, unknown>>(
    name: string,
    def: LetterDefinition<T>
  ): LetterFn<T>
  /** The words service — compose letters into AI patterns (words). */
  words: Words
  /** Export the run trace as JSONL (default) or JSON. */
  exportLog(format?: 'jsonl' | 'json'): string
  /** Human-readable trace summary. */
  traceSummary(): string
  /** Write the trace log to a file (defaults to <dir>/<runId>.jsonl). */
  flushLog(path?: string, format?: 'jsonl' | 'json'): Promise<string>
  /** Tear down the app: disposes plugins, sessions, and services. */
  dispose(): Promise<void>
}

/**
 * Boot a pizx application on a fresh cordis Context.
 *
 * @example
 * ```js
 * const app = await createPizx({ cache: true })
 * const answer = await app.π`what is 7! + 5?`
 * console.log(app.traceSummary())
 * await app.dispose()
 * ```
 */
export async function createPizx(config: PizxConfig = {}): Promise<Pizx> {
  const ctx = new Context()
  const normalized: PizxConfig = { cache: false, ...config }
  ctx.config = normalized

  ctx.plugin(corePlugin, {
    trace: config.traceConfig,
    cache: { enabled: config.cache === true, ...config.cacheConfig },
    llm: config,
  })
  ctx.plugin(piPlugin)
  ctx.plugin(piAgentPlugin)
  ctx.plugin(acpPlugin)
  ctx.plugin(epsilonPlugin)
  ctx.plugin(kiroHarnessPlugin)
  ctx.plugin(claudeHarnessPlugin)

  // User plugins from the config file, then from config.plugins.
  for (const plugin of await loadConfigPlugins(ctx, config)) {
    mount(ctx, plugin)
  }

  await ctx.start()

  const π = ctx.letters.get('π')
  const Π = ctx.letters.get('Π')
  const α = ctx.letters.get('α')
  const ε = ctx.letters.get('ε')
  if (!π || !Π || !α || !ε) {
    throw new Error('pizx: built-in letters π/Π/α/ε failed to load (check plugin order)')
  }

  const app: Pizx = {
    ctx,
    config: normalized,
    π,
    Π,
    α,
    ε,
    letter: (name) => ctx.letters.get(name),
    define: (name, def) => ctx.letters.define(name, def, 'app'),
    words: ctx.words,
    exportLog: (format) => ctx.trace.exportLog(format),
    traceSummary: () => ctx.trace.summary(),
    flushLog: (path, format) => ctx.trace.flush(path, format),
    dispose: () => ctx.stop(),
  }
  return app
}

// ── Config-file plugin loading ──────────────────────────────────────────────

const CONFIG_FILE_CANDIDATES = ['pizx.config.mjs', 'pizx.config.js']

/** Mount a plugin of any supported form (narrows the cordis union). */
function mount(ctx: Context, plugin: Plugin): void {
  if (typeof plugin === 'function') {
    ctx.plugin(plugin)
    return
  }
  if (typeof plugin === 'object' && plugin !== null && 'apply' in plugin) {
    ctx.plugin(plugin)
    return
  }
  throw new Error(`pizx: invalid plugin of type ${typeof plugin}`)
}

async function loadConfigPlugins(_ctx: Context, config: PizxConfig): Promise<Plugin[]> {
  const explicit = config.configFile
  const plugins: Plugin[] = []

  if (explicit !== undefined) {
    const loaded = await readConfigFile(explicit)
    if (loaded) plugins.push(...loaded)
  } else {
    // Look for the default config next to the script first, then the cwd.
    const searchDirs = [config.configDir, process.cwd()].filter((d): d is string => !!d)
    let found = false
    for (const dir of searchDirs) {
      for (const candidate of CONFIG_FILE_CANDIDATES) {
        const path = `${dir}/${candidate}`
        try {
          const loaded = await readConfigFile(path)
          if (loaded) {
            plugins.push(...loaded)
            found = true
            break
          }
        } catch (err) {
          // A candidate that exists but fails to parse is a hard error.
          if (isEnoent(err)) continue
          throw new Error(`pizx: failed to load config file ${path}: ${getErrorMessage(err)}`, {
            cause: err,
          })
        }
      }
      if (found) break
    }
  }

  plugins.push(...(config.plugins ?? []))
  return plugins
}

async function readConfigFile(path: string): Promise<Plugin[] | undefined> {
  const { existsSync } = await import('node:fs')
  if (!existsSync(path)) {
    const err = new Error(`ENOENT: ${path}`) as NodeJS.ErrnoException
    err.code = 'ENOENT'
    throw err
  }
  const url = pathToFileURL(path.includes('/') ? path : `${process.cwd()}/${path}`)
  const mod = (await import(url.href)) as { plugins?: Plugin[]; default?: Plugin | Plugin[] }
  if (Array.isArray(mod.plugins)) return mod.plugins
  if (Array.isArray(mod.default)) return mod.default
  if (mod.default) return [mod.default]
  throw new Error(`config file ${path} must export a \`plugins\` array (or a default plugin)`)
}

function isEnoent(err: unknown): boolean {
  return (
    (err as NodeJS.ErrnoException)?.code === 'ENOENT' ||
    getErrorMessage(err).includes('ERR_MODULE_NOT_FOUND')
  )
}
