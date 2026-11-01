-- ============================================================================
-- AUDITTRAIL AI — DATABASE VALIDATION & COMPLIANCE TEST RUNNER
-- Role: audittrail_app (Least Privilege, NOBYPASSRLS, NOSUPERUSER)
-- ============================================================================

\echo '----------------------------------------------------------------------'
\echo 'TEST 1: RLS POSITIVE ISOLATION TEST (Tenant A queries own incidents)'
\echo '----------------------------------------------------------------------'
BEGIN;
SET LOCAL app.current_organization_id = 'a1b2c3d4-e5f6-7a8b-9c0d-1e2f3a4b5c6d';
SELECT incident_number, title, severity, status 
FROM incidents;
COMMIT;

\echo '----------------------------------------------------------------------'
\echo 'TEST 2: RLS NEGATIVE ISOLATION TEST (Rogue Tenant B queries Tenant A data)'
\echo '----------------------------------------------------------------------'
BEGIN;
SET LOCAL app.current_organization_id = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb';
-- Must return ZERO rows
SELECT count(*) as rogue_tenant_visible_rows FROM incidents;
COMMIT;

\echo '----------------------------------------------------------------------'
\echo 'TEST 3: RLS NEGATIVE INSERT TEST (Tenant B attempts to insert record into Tenant A)'
\echo '----------------------------------------------------------------------'
BEGIN;
SET LOCAL app.current_organization_id = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb';
-- Must fail with WITH CHECK policy violation
INSERT INTO incidents (
    organization_id, incident_number, title, description, source, severity, status,
    reported_by_id, occurrence_date
) VALUES (
    'a1b2c3d4-e5f6-7a8b-9c0d-1e2f3a4b5c6d', -- Tenant A's ID
    'INC-ROGUE-0001', 'Unauthorized Breach', 'Cross-tenant attack attempt',
    'INTERNAL_AUDIT', 'CRITICAL', 'DRAFT',
    '11111111-1111-1111-1111-111111111111', CURRENT_TIMESTAMP
);
ROLLBACK;

\echo '----------------------------------------------------------------------'
\echo 'TEST 4: CAPA ACTION DEPENDENCY CYCLE PREVENTION (A -> B -> A)'
\echo '----------------------------------------------------------------------'
BEGIN;
SET LOCAL app.current_organization_id = 'a1b2c3d4-e5f6-7a8b-9c0d-1e2f3a4b5c6d';
-- Action 2 already depends on Action 1 in seed data.
-- Attempting to make Action 1 depend on Action 2 MUST FAIL with CYCLIC_DEPENDENCY_DETECTED!
INSERT INTO capa_action_dependencies (organization_id, action_id, depends_on_action_id)
VALUES (
    'a1b2c3d4-e5f6-7a8b-9c0d-1e2f3a4b5c6d',
    'ca100000-0000-0000-0000-000000000001', -- Action 1
    'ca200000-0000-0000-0000-000000000001'  -- Action 2
);
ROLLBACK;

\echo '----------------------------------------------------------------------'
\echo 'TEST 5: MEDICAL DEVICE TRIAD INTEGRITY (Mismatched Unit/Lot Reference)'
\echo '----------------------------------------------------------------------'
BEGIN;
SET LOCAL app.current_organization_id = 'a1b2c3d4-e5f6-7a8b-9c0d-1e2f3a4b5c6d';
-- Attempt to insert an incident_devices row with Unit 1 linked to a fake/mismatched lot ID
INSERT INTO incident_devices (
    organization_id, incident_id, device_id, lot_id, unit_id, quantity_affected
) VALUES (
    'a1b2c3d4-e5f6-7a8b-9c0d-1e2f3a4b5c6d',
    'e1000000-0000-0000-0000-000000000001',
    'd1000000-0000-0000-0000-000000000001',
    'b1000000-0000-0000-0000-000000000099', -- Non-existent lot
    'c1000000-0000-0000-0000-000000000001',
    1
);
ROLLBACK;

\echo '----------------------------------------------------------------------'
\echo 'TEST 6: AUDIT TRAIL 21 CFR PART 11 APPEND-ONLY IMMUTABILITY'
\echo '----------------------------------------------------------------------'
BEGIN;
SET LOCAL app.current_organization_id = 'a1b2c3d4-e5f6-7a8b-9c0d-1e2f3a4b5c6d';
-- Attempting to UPDATE an audit event MUST FAIL via fn_prohibit_audit_mutation trigger!
UPDATE audit_events 
SET reason_for_change = 'Malicious alteration'
WHERE sequence_number = 1;
ROLLBACK;

\echo '----------------------------------------------------------------------'
\echo 'TEST 7: AUDIT HASH CHAIN CONTINUITY & VERIFICATION'
\echo '----------------------------------------------------------------------'
BEGIN;
SET LOCAL app.current_organization_id = 'a1b2c3d4-e5f6-7a8b-9c0d-1e2f3a4b5c6d';
-- Insert event 2 and verify hash link chaining
INSERT INTO audit_events (
    organization_id, entity_name, entity_id, action, actor_id, correlation_id, reason_for_change, before_state, after_state
) VALUES (
    'a1b2c3d4-e5f6-7a8b-9c0d-1e2f3a4b5c6d',
    'capas',
    'ca000000-0000-0000-0000-000000000001',
    'STATUS_CHANGE',
    '22222222-2222-2222-2222-222222222222',
    'corr-test-seq2',
    'Advancing CAPA status to IMPLEMENTATION',
    '{"status": "ACTION_PLANNING"}'::jsonb,
    '{"status": "IMPLEMENTATION"}'::jsonb
);

SELECT sequence_number, previous_event_hash, event_hash, action
FROM audit_events
ORDER BY sequence_number ASC;

COMMIT;
