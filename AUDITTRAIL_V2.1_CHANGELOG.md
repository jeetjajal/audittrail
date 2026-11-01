# AUDITTRAIL AI — ARCHITECTURE VERSION 2.1.0 CHANGE LOG

**Release Date:** 2026-11-01  
**Baseline Version:** 2.0.0  
**Target Version:** 2.1.0  
**Classification:** Major Production Architecture & Security Revision  

---

## 1. Summary of Changes

Version 2.1.0 resolves 8 critical (P0) architectural, multi-tenant security, and regulatory compliance defects identified in the technical audit of Version 2.0.0. The architecture is now validated, mathematically reconciled, and implementation-ready.

---

## 2. Itemized Change Matrix

### 2.1 Table Inventory Reconciliation (AUD-01)
- **Previous Design:** Stated 34 tables in summary, 37 tables in module breakdown, and listed 6 tables under "New Tables (3)".
- **Problem:** Mathematical contradiction leading to deployment failure and inconsistent ORM definitions.
- **New Design:** Reconciled to exactly **38 tables** (37 functional tables + 1 dedicated concurrency sequence counter table).
- **Affected Modules:** All 11 modules.
- **Migration Impact:** 8 modular sequential SQL migration scripts (`001_extensions.sql` through `008_rls_and_security.sql`).

### 2.2 Composite Foreign Key Deletion Integrity (AUD-02)
- **Previous Design:** Composite foreign keys on child tables used `ON DELETE SET NULL`.
- **Problem:** When parent is deleted, PostgreSQL sets all composite FK columns to NULL, violating `organization_id NOT NULL` constraints and causing crash.
- **New Design:** Changed all business and audit foreign keys to `ON DELETE RESTRICT` or soft deletion. Tenant identifiers remain strictly immutable and non-null.
- **Affected Modules:** Module 3 (Incidents), Module 4 (RCA), Module 5 (CAPA), Module 7 (Approvals).

### 2.3 Concurrency-Safe Audit Hash Chaining (AUD-03)
- **Previous Design:** Genesis event read `SELECT ... FOR UPDATE` directly on `audit_events`.
- **Problem:** For $n=0$, 0 rows were locked. Concurrent initial requests caused sequence number collisions and broken hash chains.
- **New Design:** Introduced `audit_sequence_counters` table with auto-initialized per-tenant row on organization onboarding. Trigger executes atomic `SELECT ... FOR UPDATE` on this pre-seeded counter.
- **Affected Modules:** Module 9 (Tamper-Evident Audit Ledger).

### 2.4 RFC 8785 Canonical JSON Serialization (AUD-04)
- **Previous Design:** Concatenated `before_state::TEXT` and `after_state::TEXT`.
- **Problem:** PostgreSQL JSONB and Node.js `JSON.stringify()` serialize keys in different orders, causing hash mismatch between database triggers and backend verifiers.
- **New Design:** Standardized on RFC 8785 (JSON Canonicalization Scheme - JCS) across both PostgreSQL `fn_canonical_json_text()` and TypeScript `canonicalizeJson()`.
- **Affected Modules:** Module 9 (Audit Ledger), Backend Audit Service.

### 2.5 Official Atlassian Forge Remote FIT Authentication (AUD-05)
- **Previous Design:** Used invented issuer `https://forge.atlassian.com` and extracted `cloudId` from `payload.sub`.
- **Problem:** FIT validation would fail against real Atlassian Cloud tokens or improperly bind identities.
- **New Design:** Implemented official FIT validation: issuer `forge/invocation-token`, audience `config.forgeAppAri`, and JWKS validation against `https://forge.cdn.prod.atlassian-dev.net/.well-known/jwks.json`.
- **Affected Modules:** Forge Remote Gateway Middleware.

### 2.6 Vector Dimension & AI Model Standardization (AUD-06)
- **Previous Design:** Mentioned Google Gemini provider while configuring `vector(1536)` and OpenAI `text-embedding-3-small`.
- **Problem:** Google Vertex AI `text-embedding-004` produces 768-dimensional vectors, causing runtime SQL dimension mismatch.
- **New Design:** Standardized on Vertex AI `text-embedding-004` with `vector(768)` and HNSW Cosine distance indexing (`m=16, ef_construction=64`).
- **Affected Modules:** Module 8 (AI Intelligence & Vector Search).

### 2.7 FDA QMSR 2026 Harmonization (AUD-07)
- **Previous Design:** Cited legacy FDA 21 CFR §820.100 for CAPA.
- **Problem:** FDA finalized the Quality Management System Regulation (QMSR), which took effect February 2, 2026, replacing legacy §820 with ISO 13485:2016 alignment.
- **New Design:** Updated regulatory mapping to QMSR 21 CFR Part 820 / ISO 13485:2016 Clause 8.5.2 & 8.5.3.
- **Affected Modules:** Regulatory Traceability Matrix.

### 2.8 Medical Device Triad Consistency (AUD-08)
- **Previous Design:** `incident_devices` allowed arbitrary combinations of device, lot, and unit without joint validation.
- **Problem:** Unit from Lot B could be linked to Lot A and Model C, violating clinical device traceability.
- **New Design:** Enforced composite foreign key `(organization_id, device_id, lot_id, unit_id) REFERENCES device_units(...)`.
- **Affected Modules:** Module 2 (Device Catalog), Module 3 (Incidents).

### 2.9 CAPA Dependency Cycle Prevention (AUD-09)
- **Previous Design:** `capa_action_dependencies` allowed arbitrary DAG links without cycle checks.
- **Problem:** Cyclic dependencies ($A \to B \to A$) deadlocked CAPA action execution.
- **New Design:** Added PostgreSQL recursive trigger `fn_check_capa_dependency_cycle()` and backend validation to reject cyclic action graphs.
- **Affected Modules:** Module 5 (CAPA Management).

### 2.10 Document Version Linkage (AUD-10)
- **Previous Design:** `documents` had `current_version INTEGER` without foreign key to `document_versions`.
- **Problem:** Required inefficient subqueries to fetch active file metadata; risked orphaned versions.
- **New Design:** Added `current_version_id UUID` with composite FK to `document_versions(organization_id, id)`.
- **Affected Modules:** Module 6 (Documents & Evidence).

### 2.11 Connection Pooling Tenant Context Isolation (AUD-11)
- **Previous Design:** Relied on `SET LOCAL` without strict transaction boundary management.
- **Problem:** Reused pooled connections could leak tenant context across requests.
- **New Design:** Implemented `withTenantTransaction` wrapper guaranteeing `SET LOCAL` strictly within `BEGIN ... COMMIT/ROLLBACK` blocks.
- **Affected Modules:** Fastify Middleware, PostgreSQL Connection Management.
