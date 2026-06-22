/**
 * Shared utility functions for patterns.
 *
 * Currently hosts anti-spin detection helpers used by
 * both Ρ (Ralph Loop) and γ (Goal tag).
 */

/** Compute a simple token-overlap similarity between two strings (0.0–1.0).
 *  Uses Jaccard similarity on whitespace-delimited tokens. */
export function textSimilarity(a: string, b: string): number {
  const tokensA = new Set(a.toLowerCase().split(/\s+/).filter(Boolean))
  const tokensB = new Set(b.toLowerCase().split(/\s+/).filter(Boolean))
  if (tokensA.size === 0 && tokensB.size === 0) return 1
  let overlap = 0
  for (const t of tokensA) {
    if (tokensB.has(t)) overlap++
  }
  const union = tokensA.size + tokensB.size - overlap
  return union === 0 ? 0 : overlap / union
}

/** Verdict type used by the Goal tag for anti-spin detection. */
export type VerdictLiteral = 'ALL_PASS' | 'HAS_FAILURES' | 'HAS_PARTIALS'

/**
 * Check a review/verification against the previous one for anti-spin signals.
 *
 * Supports two call styles:
 *   - Ralph: `(review, prevReview, boolean[])` — uses ITERATE/DONE booleans
 *   - Goal:  `(verification, prevVerification, string[])` — uses PASS/FAIL strings
 *
 * Returns a termination reason string, or null if no spin detected.
 */
export function checkAntiSpin(
  current: string,
  prev: string | undefined,
  history: boolean[] | string[]
): string | null {
  if (!prev) return null

  // No-progress: >80% token overlap with previous review/verification
  const sim = textSimilarity(current, prev)
  if (sim > 0.8) {
    return `no-progress detected (similarity: ${(sim * 100).toFixed(0)}%)`
  }

  // Flip-flop: alternating pattern across last 4 entries
  if (history.length >= 4) {
    const recent = history.slice(-4)
    if (recent[0] === recent[2] && recent[1] === recent[3] && recent[0] !== recent[1]) {
      return 'flip-flop detected (alternating pattern)'
    }
  }

  return null
}
