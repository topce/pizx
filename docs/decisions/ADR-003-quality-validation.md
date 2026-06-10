# ADR-003: Quality Validation (qualityCheck)

## Status

Accepted

## Date

2025-06-10

## Context

Initially, only 3 of 15 patterns (Ρ Ralph Loop, Ψ Critique, Α Adaptive) had built-in quality validation. The remaining 12 (Ω, Σ, Δ, Θ, Μ, Β, Ν, Τ, Λ, Φ, Γ, Χ) produced outputs with no quality assessment. Users had no way to programmatically evaluate whether a pattern's output met quality standards.

## Decision

Add an optional `qualityCheck: boolean` option to every pattern. When enabled, a post-execution LLM review scores the final output (0.0–1.0), provides an assessment, and recommends improvements.

### Implementation

A shared `runQualityReview()` helper in `types.ts` handles the common logic:

```typescript
export async function runQualityReview(
  originalRequest: string,
  finalOutput: string,
  opts: { ... }
): Promise<QualityReviewResult | undefined> {
  if (!opts.qualityCheck) return undefined

  const reviewText = await ask(
    `Original request:\n${originalRequest}\n\nFinal deliverable:\n${finalOutput}\n\nEvaluate the quality.`,
    { model: opts.plannerModel, system: QUALITY_REVIEW_SYSTEM, ... }
  )

  return {
    score: parseFloat(scoreRegex),
    assessment: assessmentRegex,
    recommendation: recRegex,
  }
}
```

Each pattern calls this after its final synthesis/execution step:

```typescript
// In Ω (Orchestrator), after synthesis:
const qualityReview = await runQualityReview(request, synthesis, opts)
```

The result is stored as an optional `qualityReview` field on each pattern's output class:

```typescript
export class OrchestratorOutput extends PatternOutput {
  ...
  public readonly qualityReview?: QualityReviewResult
}
```

### QualityReviewResult type

```typescript
export interface QualityReviewResult {
  score: number        // 0.0 (poor) to 1.0 (perfect)
  assessment: string   // 1-2 sentence evaluation
  recommendation: string  // 1 sentence improvement suggestion
}
```

The LLM review prompt uses a structured format that's reliably parseable:

```
SCORE: 0.XX
ASSESSMENT: (one sentence)
RECOMMENDATION: (one sentence)
```

### Patterns that already had validation

Three patterns had built-in quality evaluation that was kept unchanged:
- **Ρ (Ralph Loop)**: Review phase evaluates FULLY/PARTIALLY, ITERATE/DONE
- **Ψ (Critique)**: Generate → critique → improve cycle with strengths/weaknesses/suggestions
- **Α (Adaptive)**: Each step gets a quality score (0.0–1.0) with threshold-based early stopping

These were left as-is because they have deeper integration with the pattern loop (affecting iteration decisions). The new `qualityCheck` is additive — it evaluates the final output without affecting execution flow.

## Alternatives Considered

### Built-in validation for all patterns (no opt-in)

- Pros: Every output always has a quality score
- Cons: Adds ~500ms per pattern run, costs extra tokens. Not all use cases need validation.
- Rejected: Pay-as-you-go matches the project's design philosophy.

### Iterative refinement (re-run low-quality output)

- Pros: Could auto-improve bad outputs
- Cons: Complex, unpredictable cost, could loop infinitely. Belongs in a future "auto-improve" meta-pattern.
- Rejected: Out of scope — qualityCheck is for visibility, not correction.

### Numeric-only score (no assessment/recommendation)

- Pros: Simpler output, lower token cost
- Cons: Score without context is hard to act on. The assessment provides actionable feedback.
- Rejected: The structured format adds ~50 tokens for significant value.

### Separate review pattern (Χ Chi) for quality analysis

- Pros: Keeps patterns clean, Chi already analyzes execution traces
- Cons: Requires a separate call, can't be inline in the pattern output
- Rejected: qualityCheck is inline and automatic. Chi is for deeper cross-pattern analysis.

## Consequences

- **Positive**: All 15 patterns now support quality validation — single UX pattern across the board.
- **Positive**: Opt-in means zero cost when not needed.
- **Positive**: Structured format is machine-parseable for automated quality dashboards.
- **Negative**: Adds one extra LLM call per pattern run when enabled (~500ms, ~200 tokens).
- **Negative**: Quality scores depend on the reviewer model — a weak plannerModel gives weak reviews.
- **Trade-off**: Using the plannerModel for quality review keeps costs low but means the review model is the same one used for synthesis, reducing diversity of perspective.
