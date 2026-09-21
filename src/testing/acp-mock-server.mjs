#!/usr/bin/env node
/**
 * Mock ACP agent server — a tiny JSON-RPC 2.0 over stdio implementation of the
 * Agent Client Protocol v1 agent side, used by the offline test suite.
 *
 * Behavior is selected via MOCK_ACP_MODE:
 *   ok          (default) full happy path with tool calls, chunks, and usage
 *   session-echo         like ok, but appends " [<sessionId>]" to the text so
 *                        tests can tell concurrent sessions apart
 *   permission  requests a tool permission mid-turn and echoes the client's
 *               chosen optionId into the final text
 *   auth        session/new fails with an auth_required JSON-RPC error
 *   bad-exit    writes to stderr and exits(3) during session/prompt
 *   hang        never responds to session/prompt (for timeout tests)
 *
 * Set MOCK_ACP_START_LOG to a file path to append this process's pid on boot —
 * the pool tests use it to count how many server processes were spawned.
 */

import { appendFileSync } from 'node:fs'
import readline from 'node:readline'

if (process.env.MOCK_ACP_START_LOG) {
  try {
    appendFileSync(process.env.MOCK_ACP_START_LOG, `${process.pid}\n`)
  } catch {
    // best-effort — the server must still run without a writable log
  }
}

/** Append a session lifecycle line (new/close) for the pool tests. */
function eventLog(line) {
  if (!process.env.MOCK_ACP_EVENT_LOG) return
  try {
    appendFileSync(process.env.MOCK_ACP_EVENT_LOG, `${line}\n`)
  } catch {
    // best-effort
  }
}

const mode = process.env.MOCK_ACP_MODE ?? 'ok'
const rl = readline.createInterface({ input: process.stdin })

const send = (obj) => process.stdout.write(`${JSON.stringify(obj)}\n`)
const respond = (id, result) => send({ jsonrpc: '2.0', id, result })
const respondError = (id, code, message) => send({ jsonrpc: '2.0', id, error: { code, message } })

let sessionCounter = 0
let promptId = null
let pendingPermissionId = null
let pendingPermissionSession = 'mock-session-1'
let pendingFsId = null
let pendingFsSession = 'mock-session-1'
/** sessionId → prompt JSON-RPC id for a turn held open in `cancel` mode. */
const hungTurns = new Map()

function finishTurn(extraChunk, sid, prompt) {
  const suffix = mode === 'session-echo' ? ` [${sid}]` : ''
  send({
    jsonrpc: '2.0',
    method: 'session/update',
    params: {
      sessionId: sid,
      update: {
        sessionUpdate: 'tool_call',
        toolCallId: 'call-1',
        title: 'Reading a file',
        kind: 'read',
        status: 'pending',
      },
    },
  })
  send({
    jsonrpc: '2.0',
    method: 'session/update',
    params: {
      sessionId: sid,
      update: { sessionUpdate: 'tool_call_update', toolCallId: 'call-1', status: 'completed' },
    },
  })
  send({
    jsonrpc: '2.0',
    method: 'session/update',
    params: {
      sessionId: sid,
      update: {
        sessionUpdate: 'agent_message_chunk',
        content: { type: 'text', text: 'Hello from ' },
      },
    },
  })
  send({
    jsonrpc: '2.0',
    method: 'session/update',
    params: {
      sessionId: sid,
      update: {
        sessionUpdate: 'agent_message_chunk',
        content: { type: 'text', text: `${extraChunk ?? ''}the mock agent${suffix}` },
      },
    },
  })
  respond(prompt, {
    stopReason: 'end_turn',
    usage: { totalTokens: 42, inputTokens: 20, outputTokens: 22 },
  })
}

rl.on('line', (line) => {
  let msg
  try {
    msg = JSON.parse(line)
  } catch {
    return
  }

  if (msg.method === 'initialize') {
    respond(msg.id, {
      protocolVersion: 1,
      agentCapabilities: { loadSession: false, sessionCapabilities: { close: {} } },
      agentInfo: { name: 'mock-agent', title: 'Mock ACP Agent', version: '0.0.0' },
    })
    return
  }

  if (msg.method === 'session/new') {
    if (mode === 'auth') {
      respondError(msg.id, -32002, 'auth_required: log in first')
      return
    }
    sessionCounter += 1
    const sid = `mock-session-${sessionCounter}`
    eventLog(`new ${sid}`)
    respond(msg.id, { sessionId: sid })
    return
  }

  if (msg.method === 'session/close') {
    eventLog(`close ${msg.params?.sessionId}`)
    respond(msg.id, {})
    return
  }

  if (msg.method === 'session/cancel') {
    // Only sessions held open by `cancel` mode care; others ignore cancellation.
    const sid = msg.params?.sessionId
    const hung = hungTurns.get(sid)
    if (hung !== undefined) {
      hungTurns.delete(sid)
      respond(hung, { stopReason: 'cancelled' })
    }
    return
  }

  if (msg.method === 'session/prompt') {
    promptId = msg.id
    const sid = msg.params?.sessionId ?? 'mock-session-1'
    if (mode === 'hang') return
    if (mode === 'bad-exit') {
      process.stderr.write('mock agent exploded\n')
      process.exit(3)
      return
    }
    if (mode === 'permission') {
      pendingPermissionId = 9001
      pendingPermissionSession = sid
      send({
        jsonrpc: '2.0',
        id: pendingPermissionId,
        method: 'session/request_permission',
        params: {
          sessionId: sid,
          toolCall: {
            toolCallId: 'call-run',
            title: 'Run a shell command',
            kind: 'execute',
            status: 'pending',
          },
          options: [
            { optionId: 'opt-allow-once', name: 'Allow once', kind: 'allow_once' },
            { optionId: 'opt-allow-always', name: 'Always allow', kind: 'allow_always' },
          ],
        },
      })
      return
    }
    if (mode === 'fs-inside' || mode === 'fs-outside') {
      pendingFsId = 7001
      pendingFsSession = sid
      send({
        jsonrpc: '2.0',
        id: pendingFsId,
        method: 'fs/read_text_file',
        params: {
          sessionId: sid,
          path:
            mode === 'fs-outside'
              ? (process.env.MOCK_ACP_OUTSIDE_PATH ?? '/etc/hostname')
              : 'inside.txt',
        },
      })
      return
    }
    // `cancel` mode holds a HANG turn open until the client cancels that session,
    // so a timeout in one session can be tested against a healthy sibling.
    if (mode === 'cancel' && JSON.stringify(msg.params?.prompt ?? '').includes('HANG')) {
      hungTurns.set(sid, promptId)
      return
    }
    finishTurn(undefined, sid, promptId)
    return
  }

  // A response to our own outbound fs/read_text_file request.
  if (pendingFsId !== null && msg.id === pendingFsId) {
    pendingFsId = null
    const sid = pendingFsSession
    if (msg.error) {
      send({
        jsonrpc: '2.0',
        method: 'session/update',
        params: {
          sessionId: sid,
          update: {
            sessionUpdate: 'agent_message_chunk',
            content: { type: 'text', text: `ERR:${msg.error.message}` },
          },
        },
      })
      respond(promptId, { stopReason: 'end_turn' })
    } else {
      send({
        jsonrpc: '2.0',
        method: 'session/update',
        params: {
          sessionId: sid,
          update: {
            sessionUpdate: 'agent_message_chunk',
            content: { type: 'text', text: `OK:${JSON.stringify(msg.result)}` },
          },
        },
      })
      respond(promptId, { stopReason: 'end_turn' })
    }
    return
  }

  // A response to our own outbound request (the permission request).
  if (pendingPermissionId !== null && msg.id === pendingPermissionId) {
    pendingPermissionId = null
    if (msg.result?.outcome?.outcome === 'selected') {
      finishTurn(`approved:${msg.result.outcome.optionId} `, pendingPermissionSession, promptId)
    } else {
      respond(promptId, { stopReason: 'refusal' })
    }
    return
  }

  respondError(msg.id, -32601, `method not found: ${msg.method}`)
})
