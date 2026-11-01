export type IncidentSeverity = 'NEGLIGIBLE' | 'MINOR' | 'MAJOR' | 'CRITICAL';
export type IncidentStatus = 
  | 'DRAFT' | 'SUBMITTED' | 'TRIAGED' | 'CONTAINMENT_ACTIVE' 
  | 'INVESTIGATING' | 'RCA_REVIEW' | 'CAPA_EVALUATION' 
  | 'CAPA_PENDING' | 'APPROVAL_PENDING' | 'CLOSED' | 'REOPENED' | 'CANCELLED';

export interface Incident {
  id: string;
  incident_number: string;
  title: string;
  description: string;
  source: string;
  severity: IncidentSeverity;
  status: IncidentStatus;
  occurrence_date: string;
  is_mdr_reportable: boolean;
  mdr_reportability_rationale?: string;
  patient_impact_level: string;
  rpn_score?: number;
  jira_issue_key?: string;
  reported_by_name?: string;
  assigned_to_name?: string;
  created_at: string;
  devices?: IncidentDevice[];
  statusHistory?: StatusHistoryItem[];
  quarantineRecords?: QuarantineRecord[];
  investigations?: Investigation[];
}

export interface IncidentDevice {
  id: string;
  device_id: string;
  device_model: string;
  udi_di: string;
  classification: string;
  lot_number?: string;
  serial_number?: string;
  current_quarantine_status?: string;
  quantity_affected: number;
}

export interface StatusHistoryItem {
  id: string;
  from_status: string;
  to_status: string;
  reason_for_change: string;
  changed_by_name: string;
  created_at: string;
}

export interface QuarantineRecord {
  id: string;
  quarantine_number: string;
  lot_number: string;
  quantity_quarantined: number;
  quarantine_location: string;
  reason: string;
  status: 'ACTIVE' | 'DISPOSITIONED_SCRAP' | 'DISPOSITIONED_REWORK' | 'RELEASED_CONFORMING';
  quarantined_by_name: string;
  created_at: string;
}

export interface Investigation {
  id: string;
  incident_id: string;
  incident_number?: string;
  incident_title?: string;
  lead_investigator_name: string;
  lead_investigator_email?: string;
  methodology: 'FIVE_WHYS' | 'FISHBONE' | 'HYBRID' | 'FAULT_TREE';
  summary: string;
  containment_actions?: string;
  status: 'IN_PROGRESS' | 'PENDING_REVIEW' | 'APPROVED' | 'REJECTED';
  started_at: string;
  completed_at?: string;
  fiveWhys?: FiveWhysStep[];
  fishboneNodes?: FishboneNode[];
  rootCauses?: RootCause[];
}

export interface FiveWhysStep {
  id: string;
  step_number: number;
  why_question: string;
  answer: string;
  created_at: string;
}

export interface FishboneNode {
  id: string;
  category: 'MAN' | 'MACHINE' | 'MATERIAL' | 'METHOD' | 'MEASUREMENT' | 'ENVIRONMENT';
  factor: string;
  is_primary_cause: boolean;
  notes?: string;
}

export interface RootCause {
  id: string;
  statement: string;
  category: string;
  verification_method: string;
  is_verified: boolean;
  verified_by_name?: string;
  verified_at?: string;
}

export type CapaType = 'CORRECTIVE' | 'PREVENTIVE';
export type CapaStatus = 'OPEN' | 'ACTION_PLANNING' | 'IMPLEMENTATION' | 'VERIFICATION_PENDING' | 'EFFECTIVENESS_REVIEW' | 'CLOSED' | 'CANCELLED';
export type CapaRisk = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';

export interface CAPA {
  id: string;
  capa_number: string;
  title: string;
  problem_statement: string;
  capa_type: CapaType;
  status: CapaStatus;
  risk_level: CapaRisk;
  owner_name: string;
  owner_email?: string;
  due_date: string;
  created_at: string;
  closed_at?: string;
  incident_number?: string;
  incident_title?: string;
  actions?: CAPAAction[];
  dependencies?: Array<{ action_id: string; depends_on_action_id: string; action_number: number; depends_on_action_number: number }>;
  effectivenessReviews?: EffectivenessReview[];
}

export interface CAPAAction {
  id: string;
  action_number: number;
  action_type: string;
  description: string;
  assignee_name: string;
  due_date: string;
  status: 'PENDING' | 'IN_PROGRESS' | 'COMPLETED' | 'VERIFIED' | 'SUPERSEDED';
  completion_notes?: string;
  verified_by_name?: string;
  completed_at?: string;
  verified_at?: string;
}

export interface EffectivenessReview {
  id: string;
  review_period_days: number;
  acceptance_criteria: string;
  scheduled_date: string;
  evaluated_at?: string;
  evaluator_name?: string;
  is_effective?: boolean;
  evidence_summary?: string;
  unsuccessful_action_plan?: string;
}

export interface ControlledDocument {
  id: string;
  document_code: string;
  title: string;
  classification: 'EVIDENCE' | 'DHF_RECORD' | 'SOP' | 'AUDIT_PACKAGE' | 'VALIDATION_REPORT';
  current_version_number: number;
  active_file_name?: string;
  active_sha256?: string;
  active_mime_type?: string;
  active_s3_uri?: string;
  is_locked: boolean;
  created_at: string;
  versions?: DocumentVersion[];
}

export interface DocumentVersion {
  id: string;
  version_number: number;
  file_name: string;
  storage_s3_uri: string;
  sha256_checksum: string;
  mime_type: string;
  file_size_bytes: number;
  virus_scan_status: string;
  retention_expiration_date: string;
  uploaded_by_name: string;
  created_at: string;
}

export interface ApprovalStep {
  step_id: string;
  step_order: number;
  step_name: string;
  step_status: string;
  workflow_id: string;
  entity_type: string;
  entity_id: string;
  workflow_type: string;
  workflow_created_at: string;
  required_role_name: string;
}

export interface AuditEvent {
  id: string;
  sequence_number: number;
  entity_name: string;
  entity_id: string;
  action: string;
  actor_name?: string;
  actor_email?: string;
  reason_for_change: string;
  previous_event_hash: string;
  event_hash: string;
  before_state?: Record<string, unknown>;
  after_state?: Record<string, unknown>;
  created_at: string;
}

export interface AiSuggestion {
  id: string;
  suggestion_type: string;
  structured_content: {
    statement?: string;
    category?: string;
    confidenceScore?: number;
    recommendedVerificationMethod?: string;
    rationale?: string;
  };
  human_review_status: 'PENDING_REVIEW' | 'ACCEPTED' | 'REJECTED' | 'MODIFIED';
  created_at: string;
}
