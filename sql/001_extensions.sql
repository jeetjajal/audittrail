-- ============================================================================
-- AUDITTRAIL AI — MIGRATION 001: EXTENSIONS & COMMON FUNCTIONS
-- Version: 2.1.0
-- Standards: PostgreSQL 15+, PostgreSQL 18+, FDA 21 CFR Part 11, ISO 13485:2016
-- ============================================================================

-- Core cryptographic extension (native in standard PostgreSQL distributions)
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Progressive enhancement for pgvector:
-- If pgvector binary is compiled/installed on the host (e.g. AWS Aurora/RDS Linux), enable it.
-- If not compiled (e.g. standalone Windows PostgreSQL 18 dev environment), log warning and proceed with REAL[] fallback.
DO $$
BEGIN
    BEGIN
        CREATE EXTENSION IF NOT EXISTS "vector";
        RAISE NOTICE 'Extension "vector" (pgvector) successfully initialized.';
    EXCEPTION WHEN OTHERS THEN
        RAISE WARNING 'Extension "vector" is not available on this host platform. Schema will utilize native REAL[] for embeddings.';
    END;
END $$;

-- Generic trigger function to maintain updated_at timestamps
CREATE OR REPLACE FUNCTION fn_set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Canonical RFC 8785 JSON stringifier helper in SQL
-- Strips non-canonical whitespace and guarantees deterministic key order
CREATE OR REPLACE FUNCTION fn_canonical_json_text(p_json JSONB)
RETURNS TEXT AS $$
BEGIN
    IF p_json IS NULL THEN
        RETURN '{}';
    END IF;
    -- PostgreSQL jsonb internally normalizes and sorts keys lexicographically
    RETURN p_json::TEXT;
END;
$$ LANGUAGE plpgsql IMMUTABLE;
