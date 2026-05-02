import type { SecurityAuditRequest } from "./types.js";
import { DecisionGuardClient, enforceVerdict, DGBlockedError, DGEscalatedError } from "./dg-client.js";

export interface ToolCallInfo {
  tool_name: string;
  operation: string;
  params: Record<string, unknown>;
  agent_id: string;
  agent_confidence?: number;
  requested_goal?: string;
  proposed_action?: string;
  resource_name?: string;
  change_type?: string;
  environment?: "production" | "staging" | "development" | "test";
}

export interface InterceptorConfig {
  client: DecisionGuardClient;
  defaultEnvironment?: "production" | "staging" | "development" | "test";
  onBlocked?: (error: DGBlockedError) => void;
  onEscalated?: (error: DGEscalatedError) => void;
  onConditional?: (conditions: string[]) => void;
}

export function createToolCallInterceptor(config: InterceptorConfig) {
  const { client, defaultEnvironment = "production" } = config;

  return async function auditBeforeExecution(
    info: ToolCallInfo,
    executeTool: () => Promise<unknown>,
  ): Promise<unknown> {
    const request: SecurityAuditRequest = {
      actor: {
        id: info.agent_id,
        type: "agent",
        authority: "supervised",
      },
      intent: {
        requested_goal: info.requested_goal ?? `Execute ${info.tool_name}`,
        proposed_action: info.proposed_action ?? `${info.tool_name}.${info.operation}`,
        agent_confidence: info.agent_confidence ?? 0.5,
      },
      environment: info.environment ?? defaultEnvironment,
      tool: {
        name: info.tool_name,
        operation: info.operation,
        resource_name: info.resource_name,
        change_type: info.change_type,
        params: info.params,
      },
    };

    const response = await client.audit(request);

    try {
      enforceVerdict(response);
    } catch (err) {
      if (err instanceof DGBlockedError) {
        config.onBlocked?.(err);
        throw err;
      }
      if (err instanceof DGEscalatedError) {
        config.onEscalated?.(err);
        throw err;
      }
      throw err;
    }

    if (response.verdict === "CONDITIONAL" && response.conditions.length > 0) {
      config.onConditional?.(response.conditions);
    }

    return executeTool();
  };
}

export function wrapOpenAIToolHandler(
  config: InterceptorConfig,
  agentId: string,
  toolName: string,
  handler: (args: Record<string, unknown>) => Promise<unknown>,
) {
  const interceptor = createToolCallInterceptor(config);

  return async (args: Record<string, unknown>): Promise<unknown> => {
    return interceptor(
      {
        tool_name: toolName,
        operation: "execute",
        params: args,
        agent_id: agentId,
      },
      () => handler(args),
    );
  };
}
