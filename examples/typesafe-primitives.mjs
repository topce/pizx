#!/usr/bin/env pizx
/// <reference types="@topce/pizx/globals" />

// ── TypeSafe primitives — choice, score, noul ───────────────────────────────
// TypeSafe's System One model answers typed questions about a piece of state:
// a Choice (pick a label), a Score (position on an ordered rubric), or a Noul
// (probability a yes/no statement is true). Each is an ordinary pizx letter,
// so it gets option chaining, .cache, tracing, and --json for free.
//
// Run:  TYPESAFE_API_KEY=… pizx examples/typesafe-primitives.mjs
//
// The template body is the *state* (what is being judged); `instructions` is
// the question. Omit `instructions` and the body becomes the question instead.
// `.text` is the usable scalar; `.answer` is the full typed answer (with
// confidence and probabilities).

const state = `Hi, I was charged twice for order A-104. Please refund the duplicate charge.
This is urgent — I've been waiting three days and nobody replied.`

// ── Noul: probability that a statement holds ────────────────────────────────
const refund = await noul({
  instructions: 'Does the customer request a refund?',
})`${state}`
echo('refund requested?', refund.text, `(p=${refund.answer.noul})`)

// ── Choice: one label from a fixed set, with confidence ─────────────────────
const team = await choice({
  instructions: 'Which team should handle this ticket?',
  criteria: {
    billing: 'Payment, invoices, refunds',
    technical: 'Bugs or integration problems',
    sales: 'Pricing or account questions',
  },
})`${state}`
echo('routed to:', team.text, `(confidence ${team.answer.confidence})`)

// ── Score: a position along an ordered rubric ───────────────────────────────
const frustration = await score({
  instructions: 'How frustrated does the customer appear?',
  criteria: ['Calm, stating facts', 'Frustrated but civil', 'Very angry'],
})`${state}`
echo('frustration:', frustration.text, `(confidence ${frustration.answer.confidence})`)

// Branch in code on the typed answers — no prose parsing.
if (frustration.answer.score > 1.5 || refund.answer.noul > 0.8) {
  echo('→ flag for a priority human response')
}
