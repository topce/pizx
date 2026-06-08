# Α (Alpha) — Adaptive Workflow

Self-adjusting orchestration: execute a plan step by step, evaluate quality after each step, and adapt — adding, skipping, or reassigning steps based on results.

**Category: Orchestration Topology** | **Topology: Dynamic**

## Flow

1. **Plan** — Generate an initial step-by-step execution plan
2. **Execute** — Run the current step
3. **Evaluate** — Score quality (0.0–1.0) and determine adaptation
4. **Adapt** — Based on evaluation: `CONTINUE`, `REFINE`, `SKIP_NEXT`, or `ADD (new step)`
5. Loop until quality threshold met or max steps reached

## Usage

```js
// Default: 5 steps max, quality threshold 0.8
await Α`build a comprehensive solution for error handling`

// Custom thresholds
await Α({ maxSteps: 6, qualityThreshold: 0.9 })`design the system architecture`

// Lower threshold for faster completion
await Α({ qualityThreshold: 0.7 })`generate test cases for the API`

// Quiet mode
await Α.quiet`iterate on the algorithm until it meets quality standards`

// Per-phase model routing
await Α({
  plannerModel: 'anthropic/claude-sonnet-4-5',
  workerModel: 'deepseek/deepseek-v4-flash',
})`refactor the state management layer`
```

## Options

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `model` | `string` | Pi default | Fallback model |
| `plannerModel` | `string` | — | Model for plan & evaluate |
| `workerModel` | `string` | — | Model for step execution |
| `thinkingLevel` | `ThinkingLevel` | `'medium'` | Reasoning depth |
| `quiet` | `boolean` | `false` | Suppress output |
| `maxTokens` | `number` | `4096` | Max tokens per call |
| `system` | `string` | — | System prompt |
| `maxSteps` | `number` | `5` | Maximum steps before stopping |
| `qualityThreshold` | `number` | `0.8` | Quality score to stop early (0.0–1.0) |

## Adaptation Commands

| Command | Behavior |
|---------|----------|
| `CONTINUE` | Advance to next planned step |
| `REFINE` | Redo current step with improvements |
| `SKIP_NEXT` | Skip current and next step |
| `ADD <desc>` | Insert a new step before continuing |

## Output

```ts
class AdaptiveOutput extends PatternOutput {
  text: string
  finalResult: string            // Last step's output
  steps: AdaptiveStep[]          // All executed steps
  totalSteps: number             // Steps actually executed
  duration: number
}

class AdaptiveStep {
  step: number
  action: string
  result: string
  quality: number                // 0.0–1.0
  adaptation: string             // CONTINUE | REFINE | SKIP_NEXT | ADD ...
}
```

## When to Use

- Tasks where quality matters more than predictability
- Open-ended problems requiring iteration
- When you're unsure how many steps are needed
- Workflows that benefit from runtime adaptation
