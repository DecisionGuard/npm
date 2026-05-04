/** DecisionGuard SDK v0.3.5 — public API surface. */
export type {
  SecurityAuditRequest,
  SecurityAuditResponse,
  ActorType,
  AuthorityLevel,
  Environment,
  Verdict,
  RiskTier,
  Phase,
  AuditFacts,
  FactCheckRequest,
  FactCheckResponse,
  FactCheckClaim,
  FactCheckIssue,
  FactCheckVerdict,
  DGVerdict,
  CheckType,
  ClaimVerdict,
  IssueType,
  IssueSeverity,
  AutoAuditRequest,
  AutoAuditResponse,
  ListReviewsFilters,
  CompactReview,
  BatchAuditItem,
  BatchAuditResultItem,
  BatchAuditResponse,
  ResourceItem,
  ListResourcesResponse,
  IdentitySnapshot,
  IdentityResponse,
  ReviewRequest,
  ReviewResponse,
  PendingApproval,
  PendingApprovalsResponse,
  ResolveApprovalRequest,
  ResolveApprovalResponse,
} from "./types.js";

export {
  DecisionGuardClient,
  DGError,
  DGBlockedError,
  DGEscalatedError,
  enforceVerdict,
  enforceReviewVerdict,
} from "./dg-client.js";
export type { DGClientConfig } from "./dg-client.js";

export { DGGuardedTool, guardTools } from "./langchain-tools.js";
export type { BaseTool, DGGuardedToolConfig } from "./langchain-tools.js";

export { DecisionGuardNode, createAuditNode } from "./langgraph-node.js";
export type { PlannedAction, DecisionGuardNodeConfig, AuditNodeConfig } from "./langgraph-node.js";

export { createToolCallInterceptor, wrapOpenAIToolHandler } from "./openai-agents.js";
export type { ToolCallInfo, InterceptorConfig } from "./openai-agents.js";

export { auditWorkflowStep, auditOrFail } from "./workflow-wrapper.js";
export type { WorkflowStepInput, WorkflowAuditResult } from "./workflow-wrapper.js";
