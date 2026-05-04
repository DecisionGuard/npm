/** DecisionGuard SDK v0.3.5 — CI/workflow pipeline helpers. */
import type { SecurityAuditRequest, SecurityAuditResponse } from "./types.js";
import { DecisionGuardClient, enforceVerdict, DGBlockedError, DGEscalatedError } from "./dg-client.js";

export interface WorkflowStepInput {
  actor_id: string;
  actor_type?: "agent" | "service" | "human" | "system";
  tool_name: string;
  operation: string;
  params?: Record<string, unknown>;
  environment?: "production" | "staging" | "development" | "test";
  requested_goal?: string;
  proposed_action?: string;
  resource_name?: string;
  change_type?: string;
  payload_summary?: string;
  idempotency_key?: string;
  data_classifications?: string[];
  risk_signals?: string[];
  trace_id?: string;
  parent_decision_id?: string;
}

export interface WorkflowAuditResult {
  allowed: boolean;
  verdict: string;
  decision_id: string;
  trace_id: string;
  conditions: string[];
  required_controls: string[];
  summary: string;
  response: SecurityAuditResponse;
}

export async function auditWorkflowStep(
  client: DecisionGuardClient,
  input: WorkflowStepInput,
): Promise<WorkflowAuditResult> {
  const request: SecurityAuditRequest = {
    actor: {
      id: input.actor_id,
      type: input.actor_type ?? "service",
      authority: "supervised",
    },
    intent: {
      requested_goal: input.requested_goal ?? `Execute ${input.tool_name}`,
      proposed_action: input.proposed_action ?? `${input.tool_name}.${input.operation}`,
      agent_confidence: 0.5,
    },
    environment: input.environment ?? "production",
    tool: {
      name: input.tool_name,
      operation: input.operation,
      resource_name: input.resource_name,
      change_type: input.change_type,
      params: input.params ?? {},
      payload_summary: input.payload_summary,
    },
    idempotency_key: input.idempotency_key,
  };

  if (input.data_classifications || input.risk_signals) {
    request.facts = {
      has_sensitive_data: (input.data_classifications?.length ?? 0) > 0,
      data_classifications: input.data_classifications,
      risk_signals: input.risk_signals,
    };
  }

  if (input.trace_id || input.parent_decision_id) {
    request.trace = {
      trace_id: input.trace_id,
      parent_decision_id: input.parent_decision_id,
    };
  }

  const response = await client.audit(request);

  try {
    enforceVerdict(response);
  } catch (err) {
    if (err instanceof DGBlockedError || err instanceof DGEscalatedError) {
      return {
        allowed: false,
        verdict: response.verdict,
        decision_id: response.decision_id,
        trace_id: response.trace_id,
        conditions: response.conditions,
        required_controls: response.required_controls,
        summary: response.summary,
        response,
      };
    }
    throw err;
  }

  return {
    allowed: true,
    verdict: response.verdict,
    decision_id: response.decision_id,
    trace_id: response.trace_id,
    conditions: response.conditions,
    required_controls: response.required_controls,
    summary: response.summary,
    response,
  };
}

export async function auditOrFail(
  client: DecisionGuardClient,
  input: WorkflowStepInput,
): Promise<SecurityAuditResponse> {
  const request: SecurityAuditRequest = {
    actor: {
      id: input.actor_id,
      type: input.actor_type ?? "service",
      authority: "supervised",
    },
    intent: {
      requested_goal: input.requested_goal ?? `Execute ${input.tool_name}`,
      proposed_action: input.proposed_action ?? `${input.tool_name}.${input.operation}`,
      agent_confidence: 0.5,
    },
    environment: input.environment ?? "production",
    tool: {
      name: input.tool_name,
      operation: input.operation,
      resource_name: input.resource_name,
      change_type: input.change_type,
      params: input.params ?? {},
      payload_summary: input.payload_summary,
    },
    idempotency_key: input.idempotency_key,
  };

  if (input.trace_id || input.parent_decision_id) {
    request.trace = {
      trace_id: input.trace_id,
      parent_decision_id: input.parent_decision_id,
    };
  }

  const response = await client.audit(request);
  enforceVerdict(response);
  return response;
}
