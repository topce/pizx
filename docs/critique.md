# Ψ (Psi) — Critique

Single-pass content refinement: **generate → critique → improve**.

## Flow

1. **Generate** — An initial draft/answer/solution is produced
2. **Critique** — A critical reviewer identifies strengths, weaknesses, and improvements
3. **Improve** — The content is revised based on the critique

Optionally repeats for multiple rounds (up to 3).

## Usage

```js
// Single critique round (default)
await Ψ`write a README for this project`

// Multi-round refinement
await Ψ({ rounds: 2 })`explain dependency injection to a junior developer`

// Three rounds of polish
await Ψ({ rounds: 3 })`generate a compelling pitch deck summary`

// Quiet mode
await Ψ.quiet`generate a commit message for these changes`

// Per-phase model routing
await Ψ({
  plannerModel: 'anthropic/claude-sonnet-4-5',  // critique phase
  workerModel: 'deepseek/deepseek-v4-flash',     // generate/improve phases
})`write documentation for the API`
```

## Options

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `model` | `string` | Pi default | Fallback model |
| `plannerModel` | `string` | — | Model for critique phase |
| `workerModel` | `string` | — | Model for generate/improve phases |
| `thinkingLevel` | `ThinkingLevel` | `'medium'` | Reasoning depth |
| `quiet` | `boolean` | `false` | Suppress output |
| `maxTokens` | `number` | `4096` | Max tokens per call |
| `system` | `string` | — | System prompt |
| `rounds` | `number` | `1` | Critique-improve cycles (max 3) |

## Output

```ts
class CritiqueOutput extends PatternOutput {
  text: string                   // Summary of all rounds
  finalContent: string           // The final improved content
  rounds: CritiqueRound[]        // Each round's content + critique
  duration: number
}

class CritiqueRound {
  content: string    // Generated/improved content
  critique: string   // The critique of this content
  round: number      // 0-based
}
```

## Comparison with Ρ (Ralph Loop)

| | Ψ Critique | Ρ Ralph Loop |
|---|---|---|
| Focus | Content quality | Code improvement |
| Tool use | LLM only | Coding agent with tools |
| Rounds | 1–3 passes | Until quality met or max iterations |
| Best for | Writing, docs, explanations | Code refactoring, bug fixing |

## When to Use

- Polishing documentation, READMEs, or commit messages
- Improving explanations and tutorials
- Content quality assurance
- When you want LLM-only refinement without code changes
