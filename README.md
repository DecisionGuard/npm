# decisionguard-sdk

Runtime governance for AI agents in TypeScript/JavaScript. Intercept tool calls before execution and get an ALLOW / BLOCK / CONDITIONAL / ESCALATE verdict from DecisionGuard.

[![npm version](https://badge.fury.io/js/decisionguard-sdk.svg)](https://www.npmjs.com/package/decisionguard-sdk)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.0%2B-blue)](https://www.typescriptlang.org/)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

## Install

```bash
npm install decisionguard-sdk
# or
pnpm add decisionguard-sdk
```

No runtime dependencies. Uses the native `fetch` API (Node 18+).

## Quick start

```ts
import { DecisionGuardClient, DGBlockedError } from "decisionguard-sdk";

const client = DecisionGuardClient.fromEnv();
// Reads DG_API_KEY and DG_BASE_URL from process.env

const response = await client.audit({
  actor: { id: "my-agent", type: "agent", authority: "supervised" },
  intent: {
    requested_goal: "Deploy updated service to production",
    proposed_action: "helm upgrade my-service --set image.tag=v2.1.0",
  },
  environment: "production",
  tool: {
    name: "helm",
    operation: "upgrade",
    resource_name: "my-service",
    change_type: "infrastructure",
  },
});

console.log(response.verdict);  // ALLOW | BLOCK | CONDITIONAL | ESCALATE
console.log(response.summary);
```

## Adding facts to an audit

The `facts` field signals what kind of data is in play so DecisionGuard can apply the right sensitivity rules:

```ts
const response = await client.audit({
  actor: { id: "my-agent", type: "agent", authority: "supervised" },
  intent: {
    requested_goal: "Export user records to CSV",
    proposed_action: "db.export({ table: 'users' })",
  },
  environment: "production",
  tool: { name: "db", operation: "export" },
  facts: {
    has_sensitive_data: true,
    data_classifications: ["PII", "financial"],
    risk_signals: ["bulk_export", "cross_border_transfer"],
  },
});
```

## Governance reviews

Submit a governance review and enforce the verdict:

```ts
import { DecisionGuardClient, enforceReviewVerdict } from "decisionguard-sdk";

const client = DecisionGuardClient.fromEnv();

const result = await client.review({
  changeType: "agentic_action",
  changePayload: {
    tool_name: "database",
    summary: "Drop staging table",
    params: { table: "stg_users" },
  },
  environment: "staging",
  resourceName: "staging-db",
});

enforceReviewVerdict(result);  // throws on BLOCK or REQUIRE_APPROVAL
```

## Approval polling and resolution

```ts
const pending = await client.pollPendingApprovals();

for (const approval of pending.approvals) {
  const resolved = await client.resolveApproval(approval.id, {
    approved: true,
    justification: "Reviewed and approved by ops team",
    actorSystem: "slack-bot",
    actorExternalId: "U12345",
    actorName: "Jane Doe",
  });
}
```

## LangGraph

`DecisionGuardNode` drops into any LangGraph state graph as a governance checkpoint:

```ts
import { StateGraph } from "@langchain/langgraph";
import { DecisionGuardClient, DecisionGuardNode } from "decisionguard-sdk";

const client = DecisionGuardClient.fromEnv();

const dgNode = new DecisionGuardNode(client, {
  agentId: "my-agent",
  environment: "production",
  requestedGoal: "Process and store customer records",
  extractActions: (state) => [{
    tool_name: state.plannedTool as string,
    operation: state.operation as string,
    params: state.params as Record<string, unknown>,
    change_type: "data",
  }],
});

const graph = new StateGraph(...)
  .addNode("dg-check", dgNode.asNode())   // ← drops in here
  .addNode("execute", executeNode)
  .addEdge("dg-check", "execute")
  ...
```

## LangChain

Wrap any tool so DecisionGuard is consulted before every call:

```ts
import { DecisionGuardClient, DGGuardedTool, guardTools } from "decisionguard-sdk";

const client = DecisionGuardClient.fromEnv();

// Wrap a single tool
const guarded = new DGGuardedTool(myTool, {
  client,
  agentId: "my-langchain-agent",
  environment: "production",
  facts: {
    has_sensitive_data: true,
    data_classifications: ["PII"],
    risk_signals: [],
  },
});

// Or wrap an entire array at once
const guardedTools = guardTools([tool1, tool2, tool3], {
  client,
  agentId: "my-agent",
  environment: "production",
});
```

## OpenAI Agents SDK

```ts
import { DecisionGuardClient, wrapOpenAIToolHandler } from "decisionguard-sdk";

const client = DecisionGuardClient.fromEnv();

const guardedHandler = wrapOpenAIToolHandler(
  { client, onBlocked: (err) => console.error("Blocked:", err.response.summary) },
  "my-agent",
  "send_email",
  async (args) => {
    // your tool logic here
  },
);
```

## Fact-checking

```ts
const result = await client.factCheck({
  content: "The EU AI Act was signed into law in 2023 and applies to all AI systems globally.",
  context: "Legal compliance review",
  checks: ["misinformation", "errors", "unsupported_claims"],
});

console.log(result.verdict);     // PASS | FAIL | WARN | INCOMPLETE
console.log(result.dg_verdict);  // ALLOW | BLOCK | REQUIRE_APPROVAL
console.log(result.summary);
```

## Auto-audit (observe-only)

```ts
await client.autoAudit({
  tool_name: "vector_search",
  action_summary: "Semantic search over customer embeddings",
  parameters: { query: "refund policy", top_k: 5 },
  environment: "production",
  resource: "customer-vectors",
});
```

## List reviews

```ts
const reviews = await client.listReviews({
  limit: 20,
  decision: "BLOCK",
  environment: "production",
});
```

## Batch audit

```ts
const result = await client.batchAudit([
  {
    actor: { id: "agent-1", type: "agent", authority: "supervised" },
    intent: { requested_goal: "Read logs", proposed_action: "tail /var/log/app.log" },
    environment: "production",
    tool: { name: "bash", operation: "read" },
  },
  {
    actor: { id: "agent-2", type: "agent", authority: "autonomous" },
    intent: { requested_goal: "Send alert", proposed_action: "slack.post(...)" },
    environment: "production",
    tool: { name: "slack", operation: "post" },
  },
]);
```

## Tracing multi-step workflows

```ts
const tracedClient = client.withTrace("trace-abc-123");
await tracedClient.audit({ ... });
await tracedClient.audit({ ... });
```

## CI / workflow pipelines

```ts
import { DecisionGuardClient, auditWorkflowStep, auditOrFail } from "decisionguard-sdk";

const client = DecisionGuardClient.fromEnv();

// Returns a result object — you decide what to do with it
const result = await auditWorkflowStep(client, {
  actor_id: "ci-pipeline",
  tool_name: "helm",
  operation: "upgrade",
  environment: "production",
  requested_goal: "Deploy v3 to production",
  change_type: "infrastructure",
});

if (!result.allowed) {
  console.error("Deployment blocked:", result.summary);
  process.exit(1);
}

// Or throw on non-ALLOW
await auditOrFail(client, {
  actor_id: "ci-pipeline",
  tool_name: "helm",
  operation: "upgrade",
  environment: "production",
});
```

## Error handling

```ts
import { DGBlockedError, DGEscalatedError, enforceVerdict } from "decisionguard-sdk";

try {
  enforceVerdict(response);
} catch (err) {
  if (err instanceof DGBlockedError) {
    console.error("Blocked:", err.response.summary);
  }
  if (err instanceof DGEscalatedError) {
    console.warn("Needs human approval:", err.response.summary);
    console.warn("Review at:", err.response.links?.review_url);
  }
}
```

## Environment variables

| Variable | Required | Description |
|---|---|---|
| `DG_API_KEY` | Yes | Your tenant API key |
| `DG_BASE_URL` | No | API base URL (default: `https://decision-guard.com`) |

## Links

- [DecisionGuard dashboard](https://decision-guard.com/app)
- [API documentation](https://decision-guard.com/docs)
- [GitHub repository](https://github.com/DecisionGuard/npm)
