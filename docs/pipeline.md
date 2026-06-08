# Λ (Lambda) — Pipeline

Sequential agent chain: each stage receives the previous stage's output as input, like Unix pipes but for AI processing.

## Behavior

Stages are parsed from the template (separated by `→`, `->`, `|`, or newlines) or from explicit arrays. Each stage runs sequentially, receiving the output of the prior stage as context. The final stage's output is the pipeline result.

## Usage

```js
// Parse stages from separators (→ or |)
await Λ`analyze code → generate documentation → review for accuracy`

// Pipe-style
await Λ`extract business logic | translate to TypeScript | run type check | fix errors`

// Explicit stage names
await Λ({ stages: ['analyze', 'generate', 'review', 'publish'] })`write API docs`

// Custom prompts per stage
await Λ({ stagePrompts: [
  'Analyze the code and identify key functions',
  'Generate documentation based on this analysis',
  'Review the documentation for accuracy and completeness',
] })`document the auth module`

// Quiet mode
await Λ.quiet`extract errors → suggest fixes → generate patch`
```

## Options

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `model` | `string` | Pi default | Fallback model |
| `workerModel` | `string` | — | Model for all pipeline stages |
| `thinkingLevel` | `ThinkingLevel` | `'medium'` | Reasoning depth |
| `quiet` | `boolean` | `false` | Suppress output |
| `maxTokens` | `number` | `4096` | Max tokens per call |
| `system` | `string` | — | System prompt |
| `stages` | `string[]` | auto | Explicit stage names |
| `stagePrompts` | `string[]` | auto | Custom prompt per stage |
| `separator` | `string` | `'→'` | Stage separator in template |

## Output

```ts
class PipelineOutput extends PatternOutput {
  text: string                          // Summary of all stages
  finalOutput: string                   // Result of the last stage
  stages: PipelineStageResult[]         // Per-stage outputs
  duration: number
}

class PipelineStageResult {
  stage: string
  output: string
  index: number     // 0-based
}
```

## When to Use

- Multi-step transformations (translate → summarize → format)
- Document generation pipeline (extract → draft → review → publish)
- Data processing chains
- Any workflow where each step depends on the previous step's output
