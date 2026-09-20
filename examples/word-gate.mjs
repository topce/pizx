#!/usr/bin/env pizx
/// <reference types="@topce/pizx/globals" />

// ── gate — TypeSafe Confidence-Gated Routing ────────────────────────────────
// The answer tells you *what*; confidence tells you *whether to act*. Classify
// with one Choice question, then act only when confidence clears that action's
// threshold. Below the floor, escalate to a human (or a safer path) instead.
//
// Run:  TYPESAFE_API_KEY=… pizx examples/word-gate.mjs
//
// `routes` map choices to handlers; the handlers here are π (a text letter),
// but they can be any letter ref — a specialist prompt, a coding agent, etc.

const command = 'Please approve the pending transfer of 4,200 EUR to the new payee.'

const out = await gate({
  instructions: 'What action is the user requesting?',
  criteria: {
    check_balance: 'Check the balance of an account',
    approve_transfer: 'Approve a pending transfer',
    other: 'Something else',
  },
  routes: {
    check_balance: 'π',
    approve_transfer: 'π',
    other: 'π',
  },
  // Approving money needs very high confidence; checking a balance does not.
  thresholds: { approve_transfer: 0.85 },
  floor: 0.6,
  escalate: 'π',
})`${command}`

echo('choice     :', out.answer.choice, `(confidence ${out.answer.confidence})`)
echo('escalated  :', out.answer.escalated)
echo('handled by :', out.answer.handledBy)
echo('---')
echo(out.text)
