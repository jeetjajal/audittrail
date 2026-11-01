# AUDITTRAIL AI v2.1.0 — AWS S3 EVIDENCE STORAGE & WORM GUIDE
**Standard:** 21 CFR § 820.180 (DHF & Quality Records), 21 CFR Part 11, ISO 13485:2016 § 4.2.4 & 4.2.5  
**Package Implementation:** `@aws-sdk/client-s3` (v3) + `@aws-sdk/s3-request-presigner` (v3)  
**Service Location:** `src/services/s3-service.ts`  
**API Endpoints:** `src/routes/evidence.ts`  

---

## 1. ARCHITECTURE & SECURITY OVERVIEW

AuditTrail AI enforces write-once-read-many (WORM) storage for all physical and clinical quality evidence (SEM micrographs, test fixture logs, electronic batch records, supplier SCARs, and validation protocols).

```
[React Custom UI / Jira Client]
       │
       ├── 1. Request Presigned Upload URL (POST /api/v1/documents/presign-upload)
       │      Body: { fileName, mimeType, sha256Checksum, retentionYears }
       ▼
[Fastify Remote Backend]
       │
       ├── Validates SHA-256 (64 hex characters) & Tenant Context
       ├── Issues AWS S3 PutObjectCommand Presigned URL
       │   └── Injects: ChecksumSHA256, ObjectLockMode (COMPLIANCE), ObjectLockRetainUntilDate
       ▼
[React UI uploads directly to S3 via Presigned URL]
       │
       ▼
[AWS S3 WORM Bucket (Object Lock Active)]
       │
       ├── Byte-level SHA-256 verified by AWS S3
       └── Object locked against overwrite & premature deletion for 10 years
```

---

## 2. PRODUCTION AWS S3 BUCKET PROVISIONING

### Step 1: Create Bucket with Object Lock Enabled
```bash
aws s3api create-bucket \
  --bucket audittrail-compliance-records-worm \
  --region us-east-1 \
  --object-lock-enabled-for-bucket
```

### Step 2: Configure Default Compliance Retention (10 Years)
```bash
aws s3api put-object-lock-configuration \
  --bucket audittrail-compliance-records-worm \
  --object-lock-configuration '{
    "ObjectLockRule": {
      "DefaultRetention": {
        "Mode": "COMPLIANCE",
        "Years": 10
      }
    }
  }'
```

### Step 3: Block All Public Access
```bash
aws s3api put-public-access-block \
  --bucket audittrail-compliance-records-worm \
  --public-access-block-configuration '{
    "BlockPublicAcls": true,
    "IgnorePublicAcls": true,
    "BlockPublicPolicy": true,
    "RestrictPublicBuckets": true
  }'
```

---

## 3. LEAST-PRIVILEGE IAM POLICY FOR FASTIFY BACKEND

Attach this IAM policy to the application role or backend ECS/Lambda execution task:

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Sid": "AuditTrailEvidenceWormAccess",
      "Effect": "Allow",
      "Action": [
        "s3:PutObject",
        "s3:GetObject",
        "s3:GetObjectVersion",
        "s3:PutObjectRetention",
        "s3:GetObjectRetention",
        "s3:PutObjectLegalHold",
        "s3:GetObjectLegalHold"
      ],
      "Resource": "arn:aws:s3:::audittrail-compliance-records-worm/*"
    },
    {
      "Sid": "AuditTrailBucketMeta",
      "Effect": "Allow",
      "Action": [
        "s3:GetBucketLocation",
        "s3:GetBucketPolicy"
      ],
      "Resource": "arn:aws:s3:::audittrail-compliance-records-worm"
    }
  ]
}
```

---

## 4. LOCAL DEVELOPMENT & TEST SIMULATION

When running in local dev (`AWS_ACCESS_KEY_ID` not present):
- `S3Service.isConfigured()` returns `false`.
- The service dynamically routes presigned URLs to Fastify mock handlers:
  - `PUT /api/v1/documents/mock-upload/*`
  - `GET /api/v1/documents/mock-download/*`
- Byte-level SHA-256 checksums are verified with Node.js `crypto` engine.
- Zero external AWS network calls or costs are incurred during CI/CD testing.
