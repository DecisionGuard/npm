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
    const baseUrl = overrides?.baseUrl ?? process.env.DG_BASE_URL;
    if (!apiKey) throw new Error("DG_API_KEY is required");
    if (!baseUrl) throw new Error("DG_BASE_URL is required");
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
