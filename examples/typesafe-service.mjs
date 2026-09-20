#!/usr/bin/env pizx
/// <reference types="@topce/pizx/globals" />

// ── typesafe-service.mjs — the ctx.typesafe service ─────────────────────────
// The primitive letters (`noul`/`choice`/`score`) and the pattern words all sit
// on one cordis service: `ctx.typesafe`. Calling it directly is the most
// efficient way to ask a batch of questions, because a single System One call
// evaluates every question against the same state in parallel.
//
// Unlike the letters, the service takes *structured* state natively (no
// String() interpolation), and `instructions` can reference state fields by
// dot-and-index path — e.g. `ticket.messages[0].text`.
//
// Run:  TYPESAFE_API_KEY=… pizx examples/typesafe-service.mjs

import { createPizx } from '@topce/pizx'
import { chalk } from 'zx'

const app = await createPizx()

try {
  // ── State: the whole context, sent once ──────────────────────────────────
  const state = {
    ticket: {
      id: 'A-104',
      subject: 'Duplicate charge',
      messages: [
        { from: 'customer', text: 'I was charged twice for order A-104. Please refund the duplicate — this is urgent.' },
        { from: 'support', text: 'We are checking the charges.' },
      ],
    },
    order: {
      id: 'A-104',
      charges: [
        { amount_usd: 49, status: 'captured' },
        { amount_usd: 49, status: 'captured' },
      ],
    },
    refund_policy: 'Duplicate charges are eligible for a refund.',
  }

  // ── One request, four typed answers in parallel ──────────────────────────
  const { answers, model, usage } = await app.typesafe.ask(state, {
    department: {
      type: 'choice',
      instructions: 'Which team should handle this ticket?',
      criteria: { billing: 'Payments and refunds', technical: 'Bugs', sales: 'Pricing' },
    },
    refund_requested: {
      type: 'noul',
      instructions: 'Does `ticket.messages[0].text` request a refund?',
    },
    policy_supports_refund: {
      type: 'noul',
      instructions:
        'Does `refund_policy` support the refund requested in `ticket.messages[0].text`, given `order.charges`?',
    },
    frustration: {
      type: 'score',
      instructions: 'How frustrated is the customer?',
      criteria: ['Calm', 'Frustrated but civil', 'Very angry'],
    },
  })

  echo(chalk.bold(`\n typesafe service — ${model} (${usage.input_tokens} input tokens)\n`))
  echo(`  department        : ${answers.department.choice}  (conf ${answers.department.confidence})`)
  echo(`  probabilities     : ${JSON.stringify(answers.department.probabilities)}`)
  echo(`  refund requested  : ${answers.refund_requested.noul}`)
  echo(`  policy supports   : ${answers.policy_supports_refund.noul}`)
  echo(`  frustration       : ${answers.frustration.score}  (conf ${answers.frustration.confidence})`)

  // ── Confidence is a second decision axis ─────────────────────────────────
  // The answer tells you *what*; confidence tells you *whether to act*.
  const FLOOR = 0.6
  const isRefund =
    answers.refund_requested.noul > 0.7 && answers.policy_supports_refund.noul > 0.7

  if (answers.department.confidence < FLOOR) {
    echo(chalk.yellow('\n  → low confidence: route to a human reviewer'))
  } else if (answers.department.choice === 'billing' && isRefund) {
    echo(chalk.green(`\n  → auto-approve refund for ${state.order.id} (customer likely wants it)`))
  } else {
    echo(`\n  → route to ${answers.department.choice}`)
  }

  // ── The call is traced like any LLM call ─────────────────────────────────
  echo(chalk.dim(`\n${app.traceSummary()}`))
} finally {
  await app.dispose()
}
