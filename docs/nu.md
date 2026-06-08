# Ν (Nu) — Self-Organizing Teams

Auto-negotiate roles and workflow: agents autonomously propose their own roles, determine the optimal workflow, then execute and synthesize.

## Flow

1. **Negotiate Roles** — Analyze the task and propose specialized agent roles (planner)
2. **Decide Workflow** — Determine whether `sequential`, `parallel`, or `mixed` execution is best (planner)
3. **Execute** — Run all roles according to the chosen workflow (worker)
4. **Synthesize** — Combine all role outputs into a final answer (planner)

## Usage

```js
// Auto-negotiate everything
await Ν`analyze the full codebase for security vulnerabilities`

// Control team size
await Ν({ minAgents: 2, maxAgents: 5 })`design a real-time chat architecture`

// Explicit roles (skip negotiation)
await Ν({ roles: [
  new NuRole('Security Auditor', 'Finding vulnerabilities', 'Identify all auth and data risks'),
  new NuRole('Performance Engineer', 'Optimization patterns', 'Find bottlenecks in the codebase'),
] })`audit the application`

// Quiet mode
await Ν.quiet`plan the project roadmap for Q3`

// Per-phase model routing
await Ν({
  plannerModel: 'anthropic/claude-sonnet-4-5',
  workerModel: 'deepseek/deepseek-v4-flash',
})`develop a migration strategy from monolith to microservices`
```

## Options

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `model` | `string` | Pi default | Fallback model |
| `plannerModel` | `string` | — | Model for negotiation, workflow, synthesis |
| `workerModel` | `string` | — | Model for role execution |
| `thinkingLevel` | `ThinkingLevel` | `'medium'` | Reasoning depth |
| `quiet` | `boolean` | `false` | Suppress output |
| `maxTokens` | `number` | `4096` | Max tokens per call |
| `system` | `string` | — | System prompt |
| `minAgents` | `number` | `2` | Minimum agents to propose |
| `maxAgents` | `number` | `5` | Maximum agents to propose |
| `roles` | `NuRole[]` | auto | Explicit roles (skip negotiation) |

## NuRole

```ts
class NuRole {
  name: string        // Role name, e.g. "Security Analyst"
  expertise: string   // Domain expertise description
  goal: string        // What this role should accomplish
}
```

## Output

```ts
class NuOutput extends PatternOutput {
  text: string
  negotiatedRoles: NuRole[]              // Auto-negotiated roles
  workflow: 'sequential' | 'parallel' | 'mixed'
  workflowReasoning: string              // Why this workflow was chosen
  roleResults: { role: string; output: string }[]
  synthesis: string                      // Final synthesized answer
  duration: number
}
```

## When to Use

- Complex, open-ended tasks where the approach isn't obvious
- Tasks that benefit from autonomous role assignment
- When you want the system to figure out the best team structure
- Exploratory analysis where the problem domain dictates the expertise needed
