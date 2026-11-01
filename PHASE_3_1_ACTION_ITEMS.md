# AUDITTRAIL AI v2.1.0 — PHASE 3.1 ACTION ITEMS & ROADMAP
**Generated Date:** 2026-11-01  
**Project:** AuditTrail AI v2.1.0  
**Phase:** 3.1 Application Integration Audit  

---

## 1. COMPLETED & RESOLVED ACTION ITEMS (PHASE 3.1)

| Item Code | Description | Component | Resolution / Evidence | Status |
|-----------|-------------|-----------|------------------------|--------|
| **ACT-01** | Replace flawed `SET LOCAL` queries in GET routes | `src/routes/*.ts` | Replaced all with `withTenantTransaction(orgId, ...)` | **RESOLVED** |
| **ACT-02** | Align device and unit column names | `src/routes/incidents.ts` | Aliased `model_number as device_model`, `current_status as current_quarantine_status` | **RESOLVED** |
| **ACT-03** | Provide health probe alias for frontend | `src/routes/health.ts` | Added `GET /api/v1/health` matching `GET /health` | **RESOLVED** |
| **ACT-04** | Connect Approval Center to live API | `ApprovalCenter.tsx` | Added `useEffect` with `ApiClient.getPendingApprovals()` | **RESOLVED** |
| **ACT-05** | Connect Evidence Center to live API | `EvidenceCenter.tsx` | Added `ApiClient.createDocument()` call in upload handler | **RESOLVED** |
| **ACT-06** | Connect RCA Studio to live API | `RootCauseAnalysis.tsx` | Added `ApiClient.addFiveWhys/addFishbone/addRootCause` | **RESOLVED** |
| **ACT-07** | Automated E2E verification test suite | `tests/business-workflow-e2e.test.ts` | Created Jest wrapper ensuring full test suite runs in CI | **RESOLVED** |
| **ACT-08** | Full TypeScript type check passes 100% | Frontend & Backend | Both `npm run build` and `tsc (frontend)` exit with 0 errors | **RESOLVED** |

---

## 2. PENDING ACTION ITEMS FOR FUTURE PHASES (PHASE 4 DEPLOYMENT)

| Item Code | Target Component | Task Description | Prerequisite | Priority |
|-----------|------------------|------------------|--------------|----------|
| **ACT-09** | Cloud Deployment | Provision AWS S3 bucket with Object Lock compliance mode (`compliance-records-worm`) | AWS IAM Credentials | Medium |
| **ACT-10** | Cloud Deployment | Configure Google Cloud Vertex AI service account for live text embeddings (`text-embedding-004`) | GCP Project ID & SA Key | Medium |
| **ACT-11** | Atlassian Forge | Run `forge register` and `forge deploy` to link Jira Cloud tenant instance | Atlassian Developer Account | High |
| **ACT-12** | Atlaskit Theme | Bundle static frontend production assets into `static/frontend/build` | `npm run build` in static frontend | Low |
