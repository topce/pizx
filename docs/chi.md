# Χ (Chi) — Cross-Agent Learning

Analyze execution traces from any pizx pattern and extract structured learnings: what worked, bottlenecks, quality gaps, and actionable improvements.

**Category: Orchestration Topology** | **Analytics: Cross-Agent Pattern Extraction**

## Behavior

Takes an execution trace (from a previous pattern output, explicit trace text, or a described execution) and analyzes it across 4 dimensions: communication, workflow, quality, and efficiency. Produces structured insights with confidence scores and concrete improvement recommendations.

## Usage

```js
// Analyze a described execution
await Χ`extract learnings from a debate about microservices vs monolith`

// Analyze a previous pattern output
const debateResult = await Δ`should we use React or Vue?`
const learnings = await Χ({ source: debateResult })`analyze`
console.log(learnings.summary)
console.log(learnings.suggestedChanges)

// Analyze an explicit trace
await Χ({ trace: `
  Round 1: Optimist argued for speed, Pessimist identified risks
  Round 2: Optimist doubled down, Pessimist found more gaps
  Synthesis: Compromise approach suggested
` })`identify optimization opportunities`

// Quiet mode
await Χ.quiet`review the fleet execution for efficiency patterns`
```

## Options

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `model` | `string` | Pi default | Fallback model |
| `plannerModel` | `string` | — | Model for analysis |
| `thinkingLevel` | `ThinkingLevel` | `'high'` | Reasoning depth (high recommended) |
| `quiet` | `boolean` | `false` | Suppress output |
| `maxTokens` | `number` | `4096` | Max tokens per call |
| `system` | `string` | — | System prompt |
| `source` | `PatternOutput` | — | Previous pattern output to analyze |
| `trace` | `string` | — | Explicit trace text |

## Analysis Categories

| Category | What's Analyzed |
|----------|-----------------|
| `communication` | Information sharing, bottlenecks, gaps |
| `workflow` | Execution order, unnecessary/missing steps |
| `quality` | Gaps, inconsistencies, errors in outputs |
| `efficiency` | Parallelism, caching, batching opportunities |

## Output

```ts
class ChiOutput extends PatternOutput {
  text: string
  insights: LearningInsight[]     // Per-category structured insights
  summary: string                 // Executive summary
  suggestedChanges: string        // Concrete changes to roles, prompts, or workflow
  duration: number
}

class LearningInsight {
  category: string         // 'communication' | 'workflow' | 'quality' | 'efficiency'
  pattern: string          // Observed pattern
  recommendation: string   // Actionable improvement
  confidence: number       // 0.0–1.0
}
```

## When to Use

- After a complex multi-agent execution, to learn what worked
- Meta-optimization: improving how patterns are used
- Debugging poor agent performance
- Continuous improvement of agent workflows
