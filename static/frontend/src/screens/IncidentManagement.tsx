import React, { useEffect, useState } from 'react';
import { StatusBadge, Modal } from '../components/Common';
import { ScreenId } from '../components/Layout';
import { ApiClient } from '../services/api';
import { Incident, IncidentSeverity, IncidentStatus } from '../types';

interface IncidentManagementProps {
  onNavigate: (screen: ScreenId, entityId?: string) => void;
}

export const IncidentManagement: React.FC<IncidentManagementProps> = ({ onNavigate }) => {
  const [incidents, setIncidents] = useState<Incident[]>([]);
  const [loading, setLoading] = useState(true);
  const [severityFilter, setSeverityFilter] = useState<string>('ALL');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);

  // New Incident Form State
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    source: 'PRODUCTION_LINE',
    severity: 'MAJOR' as IncidentSeverity,
    occurrenceDate: new Date().toISOString().split('T')[0],
    isMdrReportable: false,
    mdrRationale: '',
    patientImpactLevel: 'NO_PATIENT_IMPACT',
    rpnScore: 180,
    deviceId: 'd1000000-0000-0000-0000-000000000001',
    lotId: 'l1000000-0000-0000-0000-000000000001',
    quantityAffected: 1,
  });

  async function loadIncidents() {
    setLoading(true);
    try {
      const res = await ApiClient.getIncidents();
      setIncidents(res.items || []);
    } catch (err) {
      console.error('Failed to load incidents', err);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadIncidents();
  }, []);

  async function handleCreateIncident(e: React.FormEvent) {
    e.preventDefault();
    try {
      await ApiClient.createIncident({
        title: formData.title,
        description: formData.description,
        source: formData.source,
        severity: formData.severity,
        occurrenceDate: formData.occurrenceDate,
        isMdrReportable: formData.isMdrReportable,
        mdrRationale: formData.mdrRationale,
        patientImpactLevel: formData.patientImpactLevel,
        rpnScore: formData.rpnScore,
        devices: [
          {
            deviceId: formData.deviceId,
            lotId: formData.lotId,
            quantityAffected: formData.quantityAffected,
          },
        ],
      });
      setIsModalOpen(false);
      loadIncidents();
    } catch (err) {
      alert(`Failed to create incident: ${(err as Error).message}`);
    }
  }

  const filteredIncidents = incidents.filter((inc) => {
    const matchesSeverity = severityFilter === 'ALL' || inc.severity === severityFilter;
    const matchesStatus = statusFilter === 'ALL' || inc.status === statusFilter;
    const matchesSearch =
      searchQuery === '' ||
      inc.incident_number.toLowerCase().includes(searchQuery.toLowerCase()) ||
      inc.title.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesSeverity && matchesStatus && matchesSearch;
  });

  return (
    <div>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
        <div>
          <h1 style={{ fontSize: '24px', fontWeight: 700, color: '#172B4D', margin: '0 0 6px 0' }}>
            Quality Incident & Non-Conformance Registry
          </h1>
          <div style={{ fontSize: '13px', color: '#6B778C' }}>
            Track, triage, and contain clinical non-conformances per FDA QMSR 21 CFR § 820.65 and ISO 13485:2016.
          </div>
        </div>
        <button
          onClick={() => setIsModalOpen(true)}
          style={{
            backgroundColor: '#0052CC',
            color: '#FFFFFF',
            border: 'none',
            padding: '8px 16px',
            borderRadius: '4px',
            fontWeight: 600,
            cursor: 'pointer',
          }}
        >
          + Log New Incident
        </button>
      </div>

      {/* Filter Toolbar */}
      <div
        style={{
          backgroundColor: '#FFFFFF',
          padding: '12px 16px',
          borderRadius: '6px',
          border: '1px solid #DFE1E6',
          display: 'flex',
          gap: '16px',
          alignItems: 'center',
          marginBottom: '16px',
        }}
      >
        <input
          type="text"
          placeholder="Search by incident # or title..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          style={{
            padding: '8px 12px',
            borderRadius: '4px',
            border: '1px solid #DFE1E6',
            width: '280px',
            fontSize: '13px',
          }}
        />

        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px' }}>
          <span style={{ color: '#6B778C', fontWeight: 600 }}>Severity:</span>
          <select
            value={severityFilter}
            onChange={(e) => setSeverityFilter(e.target.value)}
            style={{ padding: '6px 10px', borderRadius: '4px', border: '1px solid #DFE1E6', fontSize: '13px' }}
          >
            <option value="ALL">All Severities</option>
            <option value="CRITICAL">Critical</option>
            <option value="MAJOR">Major</option>
            <option value="MINOR">Minor</option>
            <option value="NEGLIGIBLE">Negligible</option>
          </select>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px' }}>
          <span style={{ color: '#6B778C', fontWeight: 600 }}>Status:</span>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            style={{ padding: '6px 10px', borderRadius: '4px', border: '1px solid #DFE1E6', fontSize: '13px' }}
          >
            <option value="ALL">All Statuses</option>
            <option value="SUBMITTED">Submitted</option>
            <option value="CONTAINMENT_ACTIVE">Containment Active</option>
            <option value="INVESTIGATING">Investigating</option>
            <option value="CLOSED">Closed</option>
          </select>
        </div>

        <div style={{ marginLeft: 'auto', fontSize: '13px', color: '#6B778C' }}>
          Showing <strong>{filteredIncidents.length}</strong> incidents
        </div>
      </div>

      {/* Incident Table */}
      <div style={{ backgroundColor: '#FFFFFF', borderRadius: '6px', border: '1px solid #DFE1E6', overflow: 'hidden' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
          <thead>
            <tr style={{ backgroundColor: '#F4F5F7', borderBottom: '2px solid #EBECF0', textAlign: 'left', color: '#6B778C' }}>
              <th style={{ padding: '10px 16px' }}>Incident Number</th>
              <th style={{ padding: '10px 16px' }}>Title</th>
              <th style={{ padding: '10px 16px' }}>Severity</th>
              <th style={{ padding: '10px 16px' }}>Status</th>
              <th style={{ padding: '10px 16px' }}>RPN</th>
              <th style={{ padding: '10px 16px' }}>MDR Flag</th>
              <th style={{ padding: '10px 16px' }}>Occurrence Date</th>
              <th style={{ padding: '10px 16px' }}>Assigned To</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={8} style={{ padding: '24px', textAlign: 'center', color: '#6B778C' }}>
                  Loading clinical quality incidents...
                </td>
              </tr>
            ) : filteredIncidents.length === 0 ? (
              <tr>
                <td colSpan={8} style={{ padding: '24px', textAlign: 'center', color: '#6B778C' }}>
                  No incidents matching your filter criteria.
                </td>
              </tr>
            ) : (
              filteredIncidents.map((inc) => (
                <tr
                  key={inc.id}
                  onClick={() => onNavigate('incident-details', inc.id)}
                  style={{
                    borderBottom: '1px solid #EBECF0',
                    cursor: 'pointer',
                    transition: 'background-color 0.1s',
                  }}
                  onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = '#F4F5F7')}
                  onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = '#FFFFFF')}
                >
                  <td style={{ padding: '12px 16px', fontWeight: 600, color: '#0052CC' }}>{inc.incident_number}</td>
                  <td style={{ padding: '12px 16px', maxWidth: '320px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontWeight: 500 }}>
                    {inc.title}
                  </td>
                  <td style={{ padding: '12px 16px' }}>
                    <StatusBadge type="severity" value={inc.severity} />
                  </td>
                  <td style={{ padding: '12px 16px' }}>
                    <StatusBadge type="status" value={inc.status} />
                  </td>
                  <td style={{ padding: '12px 16px', fontWeight: 600 }}>{inc.rpn_score || 'N/A'}</td>
                  <td style={{ padding: '12px 16px' }}>
                    {inc.is_mdr_reportable ? (
                      <span style={{ color: '#DE350B', fontWeight: 700, fontSize: '11px', backgroundColor: '#FFEBE6', padding: '2px 6px', borderRadius: '3px' }}>
                        MDR REPORTABLE
                      </span>
                    ) : (
                      <span style={{ color: '#6B778C', fontSize: '12px' }}>Non-MDR</span>
                    )}
                  </td>
                  <td style={{ padding: '12px 16px', color: '#6B778C' }}>
                    {new Date(inc.occurrence_date).toLocaleDateString()}
                  </td>
                  <td style={{ padding: '12px 16px', color: '#172B4D' }}>
                    {inc.assigned_to_name || <span style={{ color: '#8993A4', fontStyle: 'italic' }}>Unassigned</span>}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Modal: Log New Incident */}
      <Modal isOpen={isModalOpen} title="Intake New Quality Incident" onClose={() => setIsModalOpen(false)} width="650px">
        <form onSubmit={handleCreateIncident} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div>
            <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#172B4D', marginBottom: '4px' }}>
              Incident Title *
            </label>
            <input
              type="text"
              required
              value={formData.title}
              onChange={(e) => setFormData({ ...formData, title: e.target.value })}
              placeholder="e.g. Telemetry RF communication loss during pacing check"
              style={{ width: '100%', padding: '8px 12px', borderRadius: '4px', border: '1px solid #DFE1E6', fontSize: '13px' }}
            />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
            <div>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#172B4D', marginBottom: '4px' }}>
                Severity Level *
              </label>
              <select
                value={formData.severity}
                onChange={(e) => setFormData({ ...formData, severity: e.target.value as IncidentSeverity })}
                style={{ width: '100%', padding: '8px 12px', borderRadius: '4px', border: '1px solid #DFE1E6', fontSize: '13px' }}
              >
                <option value="CRITICAL">Critical (Direct Patient Risk / Device Malfunction)</option>
                <option value="MAJOR">Major (Performance Degradation)</option>
                <option value="MINOR">Minor (Cosmetic / Packaging Defect)</option>
                <option value="NEGLIGIBLE">Negligible</option>
              </select>
            </div>
            <div>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#172B4D', marginBottom: '4px' }}>
                Source Channel *
              </label>
              <select
                value={formData.source}
                onChange={(e) => setFormData({ ...formData, source: e.target.value })}
                style={{ width: '100%', padding: '8px 12px', borderRadius: '4px', border: '1px solid #DFE1E6', fontSize: '13px' }}
              >
                <option value="CUSTOMER_COMPLAINT">Customer Complaint (Clinical)</option>
                <option value="PRODUCTION_LINE">Production Cleanroom Line</option>
                <option value="INTERNAL_AUDIT">Internal Quality Audit</option>
                <option value="SERVICE_REPORT">Field Service Report</option>
              </select>
            </div>
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#172B4D', marginBottom: '4px' }}>
              Detailed Clinical / Non-Conformance Description *
            </label>
            <textarea
              required
              rows={4}
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              placeholder="Provide objective clinical evidence and manufacturing observation details..."
              style={{ width: '100%', padding: '8px 12px', borderRadius: '4px', border: '1px solid #DFE1E6', fontSize: '13px' }}
            />
          </div>

          <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
            <input
              type="checkbox"
              id="mdrCheck"
              checked={formData.isMdrReportable}
              onChange={(e) => setFormData({ ...formData, isMdrReportable: e.target.checked })}
            />
            <label htmlFor="mdrCheck" style={{ fontSize: '13px', fontWeight: 600, color: '#172B4D' }}>
              Potential Medical Device Reportable (FDA 21 CFR Part 803 / EU MDR Article 87)
            </label>
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', marginTop: '16px' }}>
            <button
              type="button"
              onClick={() => setIsModalOpen(false)}
              style={{ padding: '8px 16px', borderRadius: '4px', border: '1px solid #DFE1E6', backgroundColor: '#FFFFFF', cursor: 'pointer' }}
            >
              Cancel
            </button>
            <button
              type="submit"
              style={{ padding: '8px 16px', borderRadius: '4px', border: 'none', backgroundColor: '#0052CC', color: '#FFFFFF', fontWeight: 600, cursor: 'pointer' }}
            >
              Submit Incident Intake
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
