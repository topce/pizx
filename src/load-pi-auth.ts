/**
 * Load Pi auth config and inject API keys as environment variables
 * so @earendil-works/pi-ai can discover them.
 *
 * Also re-exports Pi installation detection and settings helpers
 * from load-pi-settings.ts.
 */

import { existsSync, readFileSync } from 'node:fs'
import { homedir } from 'node:os'
import { join } from 'node:path'

export {
  getPiAgentDir,
  isPiInstalled,
  loadPiSettings,
  type PiSettings,
} from './load-pi-settings.ts'

const PI_AUTH_DIR = join(homedir(), '.pi', 'agent')

// Provider name → env var name mapping (from pi-ai internals)
const PROVIDER_ENV_MAP: Record<string, string> = {
  deepseek: 'DEEPSEEK_API_KEY',
  openai: 'OPENAI_API_KEY',
  'openai-codex': 'OPENAI_API_KEY',
  anthropic: 'ANTHROPIC_API_KEY',
  google: 'GEMINI_API_KEY',
  'google-vertex': 'GOOGLE_CLOUD_API_KEY',
  mistral: 'MISTRAL_API_KEY',
  groq: 'GROQ_API_KEY',
  cerebras: 'CEREBRAS_API_KEY',
  xai: 'XAI_API_KEY',
  nvidia: 'NVIDIA_API_KEY',
  cloudflare: 'CLOUDFLARE_API_KEY',
  'cloudflare-ai-gateway': 'CLOUDFLARE_API_KEY',
  openrouter: 'OPENROUTER_API_KEY',
}

/**
 * Reads ~/.pi/agent/auth.json (or api-keys.json) and sets
 * the corresponding environment variables if not already set.
 */
export function loadPiAuth(): void {
  // Try auth.json first (newer format), then api-keys.json (older format)
  const candidates = ['auth.json', 'api-keys.json']

  for (const file of candidates) {
    const path = join(PI_AUTH_DIR, file)
    if (!existsSync(path)) continue

    try {
      const raw = readFileSync(path, 'utf-8')
      const config = JSON.parse(raw)

      for (const [provider, cred] of Object.entries(config)) {
        const envVar = PROVIDER_ENV_MAP[provider]
        if (!envVar) continue

        // Only set if not already in environment
        if (process.env[envVar]) continue

        const credObj = cred as { type: string; key?: string }
        if (credObj.type === 'api_key' && credObj.key) {
          process.env[envVar] = credObj.key
        }
      }

      // Also try reading as { apiKeys: { ... } } (legacy format)
      if ((config as Record<string, unknown>).apiKeys) {
        for (const [provider, key] of Object.entries(
          (config as Record<string, unknown>).apiKeys as Record<string, string>
        )) {
          const envVar = PROVIDER_ENV_MAP[provider]
          if (!envVar) continue
          if (process.env[envVar]) continue
          if (typeof key === 'string') {
            process.env[envVar] = key
          }
        }
      }
    } catch (err) {
      console.warn(`pizx: failed to parse ${path}: ${err instanceof Error ? err.message : err}`)
    }
  }
}
