/**
 * ACP client tests — run against the offline mock ACP server fixture, so no
 * network and no real agent CLI is required.
 */

import { mkdtemp, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import type { AcpToolEvent, AcpUsage } from './acp-client.ts'
import { runAcpPrompt, streamAcpPrompt } from './acp-client.ts'

const MOCK = fileURLToPath(new URL('../testing/acp-mock-server.mjs', import.meta.url))

function mockServer(): string[] {
  return [process.execPath, MOCK]
}

function mockEnv(mode?: string): Record<string, string> | undefined {
  return mode ? { MOCK_ACP_MODE: mode } : undefined
}

describe('runAcpPrompt', () => {
  it('runs a full turn against the mock agent and aggregates text', async () => {
    const toolEvents: AcpToolEvent[] = []
    const usages: AcpUsage[] = []

    const result = await runAcpPrompt({
      server: mockServer(),
      prompt: 'hello',
      env: mockEnv(),
      onToolCall: (ev) => toolEvents.push(ev),
      onUsage: (u) => usages.push(u),
    })

    expect(result.text).toBe('Hello from the mock agent')
    expect(result.stopReason).toBe('end_turn')
    expect(result.toolCallCount).toBe(1) // call-1 reported twice, counted once
    expect(result.serverLabel).toBe(mockServer().join(' '))
    expect(toolEvents).toEqual([
      { toolCallId: 'call-1', title: 'Reading a file', status: 'pending' },
      { toolCallId: 'call-1', title: 'call-1', status: 'completed' },
    ])
    expect(usages).toEqual([
      {
        inputTokens: 20,
        outputTokens: 22,
        cacheReadTokens: 0,
        cacheWriteTokens: 0,
        totalTokens: 42,
      },
    ])
  })

  it('rejects with a friendly error when no server is given', async () => {
    await expect(runAcpPrompt({ server: [], prompt: 'hello' })).rejects.toThrow(
      'no ACP server specified'
    )
  })

  it('rejects with a friendly error when the server command does not exist', async () => {
    await expect(
      runAcpPrompt({ server: ['pizx-command-that-does-not-exist'], prompt: 'hello' })
    ).rejects.toThrow('cannot start ACP server')
  })

  it('wraps non-zero exits with the stderr tail', async () => {
    await expect(
      runAcpPrompt({ server: mockServer(), prompt: 'hello', env: mockEnv('bad-exit') })
    ).rejects.toThrow(/exited with code 3[\s\S]*mock agent exploded/)
  })

  it('kills the server and reports a timeout', async () => {
    await expect(
      runAcpPrompt({ server: mockServer(), prompt: 'hello', env: mockEnv('hang'), timeoutMs: 400 })
    ).rejects.toThrow('timed out after 400ms')
  })

  it('auto-approves tool permissions with the allow_always option', async () => {
    const result = await runAcpPrompt({
      server: mockServer(),
      prompt: 'hello',
      env: mockEnv('permission'),
    })
    expect(result.text).toBe('Hello from approved:opt-allow-always the mock agent')
    expect(result.stopReason).toBe('end_turn')
  })

  it('surfaces auth-requiring agents with a clear error', async () => {
    await expect(
      runAcpPrompt({ server: mockServer(), prompt: 'hello', env: mockEnv('auth') })
    ).rejects.toThrow(/authentication, which is not supported yet/)
  })
})

describe('ACP client file-system handlers (M2)', () => {
  it('serves read requests for paths inside the session cwd', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'pizx-acp-fs-'))
    await writeFile(join(dir, 'inside.txt'), 'secret-inside', 'utf-8')
    const result = await runAcpPrompt({
      server: mockServer(),
      prompt: 'hello',
      cwd: dir,
      env: mockEnv('fs-inside'),
    })
    expect(result.text).toContain('secret-inside')
  })

  it('rejects read requests for paths outside the session cwd', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'pizx-acp-fs-'))
    const outside = await mkdtemp(join(tmpdir(), 'pizx-acp-out-'))
    const outsideFile = join(outside, 'secret.txt')
    await writeFile(outsideFile, 'TOP-SECRET-OUTSIDE', 'utf-8')

    const result = await runAcpPrompt({
      server: mockServer(),
      prompt: 'hello',
      cwd: dir,
      env: { ...mockEnv('fs-outside'), MOCK_ACP_OUTSIDE_PATH: outsideFile },
    })

    expect(result.text).toContain('ERR:')
    expect(result.text).not.toContain('TOP-SECRET-OUTSIDE')
  })
})

describe('streamAcpPrompt', () => {
  it('yields text chunks as they arrive', async () => {
    const chunks: string[] = []
    for await (const chunk of streamAcpPrompt({
      server: mockServer(),
      prompt: 'hello',
      env: mockEnv(),
    })) {
      chunks.push(chunk)
    }
    expect(chunks).toEqual(['Hello from ', 'the mock agent'])
  })

  it('propagates errors from the server', async () => {
    const gen = streamAcpPrompt({
      server: ['pizx-command-that-does-not-exist'],
      prompt: 'hello',
    })
    await expect(gen.next()).rejects.toThrow('cannot start ACP server')
  })
})
