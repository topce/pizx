# Γ (Gamma) — DAG Graph

DAG-based task execution: define tasks and their dependencies as a directed acyclic graph. Tasks with all dependencies met run in parallel.

**Category: Orchestration Topology** | **Topology: Directed Acyclic Graph**

## Behavior

Parses the template into a chain of tasks (using `→` separator) or accepts an explicit graph definition. Runs a topological sort to determine execution order. Each batch of independent nodes runs in parallel. Each node receives the outputs of its dependencies as context.

## Usage

```js
// Simple chain: market research → competitor analysis → strategy doc
await Γ`market-research → competitor-analysis → strategy-doc`

// Explicit graph definition
await Γ({ graph: {
  nodes: [
    { id: 'research', task: 'Research the competitive landscape' },
    { id: 'analysis', task: 'Analyze strengths and weaknesses' },
    { id: 'strategy', task: 'Create market entry strategy' },
    { id: 'risks', task: 'Identify and assess risks' },
    { id: 'summary', task: 'Summarize findings into executive report' },
  ],
  edges: [
    { from: 'research', to: 'analysis' },
    { from: 'analysis', to: 'strategy' },
    { from: 'research', to: 'risks' },
    { from: 'strategy', to: 'summary' },
    { from: 'risks', to: 'summary' },
  ],
} })`execute`

// Quiet mode
await Γ.quiet`extract-data → transform → validate → load`
```

## Options

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `model` | `string` | Pi default | Fallback model |
| `workerModel` | `string` | — | Model for node execution |
| `thinkingLevel` | `ThinkingLevel` | `'medium'` | Reasoning depth |
| `quiet` | `boolean` | `false` | Suppress output |
| `maxTokens` | `number` | `4096` | Max tokens per call |
| `system` | `string` | — | System prompt |
| `graph` | `{ nodes, edges }` | auto | Explicit graph definition |
| `separator` | `string` | `'→'` | Node separator in template |

## Graph Definition

```ts
interface GraphNode {
  id: string      // Unique identifier
  task: string    // Task description for this node
}

interface GraphEdge {
  from: string    // Source node (dependency)
  to: string      // Target node (depends on source)
}
```

## Output

```ts
class GraphOutput extends PatternOutput {
  text: string
  finalOutput: string                   // Result of sink node(s)
  nodeResults: GraphNodeResult[]        // All node outputs
  duration: number
}

class GraphNodeResult {
  nodeId: string
  task: string
  output: string
  success: boolean
}
```

## When to Use

- Complex workflows with explicit dependencies
- Data processing pipelines with branching
- Build/test/deploy pipelines with parallel stages
- Any workflow where you need fine-grained control over execution order
