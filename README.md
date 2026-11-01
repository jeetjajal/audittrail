# AuditTrail AI — AI-Powered Quality Investigation & Audit Management System (eQMS)
**Version:** 2.1.0  
**Target Domain:** Medical Device Manufacturing  
**Regulatory Standards:** FDA QMSR (2026), 21 CFR Part 11, ISO 13485:2016, ISO 14971:2019  
**Platform Architecture:** Atlassian Forge Remote (Jira Cloud) + Node.js/Fastify Backend + PostgreSQL 18 + React 18 Custom UI  

---

## Overview

AuditTrail AI is an enterprise-grade Electronic Quality Management System (eQMS) specifically engineered for medical device manufacturers. It automates and enforces strict regulatory compliance workflows across non-conformance incident intake, root cause analysis (RCA), CAPA management with Directed Acyclic Graph (DAG) dependencies, 21 CFR Part 11 electronic signatures, and tamper-evident cryptographic audit logging.

---

## Key Modules & Features

1. **Incident Intake & Clinical Traceability:**
   - Class I, II, and III device categorization with UDI (Unique Device Identifier) and production batch traceability.
   - Severity triage (`CRITICAL`, `MAJOR`, `MINOR`) and automated containment logging per SOP-QA-402.

2. **Quality Investigation & Root Cause Analysis:**
   - Multi-methodology workspace: 5 Whys visual builder, Ishikawa 6M Fishbone diagram, and Fault Tree Analysis.
   - AI-assisted hypothesis generation with mandatory non-binding badges and human-in-the-loop verification telemetry.

3. **CAPA Management & Action Dependency DAG:**
   - Corrective and Preventive Action tracking with strict DAG prerequisites preventing out-of-sequence execution.
   - Regulatory closure gates enforcing complete action verification and quantitative effectiveness review.

4. **Controlled Evidence & S3 WORM Storage:**
   - Controlled document versioning with SHA-256 cryptographic checksums.
   - Integration with AWS S3 Object Lock (WORM compliance mode) for 10-year immutable record retention.

5. **21 CFR Part 11 Electronic Signatures:**
   - Multi-stage approval workflows with dual-factor re-authentication, signer identity, timestamp, and meaning of signature.

6. **Tamper-Evident Cryptographic Audit Ledger:**
   - Append-only audit events chained via SHA-256 hashes ($H_n = \text{SHA-256}(H_{n-1} \parallel n \parallel \text{payload})$).
   - Dedicated per-tenant sequence counters eliminating concurrency race conditions.

---

## Architecture Stack

| Layer | Technology |
|---|---|
| **Host Application** | Jira Cloud & Jira Service Management (Atlassian Forge Remote) |
| **Authentication** | Atlassian Forge Invocation Tokens (FIT) over RS256 with dynamic JWKS validation |
| **Backend Framework** | Node.js / TypeScript with Fastify 4.28 |
| **Database Engine** | PostgreSQL 18.6 with multi-tenant Row-Level Security (RLS) under unprivileged role `audittrail_app` |
| **Vector Engine** | `pgvector` with automated fallback to native `REAL[]` cosine similarity |
| **Frontend UI** | React 18 + TypeScript + Atlassian Design System (Atlaskit) Custom UI |

---

## Directory Structure

```
F:\codegeist\
├── manifest.yml               # Atlassian Forge App Manifest (Remote Architecture)
├── package.json               # Backend dependencies and test scripts
├── tsconfig.json              # TypeScript configuration
├── .gitignore                 # Strict secrets and build artifact exclusions
├── .env.example               # Safe environment variable template
├── sql/                       # 9 Production SQL Migrations & Verification Scripts
│   ├── 001_extensions.sql
│   ├── 002_core_schema.sql
│   ├── 003_device_traceability.sql
│   ├── 004_quality_modules.sql
│   ├── 005_evidence_approvals.sql
│   ├── 006_ai_and_analytics.sql
│   ├── 007_audit_ledger.sql
│   ├── 008_rls_and_security.sql
│   ├── 009_seed_data.sql
│   └── validate_database.sql
├── src/                       # Backend Microservice Source Code
│   ├── config.ts              # Configuration validation
│   ├── index.ts               # Forge UI resolver handlers
│   ├── server.ts              # Fastify server bootstrap & route registration
│   ├── middleware/            # FIT authentication & Tenant RLS context
│   ├── routes/                # 8 REST route controllers
│   └── services/              # Audit, CAPA, and Vector services
├── static/frontend/           # React 18 Custom UI (14 Screens)
│   ├── package.json
│   ├── tsconfig.json
│   ├── public/
│   └── src/                   # Screens, Components, and API bridge
├── tests/                     # 7 Automated Jest Test Suites (31 Tests, 100% Pass)
└── *.md                       # Comprehensive Architecture & Integration Reports
```

---

## Running Locally & Testing

### 1. Prerequisites
- Node.js v20.x or v22.x
- PostgreSQL 18.x

### 2. Setup Environment
```bash
cp .env.example .env
# Edit .env with your local PostgreSQL credentials for audittrail_app
```

### 3. Install & Build
```bash
# Install backend dependencies
npm install

# Compile backend TypeScript
npm run build

# Install frontend dependencies and verify compilation
cd static/frontend && npm install && npm run build && cd ../..
```

### 4. Run Automated Tests
```bash
npm test
```
*Current test suite: 7 test suites, 31 tests passed (100% success rate).*

---

## Documentation Deliverables

- [BACKEND_INTEGRATION_REPORT.md](BACKEND_INTEGRATION_REPORT.md)
- [FORGE_INTEGRATION_REPORT.md](FORGE_INTEGRATION_REPORT.md)
- [API_DOCUMENTATION.md](API_DOCUMENTATION.md)
- [UI_IMPLEMENTATION_REPORT.md](UI_IMPLEMENTATION_REPORT.md)
- [END_TO_END_TEST_REPORT.md](END_TO_END_TEST_REPORT.md)
- [DEPLOYMENT_GUIDE.md](DEPLOYMENT_GUIDE.md)
- [DATABASE_VALIDATION_REPORT.md](DATABASE_VALIDATION_REPORT.md)
- [GIT_WORKFLOW.md](GIT_WORKFLOW.md)

---
*License: Proprietary — All rights reserved.*
