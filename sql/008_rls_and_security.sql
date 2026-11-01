-- ============================================================================
-- AUDITTRAIL AI — MIGRATION 008: RLS POLICIES, ROLES & PERFORMANCE INDEXES
-- Version: 2.1.0
-- Security: Strict Multi-Tenant Row Level Security (RLS) with FORCE RLS
-- Roles: audittrail_app (Least Privilege), audittrail_migrator, audittrail_auditor
-- ============================================================================

-- ============================================================================
-- 1. DATABASE APPLICATION ROLES & PERMISSIONS
-- ============================================================================

DO $$
BEGIN
    IF NOT EXISTS (SELECT FROM pg_catalog.pg_roles WHERE rolname = 'audittrail_app') THEN
        CREATE ROLE audittrail_app WITH LOGIN NOBYPASSRLS NOSUPERUSER NOCREATEDB NOCREATEROLE PASSWORD 'audittrail_app_dev_pw';
    END IF;
    IF NOT EXISTS (SELECT FROM pg_catalog.pg_roles WHERE rolname = 'audittrail_migrator') THEN
        CREATE ROLE audittrail_migrator WITH LOGIN BYPASSRLS NOCREATEDB NOCREATEROLE PASSWORD 'audittrail_migrator_dev_pw';
    END IF;
    IF NOT EXISTS (SELECT FROM pg_catalog.pg_roles WHERE rolname = 'audittrail_readonly_auditor') THEN
        CREATE ROLE audittrail_readonly_auditor WITH LOGIN NOBYPASSRLS NOSUPERUSER NOCREATEDB NOCREATEROLE PASSWORD 'audittrail_auditor_dev_pw';
    END IF;
END $$;

GRANT USAGE ON SCHEMA public TO audittrail_app, audittrail_migrator, audittrail_readonly_auditor;

-- Least privilege grants for application role
GRANT SELECT, INSERT, UPDATE ON ALL TABLES IN SCHEMA public TO audittrail_app;
-- Prohibit hard deletes on critical tables for application role
REVOKE DELETE ON audit_events, audit_sequence_counters, audit_ledger_anchors, electronic_signatures FROM audittrail_app;
-- Full read-only for auditor role
GRANT SELECT ON ALL TABLES IN SCHEMA public TO audittrail_readonly_auditor;

-- ============================================================================
-- 2. ROW-LEVEL SECURITY (RLS) ENABLEMENT (PERMISSIVE TENANT POLICIES)
-- ============================================================================

-- Apply standardized Permissive RLS policy across all 36 tenant-owned tables
DO $$
DECLARE
    tbl text;
    tenant_tables text[] := ARRAY[
        'users', 'roles', 'role_permissions', 'user_roles',
        'medical_devices', 'regulatory_approvals', 'device_lots', 'device_units',
        'incidents', 'incident_devices', 'quarantine_records', 'incident_status_history',
        'investigations', 'rca_five_whys', 'rca_fishbone_nodes', 'root_causes',
        'capas', 'capa_actions', 'capa_action_dependencies', 'capa_effectiveness_reviews',
        'documents', 'document_versions', 'entity_attachments',
        'approval_workflows', 'approval_steps', 'electronic_signatures',
        'ai_analyses', 'ai_suggestions', 'ai_human_feedback', 'incident_embeddings',
        'recurring_clusters', 'cluster_incidents', 'audit_reports',
        'audit_sequence_counters', 'audit_events', 'audit_ledger_anchors'
    ];
BEGIN
    FOREACH tbl IN ARRAY tenant_tables
    LOOP
        EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY;', tbl);
        EXECUTE format('ALTER TABLE %I FORCE ROW LEVEL SECURITY;', tbl);

        EXECUTE format('DROP POLICY IF EXISTS tenant_isolation_policy ON %I;', tbl);
        EXECUTE format('
            CREATE POLICY tenant_isolation_policy ON %I
                FOR ALL
                TO audittrail_app, audittrail_readonly_auditor
                USING (organization_id = NULLIF(current_setting(''app.current_organization_id'', true), '''')::UUID)
                WITH CHECK (organization_id = NULLIF(current_setting(''app.current_organization_id'', true), '''')::UUID);
        ', tbl);
    END LOOP;
END $$;

-- Special policy for organizations table (Users can only view their own organization)
ALTER TABLE organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE organizations FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation_org ON organizations;
CREATE POLICY tenant_isolation_org ON organizations
    FOR ALL
    TO audittrail_app, audittrail_readonly_auditor
    USING (id = NULLIF(current_setting('app.current_organization_id', true), '')::UUID)
    WITH CHECK (id = NULLIF(current_setting('app.current_organization_id', true), '')::UUID);

-- ============================================================================
-- 3. PERFORMANCE & VECTOR INDEXING STRATEGY
-- ============================================================================

-- Multi-Tenant Composite B-Tree Indexes
CREATE INDEX IF NOT EXISTS idx_incidents_tenant_status ON incidents (organization_id, status);
CREATE INDEX IF NOT EXISTS idx_incidents_tenant_date ON incidents (organization_id, occurrence_date DESC);
CREATE INDEX IF NOT EXISTS idx_incidents_tenant_num ON incidents (organization_id, incident_number);
CREATE INDEX IF NOT EXISTS idx_capas_tenant_status ON capas (organization_id, status);
CREATE INDEX IF NOT EXISTS idx_capas_tenant_due ON capas (organization_id, due_date ASC);
CREATE INDEX IF NOT EXISTS idx_capa_actions_tenant_assignee ON capa_actions (organization_id, assignee_id, status);
CREATE INDEX IF NOT EXISTS idx_audit_events_tenant_entity ON audit_events (organization_id, entity_name, entity_id);
CREATE INDEX IF NOT EXISTS idx_audit_events_tenant_seq ON audit_events (organization_id, sequence_number DESC);

-- GIN Indexes for Structured JSONB Searches
CREATE INDEX IF NOT EXISTS idx_audit_events_after_gin ON audit_events USING gin (after_state);
CREATE INDEX IF NOT EXISTS idx_audit_events_before_gin ON audit_events USING gin (before_state);
CREATE INDEX IF NOT EXISTS idx_ai_analyses_response_gin ON ai_analyses USING gin (raw_response_json);

-- Vector Indexing (HNSW with pgvector, fallback B-tree index on standard platforms)
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'vector') THEN
        EXECUTE 'CREATE INDEX IF NOT EXISTS idx_incident_embeddings_hnsw ON incident_embeddings USING hnsw (embedding vector_cosine_ops) WITH (m = 16, ef_construction = 64);';
    ELSE
        CREATE INDEX IF NOT EXISTS idx_incident_embeddings_fallback ON incident_embeddings (organization_id, incident_id);
    END IF;
END $$;
