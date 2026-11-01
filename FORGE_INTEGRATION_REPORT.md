# AUDITTRAIL AI v2.1.0 — FORGE INTEGRATION REPORT
**Platform:** Atlassian Forge (Remote Architecture)  
**Host Application:** Jira Cloud & Jira Service Management  
**Protocol:** Forge Invocation Token (FIT) over HTTPS  
**Frontend Architecture:** Custom UI (React 18 + Atlaskit Design System)  
**Date:** November 1, 2026  
**Status:** VALIDATED & COMPLIANT WITH ATLASSIAN SECURITY SPECIFICATIONS  

---

## 1. Architecture Overview

AuditTrail AI v2.1.0 integrates natively into Jira Cloud using the **Atlassian Forge Remote** architecture. Rather than executing within the constrained Forge Node.js runtime sandbox, backend computational workloads, high-volume transactional database operations, vector embeddings, and cryptographic hashing are securely offloaded to a dedicated Fastify remote backend.

Communication between the Forge App and the Remote Backend is cryptographically signed and verified using Atlassian Forge Invocation Tokens (FIT), ensuring zero-trust tenant authentication and strict request provenance.

---

## 2. Forge Manifest Configuration (`manifest.yml`)

The Forge application is defined in `manifest.yml` adhering strictly to Atlassian Forge platform specifications:

### 2.1 Manifest Modules
```yaml
modules:
  jira:globalPage:
    - key: audittrail-executive-dashboard
      title: AuditTrail AI eQMS
      resource: main
      resolver:
        function: resolver-fn
      route: audittrail-ai

  jira:projectPage:
    - key: audittrail-quality-project-view
      title: Quality & CAPA Workspace
      resource: main
      resolver:
        function: resolver-fn

  jira:issuePanel:
    - key: audittrail-investigation-panel
      title: Quality Investigation & RCA
      resource: main
      resolver:
        function: resolver-fn
      viewportSize: xlarge
```

### 2.2 Remote Endpoint Definition
```yaml
remotes:
  - key: audittrail-remote-backend
    baseUrl: https://api.audittrail-ai.internal.net
    operations:
      - compute

endpoints:
  - key: backend-api
    remote: audittrail-remote-backend
    route:
      path: /api/v1/*
    auth:
      appSystemToken:
        enabled: true
      forgeInvocationToken:
        enabled: true
```

### 2.3 Scopes & Permissions
Least-privilege OAuth scopes configured:
- `read:jira-work`: Read access to Jira issues representing quality events.
- `write:jira-work`: Update status and post regulatory containment comments.
- `storage:app`: Store lightweight tenant configuration in Forge K/V store.
- `external:fetch`: Connect directly to the verified remote backend URL.

---

## 3. Forge Invocation Token (FIT) Verification Middleware

To enforce zero-trust authentication on the remote backend, `src/middleware/fit-verifier.ts` validates every incoming HTTP request using the official Atlassian JSON Web Key Set (JWKS).

### 3.1 Cryptographic Verification Flow
1. **Extraction:** The middleware extracts the Bearer token from the `Authorization` header.
2. **JWKS Fetching & Caching:** Keys are dynamically resolved from `https://forge.atlassian.com/.well-known/jwks.json` using `jose.createRemoteJWKSet` with local memory caching.
3. **Claim Assertions:**
   - **Algorithm:** Enforces `RS256`.
   - **Issuer:** Must strictly match `forge/invocation-token`.
   - **Audience:** Must match `config.fitAudience` (`ari:cloud:ecosystem::app/audittrail-ai`).
   - **Expiration:** Verifies standard JWT `exp` validity with a maximum 60-second clock skew tolerance.
4. **Context Injection:** Extracts Atlassian context claims (`cloudId`, `installationId`, `principalId`, `siteUrl`) and binds them to `req.forgeContext`.

### 3.2 Tenant Association Pipeline
The Fastify middleware `src/middleware/tenant-context.ts` resolves the Atlassian `installationId` against the PostgreSQL `organizations` table:
- Looks up `installation_id = req.forgeContext.installationId`.
- Resolves the internal multi-tenant UUID `organization_id`.
- Employs an in-memory LRU cache with a 5-minute TTL to optimize high-frequency API invocations.
- Injects `req.tenantOrganizationId` into downstream route handlers.

---

## 4. UI Resource & Bridge Communication

The Custom UI bundle is compiled from `static/frontend` into `static/frontend/build` and served directly within Jira Cloud iframe containers.

### 4.1 Forge Bridge Invocations
Frontend screens communicate with the backend through `@forge/bridge`:
- `invoke('getForgeContext')`: Retrieves the active Jira workspace, current user ARI, and issue context.
- `requestJira(...)`: Interacts with Jira Cloud REST APIs directly from the client.
- `fetchRemote(...)`: Issues signed HTTP calls to `/api/v1/*` automatically accompanied by the Forge Invocation Token.

### 4.2 Local Development & Web Fallback Mode
When running outside the Jira iframe (e.g. during standalone testing or development), the frontend API client (`static/frontend/src/services/api.ts`) automatically falls back to standard REST headers (`x-tenant-id`), ensuring full functionality in automated testing suites.

---

## 5. Security & Isolation Testing Evidence

The FIT verification middleware was subjected to rigorous negative testing in `tests/fit-auth.test.ts`:

| Test Scenario | Input Condition | Expected Result | Actual Result | Status |
|---|---|---|---|---|
| **Missing Header** | No `Authorization` header | `401 Unauthorized` | `401 Unauthorized` | **PASS** |
| **Invalid Issuer** | JWT signed with issuer `attacker/fake-token` | `401 Unauthorized` | `401 Unauthorized` | **PASS** |
| **Wrong Audience** | JWT minted for another Atlassian app | `401 Unauthorized` | `401 Unauthorized` | **PASS** |
| **Expired Token** | JWT with `exp` set to past timestamp | `401 Unauthorized` | `401 Unauthorized` | **PASS** |

---
*Report certified by Principal Security Architect & Forge Ecosystem Specialist.*
