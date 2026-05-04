/** DecisionGuard SDK v0.3.0 — runtime governance client for TypeScript/JavaScript. */
import type {
  SecurityAuditRequest,
  SecurityAuditResponse,
  FactCheckRequest,
  FactCheckResponse,
  AutoAuditRequest,
  AutoAuditResponse,
  ListReviewsFilters,
  CompactReview,
  BatchAuditItem,
  BatchAuditResponse,
  ListResourcesResponse,
  IdentityResponse,
  ReviewRequest,
  ReviewResponse,
  PendingApprovalsResponse,
  ResolveApprovalResponse,
} from "./types.js";

export interface DGClientConfig {
  apiKey: string;
  baseUrl: string;
  timeout?: number;
  traceId?: string;
  parentDecisionId?: string;
}

export class DecisionGuardClient {
  private apiKey: string;
  private baseUrl: string;
  private timeout: number;
  private traceId?: string;
  private parentDecisionId?: string;

  constructor(config: DGClientConfig) {
    this.apiKey = config.apiKey;
    this.baseUrl = config.baseUrl.replace(/\/$/, "");
    this.timeout = config.timeout ?? 30_000;
    this.traceId = config.traceId;
    this.parentDecisionId = config.parentDecisionId;
  }

  static fromEnv(overrides?: Partial<DGClientConfig>): DecisionGuardClient {
    const apiKey = overrides?.apiKey ?? process.env.DG_API_KEY;
    const baseUrl = overrides?.baseUrl ?? process.env.DG_BASE_URL ?? "https://decision-guard.com";
    if (!apiKey) throw new Error("DG_API_KEY is required");
    return new DecisionGuardClient({ apiKey, baseUrl, ...overrides });
  }

  async audit(request: SecurityAuditRequest): Promise<SecurityAuditResponse> {
    const body = { ...request };
    if (this.traceId || this.parentDecisionId) {
      body.trace = {
        trace_id: body.trace?.trace_id ?? this.traceId,
        parent_decision_id: body.trace?.parent_decision_id ?? this.parentDecisionId,
      };
    }
    return this._post<SecurityAuditResponse>("/api/v1/skills/security-audit", body);
  }

  async factCheck(input: FactCheckRequest): Promise<FactCheckResponse> {
    return this._post<FactCheckResponse>("/api/v1/fact-check", input);
  }

  async getReview(reviewId: string): Promise<Record<string, unknown>> {
    return this._get<Record<string, unknown>>(`/api/v1/reviews/${reviewId}`);
  }

  async autoAudit(input: AutoAuditRequest): Promise<AutoAuditResponse> {
    return this._post<AutoAuditResponse>("/api/v1/auto-audit", input);
  }

  async listReviews(filters: ListReviewsFilters = {}): Promise<CompactReview[]> {
    const params = new URLSearchParams();
    if (filters.limit) params.set("limit", String(filters.limit));
    if (filters.actor_type) params.set("actor_type", filters.actor_type);
    if (filters.actor_authority) params.set("actor_authority", filters.actor_authority);
    if (filters.decision) params.set("decision", filters.decision);
    if (filters.risk) params.set("risk", filters.risk);
    if (filters.environment) params.set("environment", filters.environment);
    if (filters.change_type) params.set("change_type", filters.change_type);
    const qs = params.toString();
    return this._get<CompactReview[]>(`/api/v1/reviews${qs ? `?${qs}` : ""}`);
  }

  async batchAudit(reviews: BatchAuditItem[]): Promise<BatchAuditResponse> {
    return this._post<BatchAuditResponse>("/api/v1/reviews/batch", { reviews });
  }

  async listResources(filters: { tag?: string; resource_type?: string } = {}): Promise<ListResourcesResponse> {
    const params = new URLSearchParams();
    if (filters.tag) params.set("tag", filters.tag);
    if (filters.resource_type) params.set("resource_type", filters.resource_type);
    const qs = params.toString();
    return this._get<ListResourcesResponse>(`/api/v1/resources${qs ? `?${qs}` : ""}`);
  }

  async getIdentity(reviewId: string): Promise<IdentityResponse> {
    return this._get<IdentityResponse>(`/api/v1/reviews/${reviewId}/identity`);
  }

  async review(input: {
    changeType: string;
    changePayload: Record<string, unknown>;
    environment?: string;
    intent?: { goal: string; proposedAction: string };
    resourceName?: string;
    actorSource?: string;
    idempotencyKey?: string;
  }): Promise<ReviewResponse> {
    const body: Record<string, unknown> = {
      change_type: input.changeType,
      change_payload: input.changePayload,
      environment: input.environment ?? "production",
    };
    if (input.intent) {
      body.intent = { goal: input.intent.goal, proposed_action: input.intent.proposedAction };
    }
    if (input.resourceName) body.resource_name = input.resourceName;
    if (input.actorSource) body.actor_source = input.actorSource;
    if (input.idempotencyKey) body.idempotency_key = input.idempotencyKey;
    return this._postBearer<ReviewResponse>("/api/v1/reviews", body);
  }

  async pollPendingApprovals(since?: string): Promise<PendingApprovalsResponse> {
    const params = new URLSearchParams();
    if (since) params.set("since", since);
    const qs = params.toString();
    return this._get<PendingApprovalsResponse>(`/api/v1/approvals/pending${qs ? `?${qs}` : ""}`);
  }

  async resolveApproval(
    approvalId: string,
    options: {
      approved: boolean;
      justification: string;
      actorSystem?: string;
      actorExternalId?: string;
      actorName?: string;
      conditions?: string[];
      precedent?: boolean;
      breakGlass?: boolean;
    },
  ): Promise<ResolveApprovalResponse> {
    const body: Record<string, unknown> = {
      approved: options.approved,
      justification: options.justification,
      actor: {
        system: options.actorSystem ?? "node-sdk",
        external_id: options.actorExternalId ?? "sdk-user",
        ...(options.actorName ? { name: options.actorName } : {}),
      },
    };
    if (options.conditions) body.conditions = options.conditions;
    if (options.precedent) body.precedent = true;
    if (options.breakGlass) body.break_glass = true;
    return this._post<ResolveApprovalResponse>(`/api/v1/approvals/${approvalId}/resolve`, body);
  }

  private async _postBearer<T>(path: string, body: unknown): Promise<T> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeout);
    try {
      const res = await fetch(`${this.baseUrl}${path}`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "Authorization": `Bearer ${this.apiKey}` },
        body: JSON.stringify(body),
        signal: controller.signal,
      });
      if (!res.ok) {
        const text = await res.text().catch(() => "");
        throw new DGError(`DecisionGuard returned ${res.status}: ${text}`, res.status);
      }
      return (await res.json()) as T;
    } finally {
      clearTimeout(timer);
    }
  }

  private async _post<T>(path: string, body: unknown): Promise<T> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeout);
    try {
      const res = await fetch(`${this.baseUrl}${path}`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-api-key": this.apiKey },
        body: JSON.stringify(body),
        signal: controller.signal,
      });
      if (!res.ok) {
        const text = await res.text().catch(() => "");
        throw new DGError(`DecisionGuard returned ${res.status}: ${text}`, res.status);
      }
      return (await res.json()) as T;
    } finally {
      clearTimeout(timer);
    }
  }

  private async _get<T>(path: string): Promise<T> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeout);
    try {
      const res = await fetch(`${this.baseUrl}${path}`, {
        headers: { "x-api-key": this.apiKey },
        signal: controller.signal,
      });
      if (!res.ok) {
        const text = await res.text().catch(() => "");
        throw new DGError(`DecisionGuard returned ${res.status}: ${text}`, res.status);
      }
      return (await res.json()) as T;
    } finally {
      clearTimeout(timer);
    }
  }

  withTrace(traceId: string, parentDecisionId?: string): DecisionGuardClient {
    return new DecisionGuardClient({
      apiKey: this.apiKey,
      baseUrl: this.baseUrl,
      timeout: this.timeout,
      traceId,
      parentDecisionId,
    });
  }
}

export class DGError extends Error {
  constructor(message: string, public statusCode: number) {
    super(message);
    this.name = "DGError";
  }
}

export class DGBlockedError extends Error {
  constructor(public response: SecurityAuditResponse) {
    super(`DecisionGuard blocked action: ${response.summary}`);
    this.name = "DGBlockedError";
  }
}

export class DGEscalatedError extends Error {
  constructor(public response: SecurityAuditResponse) {
    super(`DecisionGuard escalated action: ${response.summary}`);
    this.name = "DGEscalatedError";
  }
}

export function enforceReviewVerdict(response: ReviewResponse): ReviewResponse {
  const data = response.data ?? response;
  const verdictObj = data.verdict;
  const decision = typeof verdictObj === "object" && verdictObj !== null
    ? (verdictObj as Record<string, unknown>).decision ?? "BLOCK"
    : String(verdictObj);
  if (decision === "ALLOW" || decision === "ALLOW_WITH_CONDITIONS") return response;
  const summary = typeof verdictObj === "object" && verdictObj !== null
    ? String((verdictObj as Record<string, unknown>).summary ?? "")
    : "";
  if (decision === "REQUIRE_APPROVAL") {
    throw new DGEscalatedError({
      decision,
      review_id: data.review_id,
      summary,
      verdict: decision,
      conditions: [],
      required_controls: [],
      artifacts: [],
      governance_codes: [],
      idempotent_hit: false,
      execution_time_ms: 0,
      risk: { tier: "HIGH" as const },
      trace_id: "",
      decision_id: "",
    } as unknown as SecurityAuditResponse);
  }
  throw new DGBlockedError({
    decision,
    review_id: data.review_id,
    summary,
    verdict: decision,
    conditions: [],
    required_controls: [],
    artifacts: [],
    governance_codes: [],
    idempotent_hit: false,
    execution_time_ms: 0,
    risk: { tier: "CRITICAL" as const },
    trace_id: "",
    decision_id: "",
  } as unknown as SecurityAuditResponse);
}

export function enforceVerdict(response: SecurityAuditResponse): SecurityAuditResponse {
  switch (response.verdict) {
    case "ALLOW":
      return response;
    case "CONDITIONAL":
      return response;
    case "ESCALATE":
      throw new DGEscalatedError(response);
    case "BLOCK":
      throw new DGBlockedError(response);
    default:
      throw new DGBlockedError(response);
  }
}
