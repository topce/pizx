/**
 * Load Pi global settings from ~/.pi/agent/settings.json
 *
 * Reads Pi's default model, provider, and thinking level so the π tag
 * can use the same defaults the user configured via `pi settings`.
 */

import { existsSync, readFileSync } from 'node:fs'
import { homedir } from 'node:os'
import { join } from 'node:path'

/**
 * Default Pi agent directory: ~/.pi/agent
 * Override via PI_CODING_AGENT_DIR env var (same convention as pi-coding-agent SDK).
 */
export function getPiAgentDir(): string {
  const envDir = process.env.PI_CODING_AGENT_DIR
  if (envDir) return envDir
  return join(homedir(), '.pi', 'agent')
}

/**
 * Check whether Pi global configuration exists.
 * Returns true if ~/.pi/agent/auth.json exists on disk.
 */
export function isPiInstalled(): boolean {
  return existsSync(join(getPiAgentDir(), 'auth.json'))
}

/**
 * Settings that pizx reads from Pi's global settings.json.
 * These match the SettingsManager.Settings interface in pi-coding-agent.
 */
export interface PiSettings {
  /** Default model id, e.g. "claude-sonnet-4-5" */
  defaultModel?: string
  /** Default provider, e.g. "anthropic" */
  defaultProvider?: string
  /** Default thinking level */
  defaultThinkingLevel?: 'off' | 'minimal' | 'low' | 'medium' | 'high' | 'xhigh'
}

/**
 * Read Pi's global settings.json and return parsed defaults.
 *
 * Returns an empty object when:
 * - settings.json does not exist (Pi not configured)
 * - settings.json is unparseable (corrupt file)
 *
 * Never throws.
 */
export function loadPiSettings(agentDir?: string): PiSettings {
  const dir = agentDir ?? getPiAgentDir()
  const path = join(dir, 'settings.json')

  if (!existsSync(path)) return {}

  try {
    const raw = readFileSync(path, 'utf-8')
    const parsed = JSON.parse(raw) as Record<string, unknown>
    return {
      defaultModel: typeof parsed.defaultModel === 'string' ? parsed.defaultModel : undefined,
      defaultProvider:
        typeof parsed.defaultProvider === 'string' ? parsed.defaultProvider : undefined,
      defaultThinkingLevel:
        typeof parsed.defaultThinkingLevel === 'string'
          ? (parsed.defaultThinkingLevel as PiSettings['defaultThinkingLevel'])
          : undefined,
    }
  } catch {
    // Unparseable settings.json — silently ignore
    return {}
  }
}
