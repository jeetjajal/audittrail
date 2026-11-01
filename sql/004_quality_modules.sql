-- ============================================================================
-- AUDITTRAIL AI — MIGRATION 004: QUALITY MODULES (INCIDENTS, RCA, CAPA)
-- Version: 2.1.0
-- Tables: incidents, incident_devices, quarantine_records, incident_status_history,
--         investigations, rca_five_whys, rca_fishbone_nodes, root_causes,
--         capas, capa_actions, capa_action_dependencies, capa_effectiveness_reviews
-- ============================================================================

-- ============================================================================
-- MODULE 3: INCIDENT & NON-CONFORMANCE MANAGEMENT
-- ============================================================================

CREATE TABLE incidents (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE RESTRICT,
    incident_number VARCHAR(50) NOT NULL,
    title VARCHAR(255) NOT NULL,
    description TEXT NOT NULL,
    source VARCHAR(50) NOT NULL CHECK (source IN ('INTERNAL_AUDIT', 'CUSTOMER_COMPLAINT', 'PRODUCTION_LINE', 'SUPPLIER_NC', 'SERVICE_REPORT', 'CLINICAL_TRIAL')),
    severity VARCHAR(20) NOT NULL CHECK (severity IN ('NEGLIGIBLE', 'MINOR', 'MAJOR', 'CRITICAL')),
    status VARCHAR(30) NOT NULL DEFAULT 'DRAFT' CHECK (status IN (
        'DRAFT', 'SUBMITTED', 'TRIAGED', 'CONTAINMENT_ACTIVE', 'INVESTIGATING', 
        'RCA_REVIEW', 'CAPA_EVALUATION', 'CAPA_PENDING', 'APPROVAL_PENDING', 
        'CLOSED', 'REOPENED', 'CANCELLED'
    )),
    reported_by_id UUID NOT NULL,
    assigned_to_id UUID,
    occurrence_date TIMESTAMPTZ NOT NULL,
    is_mdr_reportable BOOLEAN NOT NULL DEFAULT FALSE,
    mdr_reportability_rationale TEXT,
    -- Strictly de-identified clinical outcome (HIPAA Safe Harbor / GDPR Recital 26)
    patient_impact_level VARCHAR(30) NOT NULL DEFAULT 'NO_PATIENT_IMPACT' 
        CHECK (patient_impact_level IN ('NO_PATIENT_IMPACT', 'MINOR_INJURY_TRANSIENT', 'SERIOUS_INJURY_REVERSIBLE', 'LIFE_THREATENING_PERMANENT', 'DEATH')),
    rpn_score SMALLINT CHECK (rpn_score BETWEEN 1 AND 1000),
    jira_issue_key VARCHAR(50),
    closed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_incidents_reporter FOREIGN KEY (organization_id, reported_by_id)
        REFERENCES users(organization_id, id) ON DELETE RESTRICT,
    CONSTRAINT fk_incidents_assignee FOREIGN KEY (organization_id, assigned_to_id)
        REFERENCES users(organization_id, id) ON DELETE RESTRICT,
    CONSTRAINT uq_incidents_org_num UNIQUE (organization_id, incident_number),
    CONSTRAINT uq_incidents_org_id UNIQUE (organization_id, id)
);

CREATE TRIGGER trg_incidents_updated_at
BEFORE UPDATE ON incidents
FOR EACH ROW EXECUTE FUNCTION fn_set_updated_at();

CREATE TABLE incident_devices (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL,
    incident_id UUID NOT NULL,
    device_id UUID NOT NULL,
    lot_id UUID,
    unit_id UUID,
    quantity_affected INTEGER NOT NULL DEFAULT 1 CHECK (quantity_affected > 0),
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_inc_dev_incident FOREIGN KEY (organization_id, incident_id)
        REFERENCES incidents(organization_id, id) ON DELETE CASCADE,
    CONSTRAINT fk_inc_dev_device FOREIGN KEY (organization_id, device_id)
        REFERENCES medical_devices(organization_id, id) ON DELETE RESTRICT,
    -- Composite FK guarantees lot matches device
    CONSTRAINT fk_inc_dev_lot FOREIGN KEY (organization_id, device_id, lot_id)
        REFERENCES device_lots(organization_id, device_id, id) ON DELETE RESTRICT,
    -- Composite FK guarantees unit matches device and lot
    CONSTRAINT fk_inc_dev_unit FOREIGN KEY (organization_id, device_id, lot_id, unit_id)
        REFERENCES device_units(organization_id, device_id, lot_id, id) ON DELETE RESTRICT,
    CONSTRAINT uq_incident_devices_org_id UNIQUE (organization_id, id)
);

CREATE TABLE quarantine_records (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL,
    incident_id UUID NOT NULL,
    lot_id UUID NOT NULL,
    quarantine_number VARCHAR(50) NOT NULL,
    quantity_quarantined INTEGER NOT NULL CHECK (quantity_quarantined > 0),
    quarantine_location VARCHAR(255) NOT NULL,
    reason TEXT NOT NULL,
    status VARCHAR(30) NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE', 'DISPOSITIONED_SCRAP', 'DISPOSITIONED_REWORK', 'RELEASED_CONFORMING')),
    quarantined_by_id UUID NOT NULL,
    dispositioned_by_id UUID,
    disposition_notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    dispositioned_at TIMESTAMPTZ,
    CONSTRAINT fk_quarantine_incident FOREIGN KEY (organization_id, incident_id)
        REFERENCES incidents(organization_id, id) ON DELETE RESTRICT,
    CONSTRAINT fk_quarantine_lot FOREIGN KEY (organization_id, lot_id)
        REFERENCES device_lots(organization_id, id) ON DELETE RESTRICT,
    CONSTRAINT fk_quarantine_user FOREIGN KEY (organization_id, quarantined_by_id)
        REFERENCES users(organization_id, id) ON DELETE RESTRICT,
    CONSTRAINT fk_quarantine_dispositioner FOREIGN KEY (organization_id, dispositioned_by_id)
        REFERENCES users(organization_id, id) ON DELETE RESTRICT,
    CONSTRAINT uq_quarantine_org_id UNIQUE (organization_id, id)
);

CREATE TABLE incident_status_history (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL,
    incident_id UUID NOT NULL,
    from_status VARCHAR(30) NOT NULL,
    to_status VARCHAR(30) NOT NULL,
    changed_by_id UUID NOT NULL,
    reason_for_change TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_inc_status_incident FOREIGN KEY (organization_id, incident_id)
        REFERENCES incidents(organization_id, id) ON DELETE CASCADE,
    CONSTRAINT fk_inc_status_user FOREIGN KEY (organization_id, changed_by_id)
        REFERENCES users(organization_id, id) ON DELETE RESTRICT,
    CONSTRAINT uq_incident_status_org_id UNIQUE (organization_id, id)
);

-- ============================================================================
-- MODULE 4: INVESTIGATION & ROOT CAUSE ANALYSIS (RCA)
-- ============================================================================

CREATE TABLE investigations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL,
    incident_id UUID NOT NULL,
    lead_investigator_id UUID NOT NULL,
    methodology VARCHAR(50) NOT NULL DEFAULT 'HYBRID' CHECK (methodology IN ('FIVE_WHYS', 'FISHBONE', 'HYBRID', 'FAULT_TREE')),
    methodology_version VARCHAR(20) NOT NULL DEFAULT '1.0',
    summary TEXT,
    containment_actions TEXT,
    status VARCHAR(30) NOT NULL DEFAULT 'IN_PROGRESS' CHECK (status IN ('IN_PROGRESS', 'PENDING_REVIEW', 'APPROVED', 'REJECTED')),
    started_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    completed_at TIMESTAMPTZ,
    CONSTRAINT fk_investigations_incident FOREIGN KEY (organization_id, incident_id)
        REFERENCES incidents(organization_id, id) ON DELETE RESTRICT,
    CONSTRAINT fk_investigations_lead FOREIGN KEY (organization_id, lead_investigator_id)
        REFERENCES users(organization_id, id) ON DELETE RESTRICT,
    CONSTRAINT uq_investigations_org_incident UNIQUE (organization_id, incident_id),
    CONSTRAINT uq_investigations_org_id UNIQUE (organization_id, id)
);

CREATE TABLE rca_five_whys (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL,
    investigation_id UUID NOT NULL,
    step_number SMALLINT NOT NULL CHECK (step_number BETWEEN 1 AND 10),
    why_question TEXT NOT NULL,
    answer TEXT NOT NULL,
    evidence_document_id UUID,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_five_whys_investigation FOREIGN KEY (organization_id, investigation_id)
        REFERENCES investigations(organization_id, id) ON DELETE CASCADE,
    CONSTRAINT uq_five_whys_step UNIQUE (organization_id, investigation_id, step_number),
    CONSTRAINT uq_rca_five_whys_org_id UNIQUE (organization_id, id)
);

CREATE TABLE rca_fishbone_nodes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL,
    investigation_id UUID NOT NULL,
    category VARCHAR(30) NOT NULL CHECK (category IN ('MAN', 'MACHINE', 'MATERIAL', 'METHOD', 'MEASUREMENT', 'ENVIRONMENT')),
    factor VARCHAR(255) NOT NULL,
    is_primary_cause BOOLEAN NOT NULL DEFAULT FALSE,
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_fishbone_investigation FOREIGN KEY (organization_id, investigation_id)
        REFERENCES investigations(organization_id, id) ON DELETE CASCADE,
    CONSTRAINT uq_rca_fishbone_org_id UNIQUE (organization_id, id)
);

CREATE TABLE root_causes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL,
    investigation_id UUID NOT NULL,
    statement TEXT NOT NULL,
    category VARCHAR(50) NOT NULL,
    verification_method TEXT NOT NULL,
    is_verified BOOLEAN NOT NULL DEFAULT FALSE,
    verified_by_id UUID,
    verified_at TIMESTAMPTZ,
    verification_evidence_id UUID,
    rejected_reason TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_root_causes_investigation FOREIGN KEY (organization_id, investigation_id)
        REFERENCES investigations(organization_id, id) ON DELETE CASCADE,
    CONSTRAINT fk_root_causes_verifier FOREIGN KEY (organization_id, verified_by_id)
        REFERENCES users(organization_id, id) ON DELETE RESTRICT,
    CONSTRAINT uq_root_causes_org_id UNIQUE (organization_id, id)
);

-- ============================================================================
-- MODULE 5: CAPA MANAGEMENT & DEPENDENCY GRAPH ENGINE
-- ============================================================================

CREATE TABLE capas (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE RESTRICT,
    capa_number VARCHAR(50) NOT NULL,
    incident_id UUID,
    investigation_id UUID,
    capa_type VARCHAR(30) NOT NULL CHECK (capa_type IN ('CORRECTIVE', 'PREVENTIVE')),
    title VARCHAR(255) NOT NULL,
    problem_statement TEXT NOT NULL,
    status VARCHAR(30) NOT NULL DEFAULT 'OPEN' CHECK (status IN (
        'OPEN', 'ACTION_PLANNING', 'IMPLEMENTATION', 'VERIFICATION_PENDING', 
        'EFFECTIVENESS_REVIEW', 'CLOSED', 'CANCELLED', 'REOPENED'
    )),
    risk_level VARCHAR(20) NOT NULL CHECK (risk_level IN ('LOW', 'MEDIUM', 'HIGH', 'CRITICAL')),
    owner_id UUID NOT NULL,
    due_date DATE NOT NULL,
    closed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_capas_incident FOREIGN KEY (organization_id, incident_id)
        REFERENCES incidents(organization_id, id) ON DELETE RESTRICT,
    CONSTRAINT fk_capas_investigation FOREIGN KEY (organization_id, investigation_id)
        REFERENCES investigations(organization_id, id) ON DELETE RESTRICT,
    CONSTRAINT fk_capas_owner FOREIGN KEY (organization_id, owner_id)
        REFERENCES users(organization_id, id) ON DELETE RESTRICT,
    CONSTRAINT uq_capas_org_num UNIQUE (organization_id, capa_number),
    CONSTRAINT uq_capas_org_id UNIQUE (organization_id, id)
);

CREATE TRIGGER trg_capas_updated_at
BEFORE UPDATE ON capas
FOR EACH ROW EXECUTE FUNCTION fn_set_updated_at();

CREATE TABLE capa_actions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL,
    capa_id UUID NOT NULL,
    action_number SMALLINT NOT NULL,
    action_type VARCHAR(50) NOT NULL CHECK (action_type IN (
        'PROCESS_CHANGE', 'DMR_REVISION', 'RETRAINING', 'SUPPLIER_SCAR', 
        'DEVICE_RECALL', 'DESIGN_CHANGE', 'SOFTWARE_PATCH'
    )),
    description TEXT NOT NULL,
    assignee_id UUID NOT NULL,
    due_date DATE NOT NULL,
    status VARCHAR(30) NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'IN_PROGRESS', 'COMPLETED', 'VERIFIED', 'SUPERSEDED')),
    completion_notes TEXT,
    completed_at TIMESTAMPTZ,
    verified_by_id UUID,
    verified_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_capa_actions_capa FOREIGN KEY (organization_id, capa_id)
        REFERENCES capas(organization_id, id) ON DELETE CASCADE,
    CONSTRAINT fk_capa_actions_assignee FOREIGN KEY (organization_id, assignee_id)
        REFERENCES users(organization_id, id) ON DELETE RESTRICT,
    CONSTRAINT fk_capa_actions_verifier FOREIGN KEY (organization_id, verified_by_id)
        REFERENCES users(organization_id, id) ON DELETE RESTRICT,
    CONSTRAINT uq_capa_actions_step UNIQUE (organization_id, capa_id, action_number),
    CONSTRAINT uq_capa_actions_org_id UNIQUE (organization_id, id)
);

CREATE TABLE capa_action_dependencies (
    organization_id UUID NOT NULL,
    action_id UUID NOT NULL,
    depends_on_action_id UUID NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (action_id, depends_on_action_id),
    CONSTRAINT fk_dep_action FOREIGN KEY (organization_id, action_id)
        REFERENCES capa_actions(organization_id, id) ON DELETE CASCADE,
    CONSTRAINT fk_dep_prereq FOREIGN KEY (organization_id, depends_on_action_id)
        REFERENCES capa_actions(organization_id, id) ON DELETE CASCADE,
    CONSTRAINT chk_no_self_dependency CHECK (action_id != depends_on_action_id)
);

-- Trigger to detect cyclic dependencies in CAPA actions (A -> B -> A)
CREATE OR REPLACE FUNCTION fn_check_capa_dependency_cycle()
RETURNS TRIGGER AS $$
DECLARE
    v_cycle_detected BOOLEAN := FALSE;
BEGIN
    WITH RECURSIVE dependency_chain AS (
        SELECT depends_on_action_id AS current_action, 1 AS depth
        FROM capa_action_dependencies
        WHERE action_id = NEW.depends_on_action_id
          AND organization_id = NEW.organization_id

        UNION ALL

        SELECT d.depends_on_action_id, dc.depth + 1
        FROM capa_action_dependencies d
        JOIN dependency_chain dc ON d.action_id = dc.current_action
        WHERE d.organization_id = NEW.organization_id
          AND dc.depth < 50
    )
    SELECT TRUE INTO v_cycle_detected
    FROM dependency_chain
    WHERE current_action = NEW.action_id
    LIMIT 1;

    IF v_cycle_detected THEN
        RAISE EXCEPTION 'CYCLIC_DEPENDENCY_DETECTED: Action % already depends transitively on Action %',
            NEW.action_id, NEW.depends_on_action_id;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_capa_cycle_detector
BEFORE INSERT OR UPDATE ON capa_action_dependencies
FOR EACH ROW EXECUTE FUNCTION fn_check_capa_dependency_cycle();

CREATE TABLE capa_effectiveness_reviews (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL,
    capa_id UUID NOT NULL,
    review_period_days INTEGER NOT NULL DEFAULT 90 CHECK (review_period_days > 0),
    acceptance_criteria TEXT NOT NULL,
    scheduled_date DATE NOT NULL,
    evaluated_at TIMESTAMPTZ,
    evaluator_id UUID,
    is_effective BOOLEAN,
    unsuccessful_action_plan TEXT, -- Mandated if is_effective = FALSE
    evidence_summary TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_eff_review_capa FOREIGN KEY (organization_id, capa_id)
        REFERENCES capas(organization_id, id) ON DELETE CASCADE,
    CONSTRAINT fk_eff_review_evaluator FOREIGN KEY (organization_id, evaluator_id)
        REFERENCES users(organization_id, id) ON DELETE RESTRICT,
    CONSTRAINT uq_capa_eff_org_id UNIQUE (organization_id, id)
);
