/**
 * Shared agent role sets for pizx patterns.
 *
 * Each pattern defines its own role flavor, but they all share the same
 * Record<number, string[]> structure. Centralizing them here avoids ~240
 * lines of duplicated structure across 4 files.
 */

/** Debate perspectives: multi-perspective convergence roles */
export const DEBATE_ROLE_SETS: Record<number, string[]> = {
  2: [
    'Optimist — advocate for the most ambitious approach',
    'Pessimist — identify risks and failure modes',
  ],
  3: [
    'Optimist — advocate the benefits and opportunities',
    'Pessimist — identify risks, costs, and failure modes',
    'Pragmatist — focus on practical trade-offs and implementation',
  ],
  4: [
    'Optimist — argue for the best-case potential',
    'Pessimist — highlight worst-case risks and downsides',
    'Pragmatist — balance pros/cons with practical constraints',
    'Innovator — propose creative alternatives and novel approaches',
  ],
  5: ['Optimist', 'Pessimist', 'Pragmatist', 'Innovator', 'User Advocate — focus on end-user experience and accessibility'],
}

/** Memory (blackboard) roles: shared analysis contributors */
export const MEMORY_ROLE_SETS: Record<number, string[]> = {
  2: ['Analyst — deep analysis of core aspects', 'Reviewer — check for gaps and blind spots'],
  3: [
    'Analyst — deep analysis of core aspects',
    'Reviewer — check for gaps, edge cases, and blind spots',
    'Strategist — connect findings to actionable insights',
  ],
  4: ['Analyst', 'Reviewer', 'Strategist', 'Innovator — propose novel angles and creative solutions'],
  5: ['Analyst', 'Reviewer', 'Strategist', 'Innovator', 'Skeptic — challenge assumptions and stress-test conclusions'],
}

/** Thread (conversation) roles: multi-agent dialogue participants */
export const THREAD_ROLE_SETS: Record<number, string[]> = {
  2: ['Proposer — advocate the best approach', 'Critic — identify weaknesses and gaps'],
  3: [
    'Proposer — suggest the best approach',
    'Critic — identify weaknesses, risks, and missing pieces',
    'Synthesizer — combine the best ideas into a practical plan',
  ],
  4: [
    'Proposer — advocate a bold solution',
    'Critic — identify risks and weaknesses',
    'Pragmatist — focus on practical implementation',
    'Innovator — propose creative alternatives',
  ],
  5: ['Proposer', 'Critic', 'Pragmatist', 'Innovator', "Devil's Advocate — challenge every assumption"],
}

/** Broadcast roles: specialist experts responding to a question */
export const BROADCAST_ROLE_SETS: Record<number, string[]> = {
  2: [
    'Technical Expert — evaluate technical feasibility',
    'Business Expert — evaluate business viability',
  ],
  3: [
    'Technical Expert — evaluate technical feasibility',
    'Business Expert — evaluate business viability',
    'User Expert — evaluate user experience and adoption',
  ],
  4: [
    'Technical Expert',
    'Business Expert',
    'User Expert',
    'Risk Expert — identify risks, compliance, and security concerns',
  ],
  5: [
    'Technical Expert',
    'Business Expert',
    'User Expert',
    'Risk Expert',
    'Innovation Expert — suggest novel approaches and alternatives',
  ],
}
