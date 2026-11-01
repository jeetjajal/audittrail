# AUDITTRAIL AI — AI AGENT OPERATIONAL GUIDELINES

## Project Overview
AuditTrail AI v2.1.0 is an AI-assisted Electronic Quality Management System (eQMS) for Medical Device Manufacturers.
Host platform: Atlassian Forge Remote (Jira Cloud).
Backend: Fastify 4.x + TypeScript + PostgreSQL 18.6 with Row-Level Security (RLS).
Frontend: React 18 + Atlaskit Custom UI.

## Mandatory Git & Continuous Push Workflow
Every AI agent working on this codebase must strictly follow the rules in [GIT_WORKFLOW.md](GIT_WORKFLOW.md):

1. **Continuous Push on Task Completion:**
   Whenever a development task is assigned (feature, bug fix, UI change, schema adjustment, API route, or documentation):
   - Complete the implementation.
   - Run tests (`npm test`) and builds (`npm run build`). Ensure 100% pass rate.
   - Stage the intended, safe project files.
   - Commit with a clear semantic message.
   - Automatically push to `origin main` before concluding the turn.
   - Do NOT wait for the user to prompt "push to GitHub".

2. **Security & Secrets:**
   - Never commit `.env` or files containing database passwords, private keys, or API tokens.
   - Keep `.gitignore` updated and clean.

3. **Regulatory Integrity:**
   - Preserve 21 CFR Part 11, ISO 13485:2016, and FDA QMSR compliance standards across all changes.
   - Never mock or fabricate test results.
