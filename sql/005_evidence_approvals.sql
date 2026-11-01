-- ============================================================================
-- AUDITTRAIL AI — MIGRATION 005: DOCUMENTS, EVIDENCE & E-SIGNATURES
-- Version: 2.1.0
-- Tables: documents, document_versions, entity_attachments,
--         approval_workflows, approval_steps, electronic_signatures
-- ============================================================================

-- ============================================================================
-- MODULE 6: EVIDENCE & DOCUMENT VERSIONING
-- ============================================================================

CREATE TABLE documents (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE RESTRICT,
    document_code VARCHAR(100) NOT NULL,
    title VARCHAR(255) NOT NULL,
    classification VARCHAR(50) NOT NULL CHECK (classification IN ('EVIDENCE', 'DHF_RECORD', 'SOP', 'AUDIT_PACKAGE', 'VALIDATION_REPORT')),
    current_version_number INTEGER NOT NULL DEFAULT 1 CHECK (current_version_number > 0),
    is_locked BOOLEAN NOT NULL DEFAULT TRUE, -- WORM enforced externally on S3
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT uq_documents_org_code UNIQUE (organization_id, document_code),
    CONSTRAINT uq_documents_org_id UNIQUE (organization_id, id)
);

CREATE TABLE document_versions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL,
    document_id UUID NOT NULL,
    version_number INTEGER NOT NULL CHECK (version_number > 0),
    file_name VARCHAR(255) NOT NULL,
    storage_s3_uri VARCHAR(1024) NOT NULL,
    s3_version_id VARCHAR(255),
    sha256_checksum CHAR(64) NOT NULL,
    mime_type VARCHAR(100) NOT NULL,
    file_size_bytes BIGINT NOT NULL CHECK (file_size_bytes > 0),
    virus_scan_status VARCHAR(30) NOT NULL DEFAULT 'CLEAN' CHECK (virus_scan_status IN ('SCANNING', 'CLEAN', 'INFECTED', 'BYPASSED_VERIFIED')),
    retention_expiration_date DATE NOT NULL,
    uploaded_by_id UUID NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_doc_versions_doc FOREIGN KEY (organization_id, document_id)
        REFERENCES documents(organization_id, id) ON DELETE RESTRICT,
    CONSTRAINT fk_doc_versions_uploader FOREIGN KEY (organization_id, uploaded_by_id)
        REFERENCES users(organization_id, id) ON DELETE RESTRICT,
    CONSTRAINT uq_doc_version UNIQUE (organization_id, document_id, version_number),
    CONSTRAINT uq_document_versions_org_id UNIQUE (organization_id, id)
);

-- Establish explicit FK from documents to active document_version (Resolves AUD-10)
ALTER TABLE documents
ADD COLUMN current_version_id UUID,
ADD CONSTRAINT fk_doc_current_version FOREIGN KEY (organization_id, current_version_id)
    REFERENCES document_versions(organization_id, id) ON DELETE RESTRICT;

-- Link back-reference from 5-Whys to evidence documents
ALTER TABLE rca_five_whys
ADD CONSTRAINT fk_five_whys_doc FOREIGN KEY (organization_id, evidence_document_id)
    REFERENCES documents(organization_id, id) ON DELETE SET NULL;

CREATE TABLE entity_attachments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL,
    document_id UUID NOT NULL,
    entity_type VARCHAR(50) NOT NULL CHECK (entity_type IN ('INCIDENT', 'INVESTIGATION', 'CAPA', 'ACTION', 'EFFECTIVENESS_REVIEW')),
    entity_id UUID NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_attachments_doc FOREIGN KEY (organization_id, document_id)
        REFERENCES documents(organization_id, id) ON DELETE RESTRICT,
    CONSTRAINT uq_entity_attachments UNIQUE (organization_id, document_id, entity_type, entity_id),
    CONSTRAINT uq_entity_attachments_org_id UNIQUE (organization_id, id)
);

-- ============================================================================
-- MODULE 7: APPROVAL WORKFLOWS & 21 CFR PART 11 SIGNATURES
-- ============================================================================

CREATE TABLE approval_workflows (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE RESTRICT,
    entity_type VARCHAR(50) NOT NULL CHECK (entity_type IN ('INCIDENT', 'INVESTIGATION', 'CAPA')),
    entity_id UUID NOT NULL,
    workflow_type VARCHAR(50) NOT NULL CHECK (workflow_type IN ('CAPA_CLOSURE', 'INVESTIGATION_SIGN_OFF', 'NC_DISPOSITION', 'EFFECTIVENESS_APPROVAL')),
    current_step SMALLINT NOT NULL DEFAULT 1,
    status VARCHAR(30) NOT NULL DEFAULT 'IN_PROGRESS' CHECK (status IN ('IN_PROGRESS', 'APPROVED', 'REJECTED', 'CANCELLED')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT uq_approval_workflows_org_id UNIQUE (organization_id, id)
);

CREATE TABLE approval_steps (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL,
    workflow_id UUID NOT NULL,
    step_order SMALLINT NOT NULL,
    step_name VARCHAR(100) NOT NULL,
    required_role_id UUID NOT NULL,
    status VARCHAR(30) NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'COMPLETED', 'REJECTED')),
    CONSTRAINT fk_app_steps_wf FOREIGN KEY (organization_id, workflow_id)
        REFERENCES approval_workflows(organization_id, id) ON DELETE CASCADE,
    CONSTRAINT fk_app_steps_role FOREIGN KEY (organization_id, required_role_id)
        REFERENCES roles(organization_id, id) ON DELETE RESTRICT,
    CONSTRAINT uq_approval_steps_order UNIQUE (organization_id, workflow_id, step_order),
    CONSTRAINT uq_approval_steps_org_id UNIQUE (organization_id, id)
);

CREATE TABLE electronic_signatures (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE RESTRICT,
    approval_step_id UUID NOT NULL,
    signer_id UUID NOT NULL,
    signer_name_snapshot VARCHAR(255) NOT NULL,
    signer_title_snapshot VARCHAR(150) NOT NULL,
    meaning_of_signature VARCHAR(50) NOT NULL CHECK (meaning_of_signature IN ('AUTHORED', 'REVIEWED', 'APPROVED', 'VERIFIED')),
    reauth_mechanism VARCHAR(50) NOT NULL CHECK (reauth_mechanism IN ('MFA_TOTP', 'FIDO2_PASSKEY', 'ATLASSIAN_REAUTH_JWT')),
    signed_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    ip_address INET NOT NULL,
    user_agent TEXT,
    record_digest_sha256 CHAR(64) NOT NULL, -- SHA-256 of canonical JSON entity snapshot
    signature_manifest_hash CHAR(64) NOT NULL, -- SHA-256 of (signer_id + timestamp + digest + meaning)
    CONSTRAINT fk_signatures_step FOREIGN KEY (organization_id, approval_step_id)
        REFERENCES approval_steps(organization_id, id) ON DELETE RESTRICT,
    CONSTRAINT fk_signatures_signer FOREIGN KEY (organization_id, signer_id)
        REFERENCES users(organization_id, id) ON DELETE RESTRICT,
    CONSTRAINT uq_signatures_step UNIQUE (organization_id, approval_step_id),
    CONSTRAINT uq_signatures_org_id UNIQUE (organization_id, id)
);
