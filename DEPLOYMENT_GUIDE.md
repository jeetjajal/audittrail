# AUDITTRAIL AI v2.1.0 — PRODUCTION DEPLOYMENT GUIDE
**AI-Powered Quality Investigation & Audit Management System**  
**Compliance Standards:** 21 CFR Part 11, ISO 13485:2016, FDA QMSR (2026 Ready)  
**Platform Architecture:** Atlassian Forge Remote + Node.js/Fastify Backend + PostgreSQL 18  
**Date:** November 1, 2026  

---

## 1. System Requirements & Prerequisites

### 1.1 Compute & Runtime Environment
- **Node.js:** v20.x LTS or v22.x LTS
- **Package Manager:** npm v10.x or higher
- **Operating System:** Ubuntu 22.04 LTS / 24.04 LTS (recommended for production) or Windows Server 2022
- **Memory & CPU:** Minimum 4 vCPU, 8 GB RAM for Remote Backend container

### 1.2 Database Engine
- **PostgreSQL:** Version 18.x (or 16.x / 17.x with equivalent capabilities)
- **Required Extensions:**
  - `uuid-ossp` or `pgcrypto`
  - `pgvector` (optional; native TypeScript cosine fallback automatically engages if unavailable)

### 1.3 Atlassian Forge Tooling
- Atlassian Forge CLI (`npm install -g @forge/cli`)
- Verified Atlassian Developer Account with Jira Cloud Site Admin privileges

---

## 2. PostgreSQL 18 Database Setup & Hardening

### 2.1 Database Roles Setup
In accordance with least-privilege security principles, production applications must never connect as a PostgreSQL superuser.

Connect as `postgres` superuser and execute:
```sql
-- 1. Create development/production database
CREATE DATABASE audittrail_prod;

-- 2. Create unprivileged application role
CREATE ROLE audittrail_app WITH LOGIN PASSWORD 'STRONG_PRODUCTION_PASSWORD_HERE' NOSUPERUSER NOCREATEDB NOCREATEROLE;

-- 3. Grant schema permissions to application role
\c audittrail_prod
GRANT USAGE, CREATE ON SCHEMA public TO audittrail_app;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO audittrail_app;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT USAGE, SELECT ON SEQUENCES TO audittrail_app;
```

### 2.2 Migration Execution Order
Execute the 9 migration scripts sequentially against the production database:
```bash
# Set PostgreSQL connection variables
export PGDATABASE=audittrail_prod
export PGUSER=postgres

# Execute migrations in exact dependency order
psql -f sql/001_extensions.sql
psql -f sql/002_core_schema.sql
psql -f sql/003_device_traceability.sql
psql -f sql/004_quality_modules.sql
psql -f sql/005_evidence_approvals.sql
psql -f sql/006_ai_and_analytics.sql
psql -f sql/007_audit_ledger.sql
psql -f sql/008_rls_and_security.sql
psql -f sql/009_seed_data.sql          # Optional for staging/UAT
```

### 2.3 Verify RLS and Table Count
Verify that all 38 tables and RLS policies are active:
```bash
psql -f sql/validate_database.sql
```

---

## 3. Remote Backend Configuration & Deployment

### 3.1 Environment Variables Configuration
Create a secure `.env` file on the remote backend host (e.g. `/etc/audittrail/production.env`):
```ini
# Server Settings
NODE_ENV=production
PORT=3000
HOST=0.0.0.0

# Database Connection (Unprivileged audittrail_app role)
DATABASE_URL=postgres://audittrail_app:STRONG_PRODUCTION_PASSWORD_HERE@pg-cluster.internal:5432/audittrail_prod

# Forge Authentication
FIT_AUDIENCE=ari:cloud:ecosystem::app/audittrail-ai
JWKS_CACHE_TTL_MS=86400000

# Controlled Evidence & S3 WORM Storage
S3_WORM_BUCKET_NAME=audittrail-regulatory-vault
S3_WORM_REGION=us-east-1
S3_OBJECT_LOCK_RETENTION_YEARS=10

# AI Service Configuration (Optional Gemini / Claude keys)
AI_PROVIDER=gemini
GEMINI_API_KEY=YOUR_GEMINI_API_KEY
```

### 3.2 Build and Run the Backend
```bash
# Install dependencies
npm ci --production=false

# Compile TypeScript
npm run build

# Start production server
NODE_ENV=production node dist/server.js
```

### 3.3 Containerized Deployment (Dockerfile Example)
```dockerfile
FROM node:20-alpine AS builder
WORKDIR /app
COPY package*.json tsconfig.json ./
RUN npm ci
COPY src ./src
RUN npm run build

FROM node:20-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --omit=dev
COPY --from=builder /app/dist ./dist
ENV NODE_ENV=production
USER node
EXPOSE 3000
CMD ["node", "dist/server.js"]
```

---

## 4. Atlassian Forge App Deployment

### 4.1 Build Custom UI Assets
The Custom UI single-page application must be compiled before deployment:
```bash
cd static/frontend
npm ci
npm run build
cd ../..
```
Verify that `static/frontend/build/index.html` exists.

### 4.2 Register Forge App
If this is the first deployment:
```bash
forge register --name "AuditTrail AI eQMS"
```

### 4.3 Update Remote URL in `manifest.yml`
Ensure `manifest.yml` points to your public, TLS-enabled backend endpoint:
```yaml
remotes:
  - key: audittrail-remote-backend
    baseUrl: https://api.audittrail-ai.yourcompany.com
    operations:
      - compute
```

### 4.4 Deploy and Install to Jira Cloud
```bash
# 1. Deploy Forge manifest and Custom UI bundle to production environment
forge deploy --environment production

# 2. Install application into your target Jira Cloud site
forge install --site your-company.atlassian.net --product jira --environment production
```

---

## 5. AWS S3 WORM Object Lock & Hourly Anchor Service

To satisfy 21 CFR Part 11 §11.10(c) and ISO 13485:2016 §4.2.5 (protection of records against alteration and deletion):

### 5.1 S3 Bucket Configuration
1. Create an AWS S3 bucket with **Object Lock enabled in Compliance Mode**.
2. Set default retention duration to matching organization policy (e.g., 10 years).
3. Block all public access.

### 5.2 Hourly Ledger Anchor Cron Job
Configure an automated cron job or Kubernetes CronJob executing hourly:
```bash
# Hourly Merkle root computation and S3 WORM export
0 * * * * node -e "require('./dist/services/audit-service').AuditService.anchorTenantLedgers()" >> /var/log/audittrail-anchor.log 2>&1
```

---

## 6. Disaster Recovery & 21 CFR Part 11 Validation

### 6.1 Database Backup Strategy
- **Continuous Archiving:** PostgreSQL Write-Ahead Log (WAL) archiving enabled with Point-in-Time Recovery (PITR) retention of 30 days.
- **Daily Physical Backups:** Automated `pg_dump` with encryption at rest (AES-256).

### 6.2 Audit Trail Integrity Verification Check
Execute the integrity verification utility to ensure zero corruption or tampering:
```bash
# Query the live audit verification endpoint
curl -X GET https://api.audittrail-ai.yourcompany.com/api/v1/audit/verify \
  -H "Authorization: Bearer <FIT_OR_ADMIN_JWT>" \
  -H "x-tenant-id: a1b2c3d4-e5f6-7a8b-9c0d-1e2f3a4b5c6d"
```
Ensure response returns `{"isValid": true}`.

---
*Certified Production Deployment Guide.*
