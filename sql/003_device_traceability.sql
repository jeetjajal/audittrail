-- ============================================================================
-- AUDITTRAIL AI — MIGRATION 003: MEDICAL DEVICE TRACEABILITY (MODULE 2)
-- Version: 2.1.0
-- Tables: medical_devices, regulatory_approvals, device_lots, device_units
-- ============================================================================

CREATE TABLE medical_devices (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE RESTRICT,
    udi_di VARCHAR(100) NOT NULL, -- GS1 GTIN or HIBCC
    model_number VARCHAR(100) NOT NULL,
    device_name VARCHAR(255) NOT NULL,
    device_type VARCHAR(50) NOT NULL CHECK (device_type IN ('HARDWARE', 'SOFTWARE_SAMD', 'HYBRID', 'DISPOSABLE')),
    fda_risk_class VARCHAR(20) NOT NULL CHECK (fda_risk_class IN ('CLASS_I', 'CLASS_II', 'CLASS_III', 'UNCLASSIFIED')),
    eu_mdr_risk_class VARCHAR(20) NOT NULL CHECK (eu_mdr_risk_class IN ('CLASS_I', 'CLASS_IIA', 'CLASS_IIB', 'CLASS_III')),
    gmdn_code VARCHAR(50),
    is_implantable BOOLEAN NOT NULL DEFAULT FALSE,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT uq_devices_org_udi UNIQUE (organization_id, udi_di),
    CONSTRAINT uq_devices_org_id UNIQUE (organization_id, id)
);

CREATE TRIGGER trg_medical_devices_updated_at
BEFORE UPDATE ON medical_devices
FOR EACH ROW EXECUTE FUNCTION fn_set_updated_at();

CREATE TABLE regulatory_approvals (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL,
    device_id UUID NOT NULL,
    jurisdiction VARCHAR(50) NOT NULL CHECK (jurisdiction IN ('US_FDA', 'EU_MDR', 'HEALTH_CANADA', 'PMDA_JAPAN', 'TGA_AUSTRALIA')),
    clearance_type VARCHAR(50) NOT NULL CHECK (clearance_type IN ('FDA_510K', 'FDA_PMA', 'FDA_DE_NOVO', 'CE_MARK', 'MDL')),
    clearance_identifier VARCHAR(100) NOT NULL,
    granted_date DATE NOT NULL,
    valid_until DATE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_regulatory_device FOREIGN KEY (organization_id, device_id)
        REFERENCES medical_devices(organization_id, id) ON DELETE RESTRICT,
    CONSTRAINT uq_regulatory_org_id UNIQUE (organization_id, id)
);

CREATE TABLE device_lots (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL,
    device_id UUID NOT NULL,
    lot_batch_number VARCHAR(100) NOT NULL,
    manufacturing_date DATE NOT NULL,
    expiry_date DATE,
    batch_size INTEGER NOT NULL CHECK (batch_size > 0),
    sterilization_lot VARCHAR(100),
    sterilization_method VARCHAR(50) CHECK (sterilization_method IN ('ETO', 'GAMMA', 'E_BEAM', 'STEAM', 'ASEPTIC', 'NON_STERILE')),
    is_released BOOLEAN NOT NULL DEFAULT FALSE,
    released_by_id UUID,
    released_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_device_lots_device FOREIGN KEY (organization_id, device_id)
        REFERENCES medical_devices(organization_id, id) ON DELETE RESTRICT,
    CONSTRAINT fk_device_lots_releaser FOREIGN KEY (organization_id, released_by_id)
        REFERENCES users(organization_id, id) ON DELETE RESTRICT,
    CONSTRAINT chk_lot_dates CHECK (expiry_date IS NULL OR expiry_date >= manufacturing_date),
    CONSTRAINT uq_device_lots_org_batch UNIQUE (organization_id, device_id, lot_batch_number),
    CONSTRAINT uq_device_lots_composite UNIQUE (organization_id, device_id, id),
    CONSTRAINT uq_device_lots_org_id UNIQUE (organization_id, id)
);

CREATE TABLE device_units (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL,
    device_id UUID NOT NULL,
    lot_id UUID NOT NULL,
    serial_number VARCHAR(100) NOT NULL,
    manufactured_at TIMESTAMPTZ NOT NULL,
    current_status VARCHAR(30) NOT NULL DEFAULT 'IN_INVENTORY' 
        CHECK (current_status IN ('IN_INVENTORY', 'DISTRIBUTED', 'IMPLANTED', 'RETURNED', 'QUARANTINED', 'SCRAPPED')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    -- Composite FK guarantees unit belongs to the exact device and lot
    CONSTRAINT fk_device_units_lot_composite FOREIGN KEY (organization_id, device_id, lot_id)
        REFERENCES device_lots(organization_id, device_id, id) ON DELETE RESTRICT,
    CONSTRAINT uq_device_units_serial UNIQUE (organization_id, device_id, serial_number),
    CONSTRAINT uq_device_units_composite UNIQUE (organization_id, device_id, lot_id, id),
    CONSTRAINT uq_device_units_org_id UNIQUE (organization_id, id)
);
