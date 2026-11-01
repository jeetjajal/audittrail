# AUDITTRAIL AI — VERSION 2.0.0 TECHNICAL AUDIT REPORT

**Date:** 2026-11-01  
**Auditor:** Principal Enterprise Architect & Senior Database Security Engineer  
**Baseline Document:** `audittrail_final_master_architecture.md` (v2.0.0)  
**Target:** Version 2.1.0 Production Architecture Specification  

---

## 1. Executive Summary of Audit Findings

The Version 2.0.0 architecture provided an excellent conceptual foundation for an AI-assisted Medical Device eQMS. However, an exhaustive technical audit has revealed **eight critical (P0) architectural, security, and data integrity defects**, along with multiple high-priority (P1) inconsistencies that must be resolved prior to production readiness.

The most severe findings include:
1. **Mathematical Table Count Discrepancy:** The text claimed 34 tables, but the module inventory defined 37 tables, and the "New Tables" section listed 6 tables while declaring 3.
2. **Composite Foreign Key Deletion Traps:** Child tables using composite foreign keys with `ON DELETE SET NULL` violate `NOT NULL` constraints on `organization_id`, causing deletion crashes.
3. **Audit Hash-Chain Concurrency Failure:** The genesis event locking strategy (`SELECT ... FOR UPDATE` when zero rows exist) fails under concurrent initial requests, leading to sequence collisions and broken hash chains.
4. **Canonical JSON Inconsistency:** Differences between PostgreSQL `jsonb::TEXT` and JavaScript `JSON.stringify()` serialization guarantee that hash verification will diverge between backend code and database triggers.
5. **Forge Invocation Token (FIT) Specification Mismatch:** The authentication middleware utilized an invented issuer (`https://forge.atlassian.com` instead of official `forge/invocation-token`), extracted `cloudId` from `payload.sub` (which is user account ID), and lacked validation for installation context.
6. **Vector Dimension Contradiction:** Stated use of Google Gemini while declaring `vector(1536)` and `text-embedding-3-small` (an OpenAI model). Google Vertex AI's `text-embedding-004` produces 768-dimensional vectors, which cannot be stored in a 1536-dim column.
7. **FDA QMSR 2026 Regulatory Obsolescence:** Referenced legacy 21 CFR §820.100 without acknowledging the FDA's finalized **Quality Management System Regulation (QMSR)**, which took effect February 2, 2026, harmonizing with ISO 13485:2016.
8. **Unconstrained Medical Device Relational Triad:** `incident_devices` allowed mismatched device, lot, and unit combinations due to lack of multi-column composite integrity constraints.

---

## 2. Comprehensive Audit Matrix

| Defect ID | Severity | Module / Component | Identified Problem in v2.0 | Technical & Compliance Impact | Required Correction in v2.1 | Validation Method |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **AUD-01** | **P0** | **Schema Inventory** | Inconsistent table count: Document claimed 34 tables, module breakdown summed to 37 tables, text stated "New Tables (3)" while listing 6. | Confusion in deployment scripts, partial migrations, incomplete entity mapping. | Establish formal 38-table reconciled inventory (adding `audit_sequence_counters` to fix concurrency). | Automated migration table count assertion in integration test. |
| **AUD-02** | **P0** | **Multi-Tenancy (FKs)** | Composite FKs used `ON DELETE SET NULL` on nullable child attributes, which attempts to set `organization_id` to NULL. | Deleting a parent entity triggers runtime SQL error `null value in column "organization_id" violates not-null constraint`. | Change deletion behavior to `ON DELETE RESTRICT` or soft deletion. Tenant IDs must remain immutable and non-null. | SQL integration test attempting delete on parent with composite FK child. |
| **AUD-03** | **P0** | **Audit Hash Chain** | Trigger used `SELECT ... FOR UPDATE` on `audit_events`. For genesis events ($n=0$), 0 rows are locked. | Concurrent first events both read NULL, both assign sequence 1, causing unique constraint crash or broken chain. | Implement dedicated `audit_sequence_counters` table with pre-seeded tenant row locked via `FOR UPDATE`. | Concurrency test with 10 parallel transactions executing simultaneous genesis events. |
| **AUD-04** | **P0** | **Audit Hash Chain** | Simple string concatenation with `before_state::TEXT`. JSON key ordering differs between Postgres JSONB and Node.js. | Hashes generated in SQL triggers will not match hashes verified or recomputed in TypeScript. | Implement RFC 8785 (JSON Canonicalization Scheme - JCS) in both SQL and Node.js. | Test vector suite verifying exact identical SHA-256 hashes for complex JSON states. |
| **AUD-05** | **P0** | **Forge Remote Security** | FIT validation used wrong issuer (`https://forge.atlassian.com`) and read `cloudId` from `payload.sub`. | Authentication bypass or complete failure to authenticate valid Forge Remote requests. | Implement official FIT verification: issuer `forge/invocation-token`, verify `context.cloudId` and `installationId`. | Security test using forged and legitimately signed FIT JWTs. |
| **AUD-06** | **P0** | **AI / Vector Search** | Mixed OpenAI `text-embedding-3-small` (1536 dim) with Google Gemini provider, stored in `vector(1536)`. | Runtime dimension mismatch error if Vertex AI `text-embedding-004` (768 dim) is used. | Standardize on Vertex AI `text-embedding-004` with `vector(768)` and HNSW cosine distance index. | Integration test inserting and querying 768-dim embeddings with HNSW cosine search. |
| **AUD-07** | **P1** | **Regulatory Mapping** | Cited legacy FDA 21 CFR §820.100 for CAPA without QMSR 2026 harmonization. | Audit failure during FDA inspection post-Feb 2, 2026 (FDA QMSR alignment with ISO 13485:2016). | Update traceability to QMSR 21 CFR Part 820 / ISO 13485:2016 Clause 8.5.2 & 8.5.3. | Regulatory compliance review by QMS Lead Auditor. |
| **AUD-08** | **P0** | **Device Consistency** | `incident_devices` allowed a device unit from Lot B to be associated with Lot A and Device C. | Broken device traceability in clinical non-conformance reports; severe FDA warning letter risk. | Enforce composite foreign key `(organization_id, device_id, lot_id, unit_id)` referencing `device_units`. | SQL test inserting mismatched unit/lot/device combinations expecting FK violation. |
| **AUD-09** | **P1** | **CAPA Engine** | `capa_action_dependencies` lacked circular dependency protection ($A \to B \to A$). | Deadlock in CAPA action execution; actions cannot be completed, blocking CAPA closure. | Implement recursive CTE check in database trigger and Fastify DAG validation to reject cycles. | Unit test inserting cyclic dependencies ($A \to B \to C \to A$) expecting rejection. |
| **AUD-10** | **P1** | **Document Versioning**| `documents` table had `current_version INTEGER` but no foreign key to `document_versions(id)`. | Inability to join active document version metadata without secondary subqueries; potential orphaned versions. | Add `current_version_id UUID` with composite FK to `document_versions(organization_id, id)`. | SQL schema verification and migration test. |
| **AUD-11** | **P1** | **RLS Leakage** | `SET LOCAL` was proposed, but without connection pool transaction guards, connections could leak tenant state. | Cross-tenant data leakage if connection is reused without resetting or outside transaction. | Fastify connection wrapper guaranteeing `SET LOCAL` inside `BEGIN ... COMMIT` with explicit `DISCARD ALL` fallback. | Negative multi-tenant concurrent test suite. |

---

## 3. Approved Action Plan for Version 2.1.0

1. **Reconciled Schema DDL:** Modularize into 8 sequential SQL migration scripts with 38 verified tables.
2. **Dedicated Concurrency Table:** Introduce `audit_sequence_counters` with row-level locking for atomic monotonically increasing sequences per tenant.
3. **JCS Hash Canonicalization:** Standardize RFC 8785 byte-level serialization in both SQL functions and TypeScript services.
4. **Official Forge Remote FIT Middleware:** Fastify middleware with JWKS signature check, audience, issuer, and installation mapping.
5. **Unified Embedding Architecture:** Standardize on Vertex AI `text-embedding-004` with native 768-dimension vectors.
6. **Regulatory Harmonization:** Map all quality requirements to FDA QMSR (Feb 2, 2026) and ISO 13485:2016.
