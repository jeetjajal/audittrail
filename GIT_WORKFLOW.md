# AUDITTRAIL AI — PERMANENT GIT & CONTINUOUS PUSH WORKFLOW
**Target Repository:** `https://github.com/jeetjajal/audittrail`  
**Primary Branch:** `main`  
**Standard:** Automated Continuous Synchronization on Task Completion  

---

## 1. Golden Development Rule

> **Whenever development work is requested (features, bug fixes, UI improvements, API updates, schema migrations, documentation, or refactoring):**
> **Complete the task, run builds and tests to validate, and then automatically commit and push the completed changes to GitHub in the same response turn.**
>
> *Do not wait for the user to separately prompt "push to GitHub".*

---

## 2. Mandatory 12-Step Git Workflow

For **every** development session or feature task on AuditTrail AI, the agent and developer must strictly adhere to this sequence:

1. **Check Status & Branch:**  
   Always verify the working tree state and active branch:  
   `git status` and `git branch --show-current`
2. **Synchronize Remote State:**  
   Fetch latest changes before starting local modifications:  
   `git fetch origin` and `git pull --rebase origin main` (if remote contains new commits).
3. **Preserve Baseline Code:**  
   Work directly on the existing codebase without rewriting working modules from scratch or deleting established architecture.
4. **Implement Task:**  
   Develop the requested feature, endpoint, UI screen, bug fix, or regulatory schema adjustment cleanly.
5. **Execute Validation Checks:**  
   Verify that all builds and tests pass prior to staging:  
   - Backend TypeScript build: `npm run build`
   - Frontend TypeScript check: `npx tsc --project static/frontend/tsconfig.json`
   - Automated Jest test suites: `npm test` (all tests must pass 100%)
6. **Review Full Diff:**  
   Inspect the complete working diff to catch unintended edits or whitespace anomalies:  
   `git diff`
7. **Secrets & Hygiene Audit:**  
   Ensure no credentials, `.env` files, API keys, database dumps, or `node_modules` are staged. Confirm `.gitignore` coverage.
8. **Stage Intended Files:**  
   Stage only the safe, modified, and newly created project files:  
   `git add <files>`
9. **Verify Staged Content:**  
   Inspect staged changes:  
   `git diff --cached --stat`
10. **Create Semantic Commit:**  
    Create a clear, meaningful commit message following conventional commits (e.g. `feat:`, `fix:`, `docs:`, `test:`, `refactor:`):  
    `git commit -m "feat: description of task completed"`
11. **Push to Upstream Branch:**  
    Push the commit to GitHub without force-pushing:  
    `git push origin main`
12. **Verify Push & Report Outcome:**  
    Verify `git status` reports a clean working tree and provide the user with the commit hash, modified files, and push confirmation.

---

## 3. Strict Safety & Regulatory Guardrails

- **Never Force Push:** Do not use `git push --force` or `git reset --hard` on public/shared branches.
- **Never Commit Secrets:** Real passwords, private tokens, AWS credentials, and Vertex/Gemini keys must never be committed. `.env` is permanently ignored; only `.env.example` with placeholders is tracked.
- **Never Push Broken Builds:** If tests or TypeScript compilation fail, do not push an unsafe state. Fix the issue first or report the blocker immediately.
- **No File-Per-Commit Noise:** Do not commit after every file edit. Commit and push once upon completion and validation of each logical task.

---
*Maintained under AuditTrail AI Engineering Governance.*
