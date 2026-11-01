-- ============================================================================
-- AUDITTRAIL AI — MIGRATION 009: PRODUCTION SEED DATA (DEVELOPMENT & TEST)
-- Version: 2.1.0
-- Domain: Class III Medical Device Quality Investigation (Aegis MedTech Inc.)
-- Standards: FDA QMSR 2026, ISO 13485:2016, 21 CFR Part 11
-- ============================================================================

BEGIN;

-- Establish Tenant Context for Transaction
SET LOCAL app.current_organization_id = 'a1b2c3d4-e5f6-7a8b-9c0d-1e2f3a4b5c6d';

-- 1. Organization Onboarding (Auto-triggers audit_sequence_counters row creation)
INSERT INTO organizations (
    id, name, slug, atlassian_cloud_id, atlassian_installation_id, fda_establishment_id, iso_certifications, is_active
) VALUES (
    'a1b2c3d4-e5f6-7a8b-9c0d-1e2f3a4b5c6d',
    'Aegis MedTech Devices Inc.',
    'aegis-medtech',
    'ari:cloud:jira::site/489f648b-3db4-4b47-8149-aegismedtech',
    'inst_aegis_prod_001',
    'FEI-3004819283',
    '[{"standard": "ISO 13485:2016", "cert_body": "TÜV SÜD", "certificate_number": "Q5 092831 0042", "valid_until": "2028-05-30"}]'::jsonb,
    TRUE
) ON CONFLICT (id) DO NOTHING;

-- 2. Users & Core Roles
INSERT INTO users (
    id, organization_id, atlassian_account_id, email, full_name, job_title, department, is_active
) VALUES
(
    '11111111-1111-1111-1111-111111111111',
    'a1b2c3d4-e5f6-7a8b-9c0d-1e2f3a4b5c6d',
    'qm:user:elena.rostova@aegismed.com',
    'elena.rostova@aegismed.com',
    'Dr. Elena Rostova',
    'VP of Regulatory Affairs & Quality',
    'Quality & Regulatory',
    TRUE
),
(
    '22222222-2222-2222-2222-222222222222',
    'a1b2c3d4-e5f6-7a8b-9c0d-1e2f3a4b5c6d',
    'qm:user:marcus.vance@aegismed.com',
    'marcus.vance@aegismed.com',
    'Marcus Vance',
    'Senior Quality Investigation Engineer',
    'Quality Assurance',
    TRUE
),
(
    '33333333-3333-3333-3333-333333333333',
    'a1b2c3d4-e5f6-7a8b-9c0d-1e2f3a4b5c6d',
    'qm:user:sarah.jenkins@aegismed.com',
    'sarah.jenkins@aegismed.com',
    'Sarah Jenkins',
    'Manufacturing Quality Engineer',
    'Operations QA',
    TRUE
) ON CONFLICT (id) DO NOTHING;

INSERT INTO roles (id, organization_id, code, name, description, is_system) VALUES
('10101010-1010-1010-1010-101010101010', 'a1b2c3d4-e5f6-7a8b-9c0d-1e2f3a4b5c6d', 'QUALITY_DIRECTOR', 'Quality Director', 'Full 21 CFR Part 11 sign-off authority for FDA/MDR submissions', TRUE),
('20202020-2020-2020-2020-202020202020', 'a1b2c3d4-e5f6-7a8b-9c0d-1e2f3a4b5c6d', 'LEAD_INVESTIGATOR', 'Lead RCA Investigator', 'Can author and execute 5-Whys and Fishbone analyses', TRUE),
('30303030-3030-3030-3030-303030303030', 'a1b2c3d4-e5f6-7a8b-9c0d-1e2f3a4b5c6d', 'QUALITY_ENGINEER', 'Quality Engineer', 'General non-conformance intake and CAPA action execution', TRUE)
ON CONFLICT (id) DO NOTHING;

INSERT INTO user_roles (organization_id, user_id, role_id) VALUES
('a1b2c3d4-e5f6-7a8b-9c0d-1e2f3a4b5c6d', '11111111-1111-1111-1111-111111111111', '10101010-1010-1010-1010-101010101010'),
('a1b2c3d4-e5f6-7a8b-9c0d-1e2f3a4b5c6d', '22222222-2222-2222-2222-222222222222', '20202020-2020-2020-2020-202020202020'),
('a1b2c3d4-e5f6-7a8b-9c0d-1e2f3a4b5c6d', '33333333-3333-3333-3333-333333333333', '30303030-3030-3030-3030-303030303030')
ON CONFLICT DO NOTHING;

-- 3. Medical Device Traceability Triad
INSERT INTO medical_devices (
    id, organization_id, udi_di, model_number, device_name, device_type, fda_risk_class, eu_mdr_risk_class, gmdn_code, is_implantable
) VALUES (
    'd1000000-0000-0000-0000-000000000001',
    'a1b2c3d4-e5f6-7a8b-9c0d-1e2f3a4b5c6d',
    '00850012345001',
    'CP-9000',
    'CardioPulse Dual-Chamber Implantable Pacemaker',
    'HARDWARE',
    'CLASS_III',
    'CLASS_III',
    '35160',
    TRUE
) ON CONFLICT (organization_id, udi_di) DO NOTHING;

INSERT INTO regulatory_approvals (
    id, organization_id, device_id, jurisdiction, clearance_type, clearance_identifier, granted_date, valid_until
) VALUES
('a0000000-0000-0000-0000-000000000001', 'a1b2c3d4-e5f6-7a8b-9c0d-1e2f3a4b5c6d', 'd1000000-0000-0000-0000-000000000001', 'US_FDA', 'FDA_PMA', 'PMA-P240012', '2024-03-15', NULL),
('a0000000-0000-0000-0000-000000000002', 'a1b2c3d4-e5f6-7a8b-9c0d-1e2f3a4b5c6d', 'd1000000-0000-0000-0000-000000000001', 'EU_MDR', 'CE_MARK', 'CE-789012', '2024-06-20', '2029-06-19')
ON CONFLICT (id) DO NOTHING;

INSERT INTO device_lots (
    id, organization_id, device_id, lot_batch_number, manufacturing_date, expiry_date, batch_size, sterilization_lot, sterilization_method, is_released, released_by_id, released_at
) VALUES (
    'b1000000-0000-0000-0000-000000000001',
    'a1b2c3d4-e5f6-7a8b-9c0d-1e2f3a4b5c6d',
    'd1000000-0000-0000-0000-000000000001',
    'LOT-2026-03B',
    '2026-01-15',
    '2031-01-15',
    1200,
    'STER-ETO-8841',
    'ETO',
    TRUE,
    '11111111-1111-1111-1111-111111111111',
    '2026-01-20 10:00:00Z'
) ON CONFLICT (organization_id, device_id, lot_batch_number) DO NOTHING;

INSERT INTO device_units (
    id, organization_id, device_id, lot_id, serial_number, manufactured_at, current_status
) VALUES
('c1000000-0000-0000-0000-000000000001', 'a1b2c3d4-e5f6-7a8b-9c0d-1e2f3a4b5c6d', 'd1000000-0000-0000-0000-000000000001', 'b1000000-0000-0000-0000-000000000001', 'SN-CP9-88021', '2026-01-16 08:30:00Z', 'DISTRIBUTED'),
('c1000000-0000-0000-0000-000000000002', 'a1b2c3d4-e5f6-7a8b-9c0d-1e2f3a4b5c6d', 'd1000000-0000-0000-0000-000000000001', 'b1000000-0000-0000-0000-000000000001', 'SN-CP9-88022', '2026-01-16 09:15:00Z', 'QUARANTINED')
ON CONFLICT (organization_id, device_id, serial_number) DO NOTHING;

-- 4. Incident & Containment Quarantine
INSERT INTO incidents (
    id, organization_id, incident_number, title, description, source, severity, status,
    reported_by_id, assigned_to_id, occurrence_date, is_mdr_reportable, mdr_reportability_rationale,
    patient_impact_level, rpn_score, jira_issue_key
) VALUES (
    'e1000000-0000-0000-0000-000000000001',
    'a1b2c3d4-e5f6-7a8b-9c0d-1e2f3a4b5c6d',
    'INC-2026-0042',
    'Premature battery impedance spike during RF telemetry session',
    'During routine pacemaker interrogation at St. Jude Heart Clinic, telemetry transmission aborted due to rapid voltage sag under RF power amplifier load. Pacemaker reverted to VVI backup pacing mode. No patient adverse events occurred.',
    'CUSTOMER_COMPLAINT',
    'CRITICAL',
    'CONTAINMENT_ACTIVE',
    '33333333-3333-3333-3333-333333333333',
    '22222222-2222-2222-2222-222222222222',
    '2026-10-18 14:32:00Z',
    TRUE,
    'Potential loss of diagnostic telemetry in Class III active implantable medical device triggers 30-day MDR reporting threshold.',
    'NO_PATIENT_IMPACT',
    240,
    'QMS-1042'
) ON CONFLICT (organization_id, incident_number) DO NOTHING;

INSERT INTO incident_devices (
    id, organization_id, incident_id, device_id, lot_id, unit_id, quantity_affected
) VALUES (
    'ed000000-0000-0000-0000-000000000001',
    'a1b2c3d4-e5f6-7a8b-9c0d-1e2f3a4b5c6d',
    'e1000000-0000-0000-0000-000000000001',
    'd1000000-0000-0000-0000-000000000001',
    'b1000000-0000-0000-0000-000000000001',
    'c1000000-0000-0000-0000-000000000001',
    1
) ON CONFLICT (id) DO NOTHING;

INSERT INTO quarantine_records (
    id, organization_id, incident_id, lot_id, quarantine_number, quantity_quarantined, quarantine_location, reason, status, quarantined_by_id
) VALUES (
    'f1000000-0000-0000-0000-000000000001',
    'a1b2c3d4-e5f6-7a8b-9c0d-1e2f3a4b5c6d',
    'e1000000-0000-0000-0000-000000000001',
    'b1000000-0000-0000-0000-000000000001',
    'QRN-2026-0018',
    214,
    'Warehouse 4 - Secure Bio-Vault B',
    'Immediate containment hold on undistributed units of LOT-2026-03B following reported capacitor telemetry sag.',
    'ACTIVE',
    '22222222-2222-2222-2222-222222222222'
) ON CONFLICT (id) DO NOTHING;

-- 5. Investigation & Root Cause Analysis
INSERT INTO investigations (
    id, organization_id, incident_id, lead_investigator_id, methodology, summary, containment_actions, status
) VALUES (
    'f2000000-0000-0000-0000-000000000001',
    'a1b2c3d4-e5f6-7a8b-9c0d-1e2f3a4b5c6d',
    'e1000000-0000-0000-0000-000000000001',
    '22222222-2222-2222-2222-222222222222',
    'FIVE_WHYS',
    'Root cause established as internal dielectric cracking in decoupling capacitor C42 due to thermal reflow profile deviation.',
    'Warehouse vault quarantine completed for remaining 214 finished units. Surface-mount assembly PCB Line 3 halted.',
    'IN_PROGRESS'
) ON CONFLICT (id) DO NOTHING;

INSERT INTO rca_five_whys (organization_id, investigation_id, step_number, why_question, answer) VALUES
('a1b2c3d4-e5f6-7a8b-9c0d-1e2f3a4b5c6d', 'f2000000-0000-0000-0000-000000000001', 1, 'Why did the RF telemetry transmission fail?', 'Battery supply voltage dropped below the 2.1V RF power amplifier threshold.'),
('a1b2c3d4-e5f6-7a8b-9c0d-1e2f3a4b5c6d', 'f2000000-0000-0000-0000-000000000001', 2, 'Why did battery supply voltage sag under RF load?', 'The decoupling capacitor bank failed to supply peak surge current.'),
('a1b2c3d4-e5f6-7a8b-9c0d-1e2f3a4b5c6d', 'f2000000-0000-0000-0000-000000000001', 3, 'Why did the decoupling capacitor bank fail?', 'Tantalum capacitor C42 exhibited high equivalent series resistance (ESR).'),
('a1b2c3d4-e5f6-7a8b-9c0d-1e2f3a4b5c6d', 'f2000000-0000-0000-0000-000000000001', 4, 'Why did capacitor C42 exhibit high ESR?', 'Micro-cracking of the dielectric layer occurred during surface-mount soldering.'),
('a1b2c3d4-e5f6-7a8b-9c0d-1e2f3a4b5c6d', 'f2000000-0000-0000-0000-000000000001', 5, 'Why did micro-cracking occur during soldering?', 'Reflow Oven Zone 4 thermocouple calibration drifted +18°C above thermal process window.')
ON CONFLICT DO NOTHING;

INSERT INTO root_causes (
    id, organization_id, investigation_id, statement, category, verification_method, is_verified, verified_by_id, verified_at
) VALUES (
    'f3000000-0000-0000-0000-000000000001',
    'a1b2c3d4-e5f6-7a8b-9c0d-1e2f3a4b5c6d',
    'f2000000-0000-0000-0000-000000000001',
    'Thermal reflow over-temperature exposure caused mechanical stress fractures in ceramic/tantalum capacitor dielectric.',
    'MANUFACTURING_PROCESS',
    'Cross-sectional scanning electron microscopy (SEM) and thermocouple thermal profiling under IPC-A-610 Class 3 specifications.',
    TRUE,
    '11111111-1111-1111-1111-111111111111',
    '2026-10-20 11:30:00Z'
) ON CONFLICT (id) DO NOTHING;

-- 6. CAPA & Dependent Actions Graph (Action 2 depends on Action 1)
INSERT INTO capas (
    id, organization_id, capa_number, incident_id, investigation_id, capa_type, title, problem_statement,
    status, risk_level, owner_id, due_date
) VALUES (
    'ca000000-0000-0000-0000-000000000001',
    'a1b2c3d4-e5f6-7a8b-9c0d-1e2f3a4b5c6d',
    'CAPA-2026-0012',
    'e1000000-0000-0000-0000-000000000001',
    'f2000000-0000-0000-0000-000000000001',
    'CORRECTIVE',
    'Thermal Over-Temperature Interlock Installation on SMT Reflow Line 3',
    'Mitigate capacitor thermal micro-cracking by installing redundant closed-loop infrared pyrometer monitors with automatic line stoppage on temperature deviation.',
    'ACTION_PLANNING',
    'HIGH',
    '22222222-2222-2222-2222-222222222222',
    '2026-12-15'
) ON CONFLICT (organization_id, capa_number) DO NOTHING;

INSERT INTO capa_actions (
    id, organization_id, capa_id, action_number, action_type, description, assignee_id, due_date, status
) VALUES
(
    'ca100000-0000-0000-0000-000000000001',
    'a1b2c3d4-e5f6-7a8b-9c0d-1e2f3a4b5c6d',
    'ca000000-0000-0000-0000-000000000001',
    1,
    'PROCESS_CHANGE',
    'Install redundant closed-loop IR pyrometer interlock in Reflow Zone 4 with automatic conveyor shutdown.',
    '22222222-2222-2222-2222-222222222222',
    '2026-11-20',
    'PENDING'
),
(
    'ca200000-0000-0000-0000-000000000001',
    'a1b2c3d4-e5f6-7a8b-9c0d-1e2f3a4b5c6d',
    'ca000000-0000-0000-0000-000000000001',
    2,
    'RETRAINING',
    'Recertify SMT line operators on revised SOP-MFG-308 thermal profiling procedures.',
    '33333333-3333-3333-3333-333333333333',
    '2026-11-30',
    'PENDING'
) ON CONFLICT (id) DO NOTHING;

-- Action 2 depends on Action 1 (Validated by fn_check_capa_dependency_cycle trigger)
INSERT INTO capa_action_dependencies (organization_id, action_id, depends_on_action_id)
VALUES ('a1b2c3d4-e5f6-7a8b-9c0d-1e2f3a4b5c6d', 'ca200000-0000-0000-0000-000000000001', 'ca100000-0000-0000-0000-000000000001')
ON CONFLICT DO NOTHING;

-- 7. AI Analysis & Isolated Suggestion
INSERT INTO ai_analyses (
    id, organization_id, entity_type, entity_id, model_provider, model_name, prompt_template_version, prompt_hash,
    input_tokens, output_tokens, latency_ms, raw_response_json, model_confidence_raw
) VALUES (
    'aa000000-0000-0000-0000-000000000001',
    'a1b2c3d4-e5f6-7a8b-9c0d-1e2f3a4b5c6d',
    'INCIDENT',
    'e1000000-0000-0000-0000-000000000001',
    'GOOGLE_VERTEX_AI',
    'gemini-1.5-pro-002',
    'v2.4.0',
    'd8578edf8458ce06fbc5bb76a58c5ca4ffb17e47df6063b78be68f9a35e40854',
    4280,
    384,
    1420,
    '{"recommendations": [{"type": "ROOT_CAUSE_HYPOTHESIS", "finding": "Capacitor ESR elevation under thermal reflow stress"}]}'::jsonb,
    0.942
) ON CONFLICT (id) DO NOTHING;

INSERT INTO ai_suggestions (
    id, organization_id, analysis_id, suggestion_type, structured_content, human_review_status
) VALUES (
    'ab000000-0000-0000-0000-000000000001',
    'a1b2c3d4-e5f6-7a8b-9c0d-1e2f3a4b5c6d',
    'aa000000-0000-0000-0000-000000000001',
    'ROOT_CAUSE_HYPOTHESIS',
    '{"hypothesis": "Investigate SMT reflow profile Zone 4 thermocouple calibration against IPC J-STD-020D specs."}'::jsonb,
    'ACCEPTED'
) ON CONFLICT (id) DO NOTHING;

INSERT INTO ai_human_feedback (
    id, organization_id, suggestion_id, user_id, disposition, edited_content, usefulness_score
) VALUES (
    'ac000000-0000-0000-0000-000000000001',
    'a1b2c3d4-e5f6-7a8b-9c0d-1e2f3a4b5c6d',
    'ab000000-0000-0000-0000-000000000001',
    '22222222-2222-2222-2222-222222222222',
    'ACCEPTED_AS_IS',
    NULL,
    5
) ON CONFLICT (id) DO NOTHING;

-- 8. Explicit 768-Dimension Embedding Seed (Compatible with vector or REAL[])
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM pg_type WHERE typname = 'vector') THEN
        INSERT INTO incident_embeddings (
            id, organization_id, incident_id, chunk_type, chunk_text, embedding_dimension, embedding, model_name
        ) VALUES (
            'ad000000-0000-0000-0000-000000000001',
            'a1b2c3d4-e5f6-7a8b-9c0d-1e2f3a4b5c6d',
            'e1000000-0000-0000-0000-000000000001',
            'FULL_NARRATIVE',
            'Premature battery impedance spike during RF telemetry session. Battery voltage dropped under RF load due to decoupling capacitor ESR elevation.',
            768,
            (SELECT array_agg(ROUND((sin(i::float) * 0.05)::numeric, 6))::text::vector FROM generate_series(1, 768) i),
            'text-embedding-004'
        ) ON CONFLICT (id) DO NOTHING;
    ELSE
        INSERT INTO incident_embeddings (
            id, organization_id, incident_id, chunk_type, chunk_text, embedding_dimension, embedding, model_name
        ) VALUES (
            'ad000000-0000-0000-0000-000000000001',
            'a1b2c3d4-e5f6-7a8b-9c0d-1e2f3a4b5c6d',
            'e1000000-0000-0000-0000-000000000001',
            'FULL_NARRATIVE',
            'Premature battery impedance spike during RF telemetry session. Battery voltage dropped under RF load due to decoupling capacitor ESR elevation.',
            768,
            (SELECT array_agg(ROUND((sin(i::float) * 0.05)::numeric, 6)::real) FROM generate_series(1, 768) i),
            'text-embedding-004'
        ) ON CONFLICT (id) DO NOTHING;
    END IF;
END $$;

-- 9. Atomic Audit Event (Trigger automatically advances audit_sequence_counters and generates SHA-256 hash)
INSERT INTO audit_events (
    organization_id, entity_name, entity_id, action, actor_id, correlation_id, reason_for_change, before_state, after_state, ip_address
) VALUES (
    'a1b2c3d4-e5f6-7a8b-9c0d-1e2f3a4b5c6d',
    'incidents',
    'e1000000-0000-0000-0000-000000000001',
    'STATUS_CHANGE',
    '22222222-2222-2222-2222-222222222222',
    'req_corr_884192',
    'Quarantine containment established; advancing incident status per SOP-QA-402',
    '{"status": "TRIAGED"}'::jsonb,
    '{"status": "CONTAINMENT_ACTIVE"}'::jsonb,
    '192.168.10.45'::inet
);

COMMIT;
