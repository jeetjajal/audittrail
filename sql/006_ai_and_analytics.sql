-- ============================================================================
-- AUDITTRAIL AI — MIGRATION 006: AI INTELLIGENCE, CLUSTERS & REPORTS
-- Version: 2.1.0
-- Tables: ai_analyses, ai_suggestions, ai_human_feedback, incident_embeddings,
--         recurring_clusters, cluster_incidents, audit_reports
-- Standards: Google Vertex AI text-embedding-004 (768-dim), HNSW Cosine Index
-- ============================================================================

-- ============================================================================
-- MODULE 8: AI GOVERNANCE, TELEMETRY & VECTOR SEARCH
-- ============================================================================

CREATE TABLE ai_analyses (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE RESTRICT,
    entity_type VARCHAR(50) NOT NULL CHECK (entity_type IN ('INCIDENT', 'INVESTIGATION', 'CAPA')),
    entity_id UUID NOT NULL,
    model_provider VARCHAR(50) NOT NULL DEFAULT 'GOOGLE_VERTEX_AI',
    model_name VARCHAR(100) NOT NULL DEFAULT 'gemini-1.5-pro-002',
    prompt_template_version VARCHAR(50) NOT NULL,
    prompt_hash CHAR(64) NOT NULL,
    input_tokens INTEGER NOT NULL CHECK (input_tokens >= 0),
    output_tokens INTEGER NOT NULL CHECK (output_tokens >= 0),
    latency_ms INTEGER NOT NULL CHECK (latency_ms >= 0),
    raw_response_json JSONB NOT NULL,
    model_confidence_raw NUMERIC(4,3) CHECK (model_confidence_raw BETWEEN 0.000 AND 1.000),
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT uq_ai_analyses_org_id UNIQUE (organization_id, id)
);

CREATE TABLE ai_suggestions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL,
    analysis_id UUID NOT NULL,
    suggestion_type VARCHAR(50) NOT NULL CHECK (suggestion_type IN (
        'ROOT_CAUSE_HYPOTHESIS', 'CAPA_ACTION_RECOMMENDATION', 
        'SEVERITY_TRIAGE_RECOMMENDATION', 'HISTORICAL_PATTERN_MATCH'
    )),
    structured_content JSONB NOT NULL,
    human_review_status VARCHAR(30) NOT NULL DEFAULT 'PENDING_REVIEW' 
        CHECK (human_review_status IN ('PENDING_REVIEW', 'ACCEPTED', 'REJECTED', 'MODIFIED')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_ai_sug_analysis FOREIGN KEY (organization_id, analysis_id)
        REFERENCES ai_analyses(organization_id, id) ON DELETE CASCADE,
    CONSTRAINT uq_ai_suggestions_org_id UNIQUE (organization_id, id)
);

CREATE TABLE ai_human_feedback (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL,
    suggestion_id UUID NOT NULL,
    user_id UUID NOT NULL,
    disposition VARCHAR(30) NOT NULL CHECK (disposition IN ('ACCEPTED_AS_IS', 'EDITED_BEFORE_ACCEPT', 'DISMISSED')),
    edited_content JSONB,
    rejection_reason TEXT,
    usefulness_score SMALLINT CHECK (usefulness_score BETWEEN 1 AND 5),
    reviewed_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_ai_fb_suggestion FOREIGN KEY (organization_id, suggestion_id)
        REFERENCES ai_suggestions(organization_id, id) ON DELETE CASCADE,
    CONSTRAINT fk_ai_fb_user FOREIGN KEY (organization_id, user_id)
        REFERENCES users(organization_id, id) ON DELETE RESTRICT,
    CONSTRAINT uq_ai_feedback_suggestion UNIQUE (organization_id, suggestion_id),
    CONSTRAINT uq_ai_human_feedback_org_id UNIQUE (organization_id, id)
);

-- Incident embeddings: Supports vector(768) when pgvector is present, falls back to REAL[] array on standard hosts
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM pg_type WHERE typname = 'vector') THEN
        CREATE TABLE incident_embeddings (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE RESTRICT,
            incident_id UUID NOT NULL,
            chunk_type VARCHAR(50) NOT NULL DEFAULT 'FULL_NARRATIVE',
            chunk_text TEXT NOT NULL,
            embedding_dimension SMALLINT NOT NULL DEFAULT 768,
            embedding vector(768) NOT NULL,
            model_name VARCHAR(100) NOT NULL DEFAULT 'text-embedding-004',
            model_version VARCHAR(50) NOT NULL DEFAULT '1.0',
            created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
            CONSTRAINT fk_inc_emb_incident FOREIGN KEY (organization_id, incident_id)
                REFERENCES incidents(organization_id, id) ON DELETE CASCADE,
            CONSTRAINT uq_incident_embeddings_org_id UNIQUE (organization_id, id)
        );
    ELSE
        CREATE TABLE incident_embeddings (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE RESTRICT,
            incident_id UUID NOT NULL,
            chunk_type VARCHAR(50) NOT NULL DEFAULT 'FULL_NARRATIVE',
            chunk_text TEXT NOT NULL,
            embedding_dimension SMALLINT NOT NULL DEFAULT 768,
            embedding REAL[] NOT NULL,
            model_name VARCHAR(100) NOT NULL DEFAULT 'text-embedding-004',
            model_version VARCHAR(50) NOT NULL DEFAULT '1.0',
            created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
            CONSTRAINT fk_inc_emb_incident FOREIGN KEY (organization_id, incident_id)
                REFERENCES incidents(organization_id, id) ON DELETE CASCADE,
            CONSTRAINT uq_incident_embeddings_org_id UNIQUE (organization_id, id)
        );
    END IF;
END $$;

-- ============================================================================
-- MODULE 10: RECURRING PROBLEM DETECTION
-- ============================================================================

CREATE TABLE recurring_clusters (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE RESTRICT,
    cluster_code VARCHAR(50) NOT NULL,
    pattern_title VARCHAR(255) NOT NULL,
    device_id UUID,
    detection_method VARCHAR(50) NOT NULL CHECK (detection_method IN ('HYBRID_VECTOR_METADATA', 'RULE_BASED', 'MANUAL_DISCOVERY')),
    incident_count INTEGER NOT NULL DEFAULT 0,
    first_detected_at TIMESTAMPTZ NOT NULL,
    last_detected_at TIMESTAMPTZ NOT NULL,
    status VARCHAR(30) NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE', 'CAPA_ESCALATED', 'RESOLVED_MONITORED')),
    escalated_capa_id UUID,
    CONSTRAINT fk_clusters_device FOREIGN KEY (organization_id, device_id)
        REFERENCES medical_devices(organization_id, id) ON DELETE SET NULL,
    CONSTRAINT fk_clusters_capa FOREIGN KEY (organization_id, escalated_capa_id)
        REFERENCES capas(organization_id, id) ON DELETE SET NULL,
    CONSTRAINT uq_clusters_org_code UNIQUE (organization_id, cluster_code),
    CONSTRAINT uq_recurring_clusters_org_id UNIQUE (organization_id, id)
);

CREATE TABLE cluster_incidents (
    organization_id UUID NOT NULL,
    cluster_id UUID NOT NULL,
    incident_id UUID NOT NULL,
    cosine_similarity NUMERIC(5,4) NOT NULL,
    added_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (cluster_id, incident_id),
    CONSTRAINT fk_ci_cluster FOREIGN KEY (organization_id, cluster_id)
        REFERENCES recurring_clusters(organization_id, id) ON DELETE CASCADE,
    CONSTRAINT fk_ci_incident FOREIGN KEY (organization_id, incident_id)
        REFERENCES incidents(organization_id, id) ON DELETE CASCADE
);

-- ============================================================================
-- MODULE 11: AUDIT READINESS & REPORTING
-- ============================================================================

CREATE TABLE audit_reports (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE RESTRICT,
    report_number VARCHAR(50) NOT NULL,
    report_type VARCHAR(50) NOT NULL CHECK (report_type IN (
        'INCIDENT_DOSSIER', 'CAPA_CLOSURE_PACKAGE', 'INTERNAL_AUDIT_PACK', 
        'MANAGEMENT_REVIEW_SUMMARY', 'INSPECTION_READINESS_PACKAGE'
    )),
    title VARCHAR(255) NOT NULL,
    generated_by_id UUID NOT NULL,
    parameters_json JSONB NOT NULL,
    document_id UUID,
    status VARCHAR(30) NOT NULL DEFAULT 'GENERATING' CHECK (status IN ('GENERATING', 'READY', 'ARCHIVED', 'FAILED')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_reports_generator FOREIGN KEY (organization_id, generated_by_id)
        REFERENCES users(organization_id, id) ON DELETE RESTRICT,
    CONSTRAINT fk_reports_document FOREIGN KEY (organization_id, document_id)
        REFERENCES documents(organization_id, id) ON DELETE SET NULL,
    CONSTRAINT uq_reports_org_num UNIQUE (organization_id, report_number),
    CONSTRAINT uq_audit_reports_org_id UNIQUE (organization_id, id)
);
