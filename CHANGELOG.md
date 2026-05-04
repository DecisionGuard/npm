# Changelog

## 0.4.1 (2026-05-04)

### Fixed

- **Fact-check timeout**: `factCheck()` now uses a minimum 120 s timeout (overridable via second `timeoutMs` arg) to prevent read timeouts during AI model calls

## 0.4.0 (2026-05-04)

### Breaking

- `review()` parameter `actorSource` replaced with `actor` object (`{ id, type?, authority_level?, source? }`) matching server schema
- Removed `_postBearer()` — all endpoints now use consistent `x-api-key` header

### Fixed

- **Auth header bug**: `review()` was sending `Authorization: Bearer` instead of `x-api-key`, causing 401 errors against the server's `requireApiKey` middleware
- **Missing `idempotency_key`**: `review()` now auto-generates `sdk-js-{uuid}` when not provided, preventing 400 validation errors on strict-mode tenants

### Changed

- `review()` sends `actor` as a structured object instead of flat `actor_source` string
- `idempotency_key` always included in review requests (auto-generated via `crypto.randomUUID()`)

## 0.3.5 (2026-05-04)

### Added

- `review()` — submit governance reviews via POST /api/v1/reviews
- `pollPendingApprovals()` — poll for pending approvals awaiting resolution
- `resolveApproval()` — approve or deny a pending approval with justification
- `enforceReviewVerdict()` — throw typed errors for BLOCK/REQUIRE_APPROVAL from review endpoint
- Default base URL (`https://decision-guard.com`) in `fromEnv()` — `DG_BASE_URL` is now optional
- New types: `ReviewRequest`, `ReviewResponse`, `PendingApproval`, `PendingApprovalsResponse`, `ResolveApprovalRequest`, `ResolveApprovalResponse`

## 0.1.0 (2025-05-02)

Initial release.

### Added

- `DecisionGuardClient` — full HTTP client with `audit`, `factCheck`, `autoAudit`, `listReviews`, `batchAudit`, `listResources`, `getIdentity`, `getReview`, `withTrace`
- `DGBlockedError` / `DGEscalatedError` / `DGError` — typed error classes
- `enforceVerdict()` — throw typed errors for non-ALLOW verdicts
- `DecisionGuardNode` — LangGraph state graph node with `invoke()` and `asNode()`
- `DGGuardedTool` + `guardTools()` — LangChain tool wrapper
- `createToolCallInterceptor` + `wrapOpenAIToolHandler` — OpenAI Agents SDK integration
- `auditWorkflowStep` + `auditOrFail` — generic CI/workflow helpers
- Dual CJS + ESM output with full TypeScript declarations
- Zero runtime dependencies — uses native `fetch` (Node 18+)
- Subpath exports: `decisionguard-sdk/langchain`, `/langgraph`, `/openai-agents`, `/workflow`
