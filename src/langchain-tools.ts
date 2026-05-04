/** DecisionGuard SDK v0.3.5 — LangChain tool wrapper. */
import type { SecurityAuditRequest, AuditFacts } from "./types.js";
import { DecisionGuardClient, enforceVerdict, DGBlockedError, DGEscalatedError } from "./dg-client.js";

export interface BaseTool {
  name: string;
  description: string;
  invoke(input: unknown): Promise<unknown>;
}

export interface DGGuardedToolConfig {
  client: DecisionGuardClient;
  agentId: string;
  environment?: "production" | "staging" | "development" | "test";
  operation?: string;
  changeType?: string;
  requestedGoal?: string;
  facts?: AuditFacts;
}

export class DGGuardedTool implements BaseTool {
  name: string;
  description: string;
  private inner: BaseTool;
  private client: DecisionGuardClient;
  private agentId: string;
  private environment: "production" | "staging" | "development" | "test";
  private operation: string;
  private changeType?: string;
  private requestedGoal?: string;
  private facts?: AuditFacts;

  constructor(innerTool: BaseTool, config: DGGuardedToolConfig) {
    this.inner = innerTool;
    this.name = innerTool.name;
    this.description = innerTool.description;
    this.client = config.client;
    this.agentId = config.agentId;
    this.environment = config.environment ?? "production";
    this.operation = config.operation ?? "execute";
    this.changeType = config.changeType;
    this.requestedGoal = config.requestedGoal;
    this.facts = config.facts;
  }

  async invoke(input: unknown): Promise<unknown> {
    const params = typeof input === "object" && input !== null
      ? (input as Record<string, unknown>)
      : { input };

    const request: SecurityAuditRequest = {
      actor: {
        id: this.agentId,
        type: "agent",
        authority: "supervised",
      },
      intent: {
        requested_goal: this.requestedGoal ?? `Use tool ${this.name}`,
        proposed_action: `${this.name}.${this.operation}`,
        agent_confidence: 0.5,
      },
      environment: this.environment,
      tool: {
        name: this.name,
        operation: this.operation,
        change_type: this.changeType,
        params,
      },
      ...(this.facts && { facts: this.facts }),
    };

    const response = await this.client.audit(request);
    enforceVerdict(response);

    return this.inner.invoke(input);
  }
}

export function guardTools(
  tools: BaseTool[],
  config: DGGuardedToolConfig,
): DGGuardedTool[] {
  return tools.map((tool) => new DGGuardedTool(tool, config));
}
