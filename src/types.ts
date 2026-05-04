/** DecisionGuard SDK v0.3.0 — shared type definitions. */
export type ActorType = "agent" | "service" | "human" | "system";

export type FactCheckVerdict = "PASS" | "FAIL" | "WARN" | "INCOMPLETE";
export type DGVerdict = "ALLOW" | "BLOCK" | "REQUIRE_APPROVAL";
export type ClaimVerdict = "verified" | "disputed" | "unverifiable" | "missing_citation";
export type IssueType = "misinformation" | "inconsistency" | "error" | "incompleteness" | "unsupported_claim" | "logical_error" | "missing_citation";
export type IssueSeverity = "low" | "medium" | "high" | "critical";
export type CheckType = "misinformation" | "inconsistencies" | "errors" | "incompleteness" | "unsupported_claims" | "logical_errors" | "missing_citations";

export interface FactCheckRequest {
  content: string;
  context?: string;
  checks?: CheckType[];
  timezone?: string;
}

export interface FactCheckClaim {
  claim: string;
  verdict: ClaimVerdict;
  confidence: number;
  explanation: string;
  evidence?: string;
}

export interface FactCheckIssue {
  type: IssueType;
  severity: IssueSeverity;
  description: string;
  location?: string;
  suggestion?: string;
}

export interface FactCheckResponse {
  review_id: string;
  verdict: FactCheckVerdict;
  dg_verdict: DGVerdict;
  confidence: number;
  summary: string;
  claims: FactCheckClaim[];
  issues: FactCheckIssue[];
  warnings: string[];
  checks_performed: string[];
  model: string;
  metadata: {
    content_length: number;
    claim_count: number;
    issue_count: number;
    duration_ms: number;
  };
}

export type AuthorityLevel = "autonomous" | "supervised" | "restricted";
export type Environment = "production" | "staging" | "development" | "test";
export type Verdict = "ALLOW" | "BLOCK" | "CONDITIONAL" | "ESCALATE";
export type RiskTier = "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
export type Phase = "PLAN" | "EXECUTE";

export interface SecurityAuditRequest {
  actor: {
    id: string;
    type?: ActorType;
    source?: string;
    authority?: AuthorityLevel;
  };
  intent: {
    requested_goal: string;
    proposed_action: string;
    agent_confidence?: number;
  };
  environment?: Environment;
  tool: {
    name: string;
    operation: string;
    resource_name?: string;
    change_type?: string;
    params?: Record<string, unknown>;
    payload_summary?: string;
  };
  facts?: {
    has_sensitive_data?: boolean;
    data_classifications?: string[];
    risk_signals?: string[];
  };
  execution_scope?: {
    max_changes?: number;
    max_targets?: number;
    rollback_supported?: boolean;
    time_window_minutes?: number;
  };
  trace?: {
    trace_id?: string;
    parent_decision_id?: string;
  };
  idempotency_key?: string;
  phase?: Phase;
  correlation_key?: string;
  review_id?: string;
  execution_payload?: Record<string, unknown>;
  break_glass?: boolean;
  break_glass_reason?: string;
  previous_decision_id?: string;
  revision_reason?: string;
}

export interface AuditFacts {
  has_sensitive_data?: boolean;
  data_classifications?: string[];
  risk_signals?: string[];
}

export interface AutoAuditRequest {
  tool_name: string;
  action_summary: string;
  parameters?: Record<string, unknown>;
  trace_id?: string;
  parent_decision_id?: string;
  environment?: Environment;
  resource?: string;
}

export interface AutoAuditResponse {
  recorded: boolean;
  review_id: string;
  decision_id: string | null;
  trace_id: string | null;
  enforcement_mode: string;
  verdict: string;
  blocked?: boolean;
  reason?: string;
  resource_key?: string;
  authority_artifact?: Record<string, unknown>;
}

export interface ListReviewsFilters {
  limit?: number;
  actor_type?: ActorType;
  actor_authority?: AuthorityLevel;
  decision?: string;
  risk?: RiskTier;
  environment?: Environment;
  change_type?: string;
}

export interface CompactReview {
  review_id: string;
  status: string;
  created_at: string;
  actor_type?: string;
  verdict?: Record<string, unknown>;
}

export interface BatchAuditItem {
  actor: SecurityAuditRequest["actor"];
  intent: SecurityAuditRequest["intent"];
  environment?: Environment;
  tool: SecurityAuditRequest["tool"];
  facts?: AuditFacts;
  idempotency_key?: string;
}

export interface BatchAuditResultItem {
  index: number;
  status: "ok" | "error";
  review_id?: string;
  verdict?: string;
  error?: string;
}

export interface BatchAuditResponse {
  count: number;
  elapsed_ms: number;
  results: BatchAuditResultItem[];
}

export interface ResourceItem {
  key: string;
  name: string;
  resource_type: string;
  hub: string | null;
  hub_name: string | null;
  hub_connected: boolean;
  location: string | null;
  tags: string[];
  risk_tier: string;
  customer_tag: string | null;
}

export interface ListResourcesResponse {
  resources: ResourceItem[];
  total: number;
  usage: string;
}

export interface IdentitySnapshot {
  id: string;
  review_id: string;
  principal_id: string | null;
  assurance: string;
  confidence: number;
  verification_status: string;
  warnings: string[];
  claims_hash: string | null;
  actor: Record<string, unknown> | null;
  created_at: string;
}

export interface IdentityResponse {
  identity: IdentitySnapshot | null;
  message?: string;
}

export interface ReviewRequest {
  change_type: string;
  change_payload: Record<string, unknown>;
  environment?: Environment | string;
  intent?: { goal: string; proposed_action: string };
  resource_name?: string;
  actor_source?: string;
  idempotency_key?: string;
}

export interface ReviewResponse {
  data: {
    review_id: string;
    verdict: {
      decision: string;
      summary?: string;
      conditions?: string[];
    };
    [key: string]: unknown;
  };
  [key: string]: unknown;
}

export interface PendingApproval {
  id: string;
  review_id: string;
  status: string;
  requested_at: string;
  [key: string]: unknown;
}

export interface PendingApprovalsResponse {
  approvals: PendingApproval[];
  count: number;
}

export interface ResolveApprovalRequest {
  approved: boolean;
  justification: string;
  actor: {
    system: string;
    external_id: string;
    name?: string;
  };
  conditions?: string[];
  precedent?: boolean;
  break_glass?: boolean;
}

export interface ResolveApprovalResponse {
  status: string;
  approval_id: string;
  [key: string]: unknown;
}

export interface SecurityAuditResponse {
  trace_id: string;
  decision_id: string;
  review_id: string;
  verdict: Verdict;
  risk: {
    tier: RiskTier;
    score?: number;
    confidence?: number;
  };
  summary: string;
  required_controls: string[];
  conditions: string[];
  artifacts: Array<{
    id: string;
    type: string;
    hash?: string;
    expires_at?: string;
  }>;
  governance_codes: string[];
  framework_mappings?: Record<string, string[]>;
  links?: {
    trace_url?: string;
    review_url?: string;
    audit_package_url?: string;
  };
  idempotent_hit: boolean;
  execution_time_ms: number;
}
