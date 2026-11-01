# AUDITTRAIL AI v2.1.0 — PHASE 4: ATLASSIAN FORGE DEPLOYMENT GUIDE
**Platform:** Atlassian Forge Remote  
**Target:** Jira Cloud (Issue Panel, Global Page, Project Page)  
**Manifest:** `manifest.yml`  
**Frontend Bundle:** `static/frontend/build/` (React 18 + Atlaskit Custom UI)  
**Remote Backend:** Fastify 4.x + TypeScript + PostgreSQL 18.6  

---

## 1. PRE-DEPLOYMENT VERIFICATION CHECKLIST

- [x] Fastify Remote Backend compiles cleanly (`npm run build`).
- [x] React Custom UI bundled with esbuild into `static/frontend/build/bundle.js`.
- [x] `index.html` loads `<script src="./bundle.js"></script>`.
- [x] All 9 Jest test suites pass with 100% pass rate (47/47 tests).
- [x] Manifest defines `modules`, `remotes`, `endpoint`, `resources`, and `permissions`.
- [x] Root resolver entrypoint `index.js` points to `dist/index.run`.

---

## 2. ATLASSIAN FORGE CLI SETUP & DEPLOYMENT

### Step 1: Install Atlassian Forge CLI
```bash
npm install -g @forge/cli
forge --version
```

### Step 2: Authenticate with Atlassian Developer Account
```bash
forge login
# Enter your Atlassian API Token and Account Email
```

### Step 3: Verify Manifest Syntax
```bash
forge lint
```

### Step 4: Register App (First-Time Setup)
```bash
forge register --name "AuditTrail AI - Medical Device eQMS"
```

### Step 5: Deploy Frontend Custom UI & Manifest
```bash
# Deploy to development environment
forge deploy -e development

# (For production deployment)
# forge deploy -e production
```

### Step 6: Install onto Jira Cloud Site
```bash
forge install -e development
# Select 'Jira' and enter your development site domain: e.g., your-company.atlassian.net
```

---

## 3. REMOTE BACKEND CONNECTION (FASTIFY REMOTE)

### Option A: Local Development via Forge Tunnel
```bash
# In terminal 1: Start Fastify backend
npm run dev

# In terminal 2: Start Forge Tunnel
forge tunnel
```

### Option B: Production Cloud Remote Deployment
1. Deploy Fastify backend to your cloud provider (AWS ECS, Google Cloud Run, or Railway/Render) on HTTPS (e.g. `https://api.audittrail.ai`).
2. Ensure `manifest.yml` remotes point to the production URL:
```yaml
remotes:
  - key: audittrail-remote-backend
    baseUrl: https://api.audittrail.ai
    operations:
      - compute

permissions:
  external:
    fetch:
      backend:
        - https://api.audittrail.ai
```
3. Set environment variables on the remote server:
   - `DATABASE_URL`: Production PostgreSQL connection string.
   - `FORGE_APP_ID`: Your registered Forge App ID.
   - `FORGE_JWKS_URL`: `https://forge.cdn.prod.atlassian-dev.net/.well-known/jwks.json`.
   - `S3_WORM_BUCKET`: Your AWS S3 WORM bucket.
4. Run `forge deploy -e production` and `forge install -e production`.
