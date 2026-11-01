# AUDITTRAIL AI v2.1.0 — API DOCUMENTATION
**AI-Powered Quality Investigation & Audit Management System**  
**Protocol:** RESTful HTTPS / JSON  
**Authentication:** Atlassian Forge Invocation Token (FIT) or Bearer JWT  
**Multi-Tenancy:** Automated via `x-tenant-id` or FIT installation claim with PostgreSQL RLS  
**Date:** November 1, 2026  

---

## 1. Global Conventions

### 1.1 Base URL
All API routes are prefixed under `/api/v1/`, with container health endpoints hosted at root level.

### 1.2 Authentication Headers
- In production Forge Remote:
  `Authorization: Bearer <ForgeInvocationToken>`
- In local development / test mode:
  `x-tenant-id: <UUID>`

### 1.3 Standard Response Format
All success responses return HTTP `200 OK` or `201 Created` with a root data payload or collection.
Errors return an RFC 7807 compliant error format:
```json
{
  "error": "ERROR_CODE",
  "message": "Human readable error description",
  "details": {}
}
```

---

## 2. Health & Diagnostic Endpoints

### GET `/health`
- **Description:** Basic liveness probe.
- **Auth:** Public.
- **Response (200):**
  ```json
  {
    "status": "UP",
    "service": "audittrail-ai-backend",
    "version": "2.1.0",
    "timestamp": "2026-11-01T12:00:00.000Z"
  }
  ```

### GET `/health/ready`
- **Description:** Verifies database connectivity and pool health.
- **Auth:** Public.
- **Response (200):**
  ```json
  {
    "status": "UP",
    "database": "CONNECTED",
    "pool": { "totalConnections": 20, "idleConnections": 19, "waitingCount": 0 }
  }
  ```

### GET `/api/v1/health/database`
- **Description:** Returns PostgreSQL operational metadata.
- **Auth:** Authenticated.
- **Response (200):**
  ```json
  {
    "status": "UP",
    "postgresVersion": "PostgreSQL 18.6",
    "databaseName": "audittrail_dev",
    "tableCount": 38,
    "rlsEnabled": true
  }
  ```

---

## 3. Incident Management Module

### POST `/api/v1/incidents`
- **Description:** Records a new quality incident / non-conformance event.
- **Regulatory Trigger:** Automatically writes an append-only audit event in `audit_events`.
- **Request Body:**
  ```json
  {
    "incidentNumber": "INC-2026-0091",
    "title": "Alaris Infusion Pump IV Flow Rate Deviation",
    "description": "Flow rate exceeded tolerance during clinical operation",
    "severity": "CRITICAL",
    "source": "CLINICAL",
    "deviceId": "d1000000-0000-0000-0000-000000000001",
    "batchId": "b1000000-0000-0000-0000-000000000001",
    "riskLevel": "HIGH",
    "regulatoryReportable": true
  }
  ```
- **Response (201):**
  ```json
  {
    "id": "e1000000-0000-0000-0000-000000000099",
    "incidentNumber": "INC-2026-0091",
    "status": "INTAKE",
    "createdAt": "2026-11-01T12:00:00.000Z"
  }
  ```

### GET `/api/v1/incidents`
- **Description:** Lists incidents for the current tenant.
- **Query Parameters:** `status`, `severity`, `limit`, `offset`.
- **Response (200):** Array of incident objects.

### GET `/api/v1/incidents/:id`
- **Description:** Retrieves detailed incident information including device and batch traceability.
- **Response (200):** Incident details object.

### PATCH `/api/v1/incidents/:id`
- **Description:** Updates incident fields (title, description, risk level).
- **Response (200):** Updated incident object.

### POST `/api/v1/incidents/:id/assign`
- **Description:** Assigns an incident to a lead investigator.
- **Request Body:** `{ "assigneeId": "UUID" }`
- **Response (200):** `{ "success": true, "assignedTo": "UUID" }`

### POST `/api/v1/incidents/:id/transition`
- **Description:** Advances incident state machine (e.g. `INTAKE` -> `TRIAGED` -> `INVESTIGATION`).
- **Request Body:** `{ "toStatus": "TRIAGED", "reason": "Triage complete" }`
- **Response (200):** `{ "status": "TRIAGED" }`

---

## 4. Quality Investigation & Root Cause Analysis Module

### POST `/api/v1/incidents/:id/investigations`
- **Description:** Initiates an official root cause investigation for an incident.
- **Request Body:**
  ```json
  {
    "methodology": "HYBRID",
    "leadInvestigatorId": "22222222-2222-2222-2222-222222222222",
    "targetCompletionDate": "2026-11-15T00:00:00Z"
  }
  ```
- **Response (201):** Returns investigation object with ID and initialized status.

### GET `/api/v1/investigations/:id`
- **Description:** Returns investigation record, including 5 Whys and Fishbone nodes.
- **Response (200):** Investigation object.

### POST `/api/v1/investigations/:id/root-causes`
- **Description:** Records an officially verified root cause (requires human review).
- **Request Body:**
  ```json
  {
    "category": "DESIGN",
    "description": "Microcontroller timing jitter under capacitive load",
    "isPrimary": true,
    "humanReviewedBy": "22222222-2222-2222-2222-222222222222"
  }
  ```
- **Response (201):** Root cause object.

### POST `/api/v1/investigations/:id/five-whys`
- **Description:** Adds an iterative step to the 5 Whys analysis.
- **Request Body:** `{ "level": 1, "question": "Why did flow rate drift?", "answer": "Valve voltage lagged" }`
- **Response (201):** 5 Whys step object.

### POST `/api/v1/investigations/:id/fishbone`
- **Description:** Adds an Ishikawa Fishbone factor across the 6M categories (Machine, Method, Material, Man, Measurement, Milieu).
- **Request Body:** `{ "category": "MACHINE", "cause": "Capacitor degradation" }`
- **Response (201):** Fishbone node object.

---

## 5. CAPA Management Module

### POST `/api/v1/capas`
- **Description:** Creates a Corrective or Preventive Action.
- **Request Body:**
  ```json
  {
    "capaNumber": "CAPA-2026-0042",
    "title": "Redesign Timing Circuitry & Update Firmware",
    "description": "Corrective action to prevent sensor jitter recurrence",
    "incidentId": "e1000000-0000-0000-0000-000000000001",
    "investigationId": "iv000000-0000-0000-0000-000000000001",
    "capaType": "CORRECTIVE",
    "assignedTo": "22222222-2222-2222-2222-222222222222"
  }
  ```
- **Response (201):** CAPA object.

### POST `/api/v1/capas/:id/actions`
- **Description:** Adds an action item with Directed Acyclic Graph (DAG) dependencies.
- **Request Body:**
  ```json
  {
    "actionType": "PREVENTIVE",
    "description": "Deploy Firmware Patch v2.4.1",
    "assignedTo": "22222222-2222-2222-2222-222222222222",
    "dueDate": "2026-11-20T00:00:00Z",
    "dependsOnActionIds": ["a0000000-0000-0000-0000-000000000001"]
  }
  ```
- **Response (201):** Created action object with dependency links.

### PATCH `/api/v1/capas/actions/:actionId`
- **Description:** Updates action status. Enforces prerequisite completion before completion is permitted.
- **Request Body:** `{ "status": "COMPLETED", "completionEvidence": "Document DOC-098" }`
- **Response (200):** Updated action item.

### POST `/api/v1/capas/:id/effectiveness-review`
- **Description:** Records quantitative effectiveness review per 21 CFR 820.100.
- **Request Body:**
  ```json
  {
    "metricName": "Flow Rate Variance",
    "baselineValue": 4.8,
    "targetValue": 0.5,
    "actualValue": 0.2,
    "isEffective": true,
    "reviewedBy": "22222222-2222-2222-2222-222222222222"
  }
  ```
- **Response (201):** Effectiveness record.

### POST `/api/v1/capas/:id/close`
- **Description:** Enforces regulatory closure gate: all actions completed and effectiveness verified.
- **Request Body:** `{ "closureNotes": "All actions validated effective over 30 days" }`
- **Response (200):** `{ "id": "UUID", "status": "CLOSED" }`

---

## 6. Controlled Evidence & Document Management

### POST `/api/v1/evidence/documents`
- **Description:** Uploads metadata and cryptographic checksum for a controlled document.
- **Request Body:**
  ```json
  {
    "documentNumber": "DOC-2026-081",
    "title": "Oscilloscope Waveform Diagnostic Analysis",
    "fileName": "waveform_ch1_analysis.pdf",
    "fileSize": 1048576,
    "mimeType": "application/pdf",
    "sha256Checksum": "a1b2c3d4e5f6...",
    "s3WormUri": "s3://audittrail-worm-vault/tenant/waveform.pdf",
    "linkedIncidentId": "e1000000-0000-0000-0000-000000000001"
  }
  ```
- **Response (201):** Document metadata object.

### POST `/api/v1/evidence/documents/:id/versions`
- **Description:** Creates an immutable new revision of an existing controlled document.
- **Response (201):** Document version object.

---

## 7. Approval Workflows & 21 CFR Part 11 Electronic Signatures

### POST `/api/v1/approvals`
- **Description:** Initiates a formal approval workflow for an incident, investigation, or CAPA.
- **Request Body:**
  ```json
  {
    "entityName": "capas",
    "entityId": "ca000000-0000-0000-0000-000000000001",
    "approvalType": "CAPA_CLOSURE",
    "requiredSignatures": 2
  }
  ```
- **Response (201):** Approval request record.

### POST `/api/v1/approvals/:id/approve`
- **Description:** Executes a legally binding 21 CFR Part 11 electronic signature.
- **Request Body:**
  ```json
  {
    "signerId": "22222222-2222-2222-2222-222222222222",
    "meaning": "I approve the closure of this CAPA and verify evidence.",
    "passwordHash": "...",
    "otpToken": "123456"
  }
  ```
- **Response (200):** Signature verification receipt with audit event ID.

---

## 8. AI Decision Support & Telemetry Module

### POST `/api/v1/ai/historical-matching`
- **Description:** Performs vector similarity search over historical incidents using pgvector or cosine fallback.
- **Request Body:**
  ```json
  {
    "incidentDescription": "Flow rate instability in pump model AP-200",
    "topK": 5,
    "threshold": 0.75
  }
  ```
- **Response (200):**
  ```json
  {
    "matches": [
      {
        "incidentId": "e1000000-0000-0000-0000-000000000001",
        "similarityScore": 0.942,
        "title": "Pump pressure sensor drift",
        "badge": "NON_BINDING_HYPOTHESIS"
      }
    ]
  }
  ```

### POST `/api/v1/ai/feedback`
- **Description:** Records human clinician/investigator feedback on AI recommendations (accepted, rejected, modified) for audit trail telemetry.
- **Request Body:**
  ```json
  {
    "recommendationId": "r0000000-0000-0000-0000-000000000001",
    "decision": "ACCEPTED_WITH_MODIFICATIONS",
    "clinicianNotes": "Adjusted threshold value from 1.0 to 0.8"
  }
  ```
- **Response (201):** `{ "success": true, "telemetryId": "UUID" }`

---

## 9. Tamper-Evident Audit Ledger Module

### GET `/api/v1/audit/events`
- **Description:** Retrieves append-only audit records for the current tenant.
- **Query Parameters:** `entityName`, `entityId`, `fromSequence`, `toSequence`, `limit`.
- **Response (200):** Array of audit events.

### GET `/api/v1/audit/verify`
- **Description:** Cryptographically verifies the SHA-256 hash chain for a sequence range.
- **Query Parameters:** `fromSeq=1`, `toSeq=100`.
- **Response (200):**
  ```json
  {
    "isValid": true,
    "totalEventsVerified": 100,
    "timestamp": "2026-11-01T12:00:00.000Z"
  }
  ```

---
*Certified API Reference Specification.*
