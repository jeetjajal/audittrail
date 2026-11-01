-- ============================================================================
-- AUDITTRAIL AI — MIGRATION 007: TAMPER-EVIDENT AUDIT LEDGER (MODULE 9)
-- Version: 2.1.0
-- Tables: audit_sequence_counters (NEW), audit_events, audit_ledger_anchors
-- Concurrency: Dedicated per-tenant counter with atomic FOR UPDATE row locking
-- Serialization: Canonical RFC 8785 JSON representation
-- ============================================================================

-- Table 36: Dedicated sequence counter to eliminate genesis concurrency race conditions (Resolves AUD-03)
CREATE TABLE audit_sequence_counters (
    organization_id UUID PRIMARY KEY REFERENCES organizations(id) ON DELETE RESTRICT,
    current_sequence BIGINT NOT NULL DEFAULT 0,
    last_event_hash CHAR(64) NOT NULL DEFAULT '0000000000000000000000000000000000000000000000000000000000000000',
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT uq_audit_sequence_counters_org_id UNIQUE (organization_id)
);

-- Trigger to auto-initialize counter on organization onboarding
CREATE OR REPLACE FUNCTION fn_init_tenant_audit_counter()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO audit_sequence_counters (organization_id, current_sequence, last_event_hash)
    VALUES (NEW.id, 0, '0000000000000000000000000000000000000000000000000000000000000000')
    ON CONFLICT (organization_id) DO NOTHING;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_init_tenant_audit_counter
AFTER INSERT ON organizations
FOR EACH ROW EXECUTE FUNCTION fn_init_tenant_audit_counter();

-- Table 37: Tamper-Evident Audit Events (Append-Only)
CREATE TABLE audit_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE RESTRICT,
    sequence_number BIGINT NOT NULL,
    entity_name VARCHAR(50) NOT NULL,
    entity_id UUID NOT NULL,
    action VARCHAR(20) NOT NULL CHECK (action IN ('INSERT', 'UPDATE', 'DELETE', 'SOFT_DELETE', 'APPROVE', 'REJECT', 'STATUS_CHANGE')),
    actor_id UUID,
    correlation_id VARCHAR(100),
    reason_for_change TEXT,
    before_state JSONB,
    after_state JSONB,
    ip_address INET,
    previous_event_hash CHAR(64) NOT NULL,
    event_hash CHAR(64) NOT NULL UNIQUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_audit_actor FOREIGN KEY (organization_id, actor_id)
        REFERENCES users(organization_id, id) ON DELETE RESTRICT,
    CONSTRAINT uq_audit_org_seq UNIQUE (organization_id, sequence_number),
    CONSTRAINT uq_audit_events_org_id UNIQUE (organization_id, id)
);

-- Concurrency-Safe, JCS-Canonical Cryptographic Hash Chaining Trigger
CREATE OR REPLACE FUNCTION fn_audit_chain_trigger()
RETURNS TRIGGER AS $$
DECLARE
    v_prev_hash CHAR(64);
    v_prev_seq BIGINT;
    v_raw_payload TEXT;
BEGIN
    -- Atomic row-lock on tenant counter row (guaranteed to exist via org onboarding trigger)
    SELECT current_sequence, last_event_hash
    INTO v_prev_seq, v_prev_hash
    FROM audit_sequence_counters
    WHERE organization_id = NEW.organization_id
    FOR UPDATE;

    IF NOT FOUND THEN
        -- Fallback initialization in transaction
        INSERT INTO audit_sequence_counters (organization_id, current_sequence, last_event_hash)
        VALUES (NEW.organization_id, 0, '0000000000000000000000000000000000000000000000000000000000000000')
        RETURNING current_sequence, last_event_hash INTO v_prev_seq, v_prev_hash;
    END IF;

    NEW.sequence_number := v_prev_seq + 1;
    NEW.previous_event_hash := v_prev_hash;

    -- Canonical RFC 8785 byte string serialization (Resolves AUD-04)
    v_raw_payload := NEW.previous_event_hash || '|' ||
                     NEW.sequence_number::TEXT || '|' ||
                     NEW.organization_id::TEXT || '|' ||
                     NEW.entity_name || '|' ||
                     NEW.entity_id::TEXT || '|' ||
                     NEW.action || '|' ||
                     COALESCE(NEW.actor_id::TEXT, 'SYSTEM') || '|' ||
                     fn_canonical_json_text(NEW.before_state) || '|' ||
                     fn_canonical_json_text(NEW.after_state) || '|' ||
                     COALESCE(NEW.reason_for_change, '') || '|' ||
                     to_char(NEW.created_at, 'YYYY-MM-DD"T"HH24:MI:SS.US"Z"');

    NEW.event_hash := encode(digest(v_raw_payload, 'sha256'), 'hex');

    -- Atomically advance counter within same transaction
    UPDATE audit_sequence_counters
    SET current_sequence = NEW.sequence_number,
        last_event_hash = NEW.event_hash,
        updated_at = CURRENT_TIMESTAMP
    WHERE organization_id = NEW.organization_id;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_audit_chain
BEFORE INSERT ON audit_events
FOR EACH ROW EXECUTE FUNCTION fn_audit_chain_trigger();

-- Table 38: External S3 WORM Anchor Ledger (Hourly Cryptographic Proof)
CREATE TABLE audit_ledger_anchors (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE RESTRICT,
    from_sequence_number BIGINT NOT NULL,
    to_sequence_number BIGINT NOT NULL,
    cumulative_merkle_root CHAR(64) NOT NULL,
    s3_worm_uri VARCHAR(1024) NOT NULL,
    s3_object_lock_retain_until TIMESTAMPTZ NOT NULL,
    anchored_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT uq_audit_anchors_range UNIQUE (organization_id, from_sequence_number, to_sequence_number),
    CONSTRAINT uq_audit_ledger_anchors_org_id UNIQUE (organization_id, id)
);

-- Enforce Append-Only: Prohibit physical UPDATE and DELETE on audit_events
CREATE OR REPLACE FUNCTION fn_prohibit_audit_mutation()
RETURNS TRIGGER AS $$
BEGIN
    RAISE EXCEPTION 'REGULATORY_VIOLATION_21CFR11: Modifications or deletions of audit_events are strictly prohibited.';
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_prohibit_audit_update_delete
BEFORE UPDATE OR DELETE ON audit_events
FOR EACH ROW EXECUTE FUNCTION fn_prohibit_audit_mutation();
