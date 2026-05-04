# Changelog

## 0.3.5 (2026-05-04)

### Added
- `review()` — submit governance reviews via POST /api/v1/reviews
- `pollPendingApprovals()` — poll for pending approvals awaiting resolution
- `resolveApproval()` — approve or deny a pending approval with justification
- `enforceReviewVerdict()` — throw typed errors for BLOCK/REQUIRE_APPROVAL from review endpoint
- Default base URL (`https://decision-guard.com`) in `fromEnv()` — `DG_BASE_URL` is now optional
- New types: `ReviewRequest`, `ReviewResponse`, `PendingApproval`, `PendingApprovalsResponse`, `ResolveApprovalRequest`, `ResolveApprovalResponse`

### Fixed
- Auth header for review endpoint uses `Authorization: Bearer` (matching server expectations)

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
