/** DecisionGuard SDK v0.3.5 — LangGraph state graph node. */
import type { SecurityAuditRequest, SecurityAuditResponse, AuditFacts } from "./types.js";
import { DecisionGuardClient, enforceVerdict } from "./dg-client.js";

export interface PlannedAction {
  tool_name: string;
  operation: string;
  params: Record<string, unknown>;
  resource_name?: string;
  change_type?: string;
  payload_summary?: string;
  facts?: AuditFacts;
}

export interface DecisionGuardNodeConfig {
  agentId: string;
  environment?: "production" | "staging" | "development" | "test";
  requestedGoal?: string;
  agentConfidence?: number;
  facts?: AuditFacts;
  extractActions: (state: Record<string, unknown>) => PlannedAction[];
  onAuditComplete?: (
    state: Record<string, unknown>,
    responses: SecurityAuditResponse[]
  ) => Record<string, unknown>;
}

export class DecisionGuardNode {
  private client: DecisionGuardClient;
  private agentId: string;
  private environment: "production" | "staging" | "development" | "test";
  private requestedGoal?: string;
  private agentConfidence: number;
  private facts?: AuditFacts;
  private extractActions: (state: Record<string, unknown>) => PlannedAction[];
  private onAuditComplete?: (
    state: Record<string, unknown>,
    responses: SecurityAuditResponse[]
  ) => Record<string, unknown>;

  constructor(client: DecisionGuardClient, config: DecisionGuardNodeConfig) {
    this.client = client;
    this.agentId = config.agentId;
    this.environment = config.environment ?? "production";
    this.requestedGoal = config.requestedGoal;
    this.agentConfidence = config.agentConfidence ?? 0.5;
    this.facts = config.facts;
    this.extractActions = config.extractActions;
    this.onAuditComplete = config.onAuditComplete;
  }

  async invoke(
    state: Record<string, unknown>
  ): Promise<Record<string, unknown>> {
    const actions = this.extractActions(state);
    const responses: SecurityAuditResponse[] = [];

    for (const action of actions) {
      const effectiveFacts = action.facts ?? this.facts;
      const request: SecurityAuditRequest = {
        actor: {
          id: this.agentId,
          type: "agent",
          authority: "supervised",
        },
        intent: {
          requested_goal:
            this.requestedGoal ??
            `Execute planned action ${action.tool_name}`,
          proposed_action: `${action.tool_name}.${action.operation}`,
          agent_confidence: this.agentConfidence,
        },
        environment: this.environment,
        tool: {
          name: action.tool_name,
          operation: action.operation,
          resource_name: action.resource_name,
          change_type: action.change_type,
          params: action.params,
          payload_summary: action.payload_summary,
        },
        ...(effectiveFacts && { facts: effectiveFacts }),
      };

      const response = await this.client.audit(request);
      enforceVerdict(response);
      responses.push(response);
    }

    if (this.onAuditComplete) {
      return this.onAuditComplete(state, responses);
    }

    return {
      ...state,
      dg_audit_results: responses,
      dg_audit_passed: true,
    };
  }

  asNode(): (state: Record<string, unknown>) => Promise<Record<string, unknown>> {
    return (state) => this.invoke(state);
  }
}

/** @deprecated Use `new DecisionGuardNode(client, config)` instead. */
export interface AuditNodeConfig extends DecisionGuardNodeConfig {
  client: DecisionGuardClient;
}

/** @deprecated Use `new DecisionGuardNode(client, config).asNode()` instead. */
export function createAuditNode(config: AuditNodeConfig) {
  const node = new DecisionGuardNode(config.client, config);
  return node.asNode();
}
