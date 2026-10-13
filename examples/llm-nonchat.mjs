#!/usr/bin/env pizx
/// <reference types="@topce/pizx/globals" />

// ── llm-nonchat.mjs — classifier & image models on the ctx.llm service ─────
//
// π is a thin letter over `ctx.llm`. The same service also reaches Pi's
// non-chat models, so a script can classify structured state or generate an
// image without going through a chat completion:
//
//   modelsOfType(type, provider?)   list the catalog (no credentials checked)
//   pickOfType(type, preferred?)    one model: 'provider/id' | 'id' | first credentialed
//   classify(model, context)        typed answers about JSON state
//   generateImages(model, context)  images from text / image blocks
//
// The important contract difference: unlike `ask`, `classify` and
// `generateImages` **never reject** on a provider error. They resolve with a
// result whose `stopReason` is `'error'` (or `'aborted'`) and an
// `errorMessage`. The script checks `stopReason` before reading answers —
// which is also why it degrades gracefully with no classifier/image credentials.
//
// level 7/7 ●●●●●●● · feature: ctx.llm non-chat models · previous: examples/pi-tool-trace.mjs
//
// Run:   pizx examples/llm-nonchat.mjs
//        pizx examples/llm-nonchat.mjs --trace
//
// Needs credentials for a classifier and/or image model. TypeSafe classifiers
// (`typesafe/jev-latest`) accept a TYPESAFE_API_KEY; image models are usually
// behind OPENROUTER_API_KEY. Discovery runs regardless; missing credentials
// turn a section into a demonstration of the error contract, not a crash.

import { createPizx } from '@topce/pizx'
import { chalk, fs, os, path } from 'zx'

const app = await createPizx()

try {
  echo(chalk.bold('\n ctx.llm — non-chat models\n'))

  // ── 1. Discovery — list the catalog, no credentials required ─────────────
  const classifiers = await app.ctx.llm.modelsOfType('classifier')
  const images = await app.ctx.llm.modelsOfType('image')
  echo(`  classifiers: ${chalk.cyan(classifiers.length)} known`)
  for (const m of classifiers.slice(0, 3)) echo(chalk.dim(`    ${m.provider}/${m.id}`))
  echo(`  images:      ${chalk.cyan(images.length)} known`)
  for (const m of images.slice(0, 3)) echo(chalk.dim(`    ${m.provider}/${m.id}`))

  // `modelsOfType(type, provider)` narrows to one provider.
  const typeSafe = await app.ctx.llm.modelsOfType('classifier', 'typesafe')
  echo(chalk.dim(`  ${typeSafe.length} of them are from the "typesafe" provider`))

  // ── 2. A real classification over this repo's last commit ────────────────
  const subject = (await $`git log -1 --format=%s`).stdout.trim()
  const stat = (await $`git show --stat --format= HEAD`).stdout.trim()
  const context = {
    state: {
      subject,
      changed_files: stat.split('\n').filter(Boolean).slice(0, 20),
    },
    questions: {
      kind: {
        type: 'choice',
        instructions: 'What kind of change does this commit make?',
        criteria: {
          feature: 'Adds or extends user-facing capability',
          fix: 'Corrects a defect or regression',
          docs: 'Documentation only',
          refactor: 'Internal restructuring with no behaviour change',
          chore: 'Build, deps, or release housekeeping',
        },
      },
      release_worthy: {
        type: 'bool',
        instructions: 'Does this commit belong in release notes?',
        criteria: { true: 'Yes, worth announcing', false: 'No, internal only' },
      },
    },
  }

  // `pickOfType(type)` returns the first model with working credentials;
  // `pickOfType(type, 'provider/id')` pins a specific one. Both are shown here.
  const credentialed = await app.ctx.llm.pickOfType('classifier')
  const named = await app.ctx.llm.pickOfType('classifier', 'typesafe/jev-latest')
  const judge = named ?? credentialed
  echo(chalk.bold('\n  classification ') + chalk.dim(`(${subject})`))
  echo(
    chalk.dim(
      `  pickOfType('classifier') → ${credentialed ? `${credentialed.provider}/${credentialed.id}` : 'none credentialed'}`
    )
  )

  if (judge) {
    echo(chalk.dim(`  model: ${judge.provider}/${judge.id}`))
    const verdict = await app.ctx.llm.classify(judge, context)
    if (verdict.stopReason !== 'stop') {
      // No throw — the failure is data on the result. Add credentials and the
      // same call takes the success path below.
      echo(chalk.yellow(`  classifier failed: ${verdict.errorMessage ?? verdict.stopReason}`))
      echo(chalk.dim('  → check stopReason before answers; classify() never throws on a provider error'))
    } else {
      const kind = verdict.answers.kind
      const worthy = verdict.answers.release_worthy
      echo(`  kind:            ${chalk.cyan(kind.choice)}  ${chalk.dim(`(confidence ${kind.confidence})`)}`)
      echo(`  probabilities:   ${chalk.dim(JSON.stringify(kind.probabilities))}`)
      echo(`  release-worthy:  ${chalk.cyan(worthy.probability)}  ${chalk.dim('(probability)')}`)
      echo(chalk.green(`\n  → gate: ${worthy.probability > 0.5 ? 'include in release notes' : 'leave out'}`))
      echo(chalk.dim(`  usage: ${verdict.usage ? `${verdict.usage.totalTokens} tokens` : 'not reported'}`))
    }
  } else {
    echo(chalk.yellow('  no classifier model found at all — add one and re-run'))
  }

  // ── 3. Image generation ──────────────────────────────────────────────────
  echo(chalk.bold('\n  image generation '))
  const credentialedImage = await app.ctx.llm.pickOfType('image')
  const painter = credentialedImage ?? (await app.ctx.llm.pickOfType('image', 'openrouter/google/gemini-2.5-flash-image'))
  echo(
    chalk.dim(
      `  pickOfType('image') → ${credentialedImage ? `${credentialedImage.provider}/${credentialedImage.id}` : 'none credentialed'}`
    )
  )
  if (!painter) {
    echo(chalk.yellow('  no credentialed image model — pickOfType returned undefined'))
    echo(chalk.dim('  (set OPENROUTER_API_KEY, or `pi auth login` for an image provider)'))
  } else {
    echo(chalk.dim(`  model: ${painter.provider}/${painter.id}`))
    const generated = await app.ctx.llm.generateImages(painter, {
      input: [
        {
          type: 'text',
          text: 'A minimal flat illustration of a shell prompt handing off to a small robot, teal and slate palette, no text.',
        },
      ],
    })
    if (generated.stopReason !== 'stop') {
      echo(chalk.red(`  generation failed: ${generated.errorMessage ?? generated.stopReason}`))
    } else {
      const blocks = generated.output
      const image = blocks.find((b) => b.type === 'image')
      if (!image) {
        echo(chalk.yellow('  model returned no image block'))
      } else {
        const out = path.join(os.tmpdir(), `pizx-nonchat-${Date.now()}.png`)
        await fs.writeFile(out, Buffer.from(image.data, 'base64'))
        echo(chalk.green(`  wrote ${out}`) + chalk.dim(` (${image.mimeType})`))
      }
      for (const block of blocks.filter((b) => b.type === 'text')) echo(chalk.dim(`  ${block.text}`))
      echo(chalk.dim(`  usage: ${generated.usage ? `${generated.usage.totalTokens} tokens` : 'not reported'}`))
    }
  }

  // ── 4. Anything that ran is traced ───────────────────────────────────────
  // classify/generateImages record their usage into the active span when the
  // service reports token counts, exactly like an `ask` call.
  echo(chalk.dim(`\n${app.traceSummary()}`))
} finally {
  await app.dispose()
}

// ── Notes ──────────────────────────────────────────────────────────────────
// * `type` is a Pi `ModelType`: `'chat'`, `'classifier'`, or `'image'`.
// * `pickOfType` tries `provider/id`, then a bare id suffix, then the first
//   model with working credentials — `undefined` when none is configured.
// * `options` are the pi-ai request options (`apiKey`, `signal`, `onPayload`,
//   `onResponse`) plus `temperature` for classifiers and `metadata` for images.
// * Answer shapes: `choice` → `{ choice, probabilities, confidence }`,
//   `score` → `{ score, confidence }`, `bool` → `{ probability }`.
// * codemode scripts can reach the same models via `models.classify()` /
//   `models.generateImages()` — see examples/pi-codemode.mjs.
