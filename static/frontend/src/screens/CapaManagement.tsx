import React, { useEffect, useState } from 'react';
import { StatusBadge, Modal } from '../components/Common';
import { ScreenId } from '../components/Layout';
import { ApiClient } from '../services/api';
import { CAPA, CapaType, CapaRisk } from '../types';

interface CapaManagementProps {
  onNavigate: (screen: ScreenId, entityId?: string) => void;
}

export const CapaManagement: React.FC<CapaManagementProps> = ({ onNavigate }) => {
  const [capas, setCapas] = useState<CAPA[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);

  const [formData, setFormData] = useState({
    title: '',
    problemStatement: '',
    capaType: 'CORRECTIVE' as CapaType,
    riskLevel: 'HIGH' as CapaRisk,
    dueDate: new Date(Date.now() + 60 * 24 * 3600 * 1000).toISOString().split('T')[0],
  });

  async function loadCapas() {
    setLoading(true);
    try {
      const res = await ApiClient.getCapas();
      setCapas(res.items || []);
    } catch (err) {
      console.error('Failed to load CAPA programs', err);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadCapas();
  }, []);

  async function handleCreateCapa(e: React.FormEvent) {
    e.preventDefault();
    try {
      await ApiClient.createCapa(formData);
      setIsModalOpen(false);
      setFormData({
        title: '',
        problemStatement: '',
        capaType: 'CORRECTIVE',
        riskLevel: 'HIGH',
        dueDate: new Date(Date.now() + 60 * 24 * 3600 * 1000).toISOString().split('T')[0],
      });
      loadCapas();
    } catch (err) {
      alert(`Failed to create CAPA: ${(err as Error).message}`);
    }
  }

  const filtered = capas.filter((c) => {
    const matchesStatus = statusFilter === 'ALL' || c.status === statusFilter;
    const matchesSearch =
      searchQuery === '' ||
      c.capa_number.toLowerCase().includes(searchQuery.toLowerCase()) ||
      c.title.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesStatus && matchesSearch;
  });

  return (
    <div>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
        <div>
          <h1 style={{ fontSize: '24px', fontWeight: 700, color: '#172B4D', margin: '0 0 6px 0' }}>
            CAPA Management Registry (21 CFR § 820.100)
          </h1>
          <div style={{ fontSize: '13px', color: '#6B778C' }}>
            Corrective and Preventive Action programs with DAG dependency verification and quantitative effectiveness gates.
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
          + Initiate New CAPA
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
          placeholder="Search by CAPA # or title..."
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
          <span style={{ color: '#6B778C', fontWeight: 600 }}>Status:</span>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            style={{ padding: '6px 10px', borderRadius: '4px', border: '1px solid #DFE1E6', fontSize: '13px' }}
          >
            <option value="ALL">All Statuses</option>
            <option value="OPEN">Open</option>
            <option value="ACTION_PLANNING">Action Planning</option>
            <option value="IMPLEMENTATION">Implementation</option>
            <option value="EFFECTIVENESS_REVIEW">Effectiveness Review</option>
            <option value="CLOSED">Closed</option>
          </select>
        </div>

        <div style={{ marginLeft: 'auto', fontSize: '13px', color: '#6B778C' }}>
          Showing <strong>{filtered.length}</strong> CAPA programs
        </div>
      </div>

      {/* Table */}
      <div style={{ backgroundColor: '#FFFFFF', borderRadius: '6px', border: '1px solid #DFE1E6', overflow: 'hidden' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
          <thead>
            <tr style={{ backgroundColor: '#F4F5F7', borderBottom: '2px solid #EBECF0', textAlign: 'left', color: '#6B778C' }}>
              <th style={{ padding: '10px 16px' }}>CAPA Number</th>
              <th style={{ padding: '10px 16px' }}>Program Title</th>
              <th style={{ padding: '10px 16px' }}>Type</th>
              <th style={{ padding: '10px 16px' }}>Status</th>
              <th style={{ padding: '10px 16px' }}>Risk Level</th>
              <th style={{ padding: '10px 16px' }}>Due Date</th>
              <th style={{ padding: '10px 16px' }}>Program Owner</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={7} style={{ padding: '24px', textAlign: 'center', color: '#6B778C' }}>
                  Loading CAPA records...
                </td>
              </tr>
            ) : filtered.length === 0 ? (
              <tr>
                <td colSpan={7} style={{ padding: '24px', textAlign: 'center', color: '#6B778C' }}>
                  No CAPA programs found.
                </td>
              </tr>
            ) : (
              filtered.map((capa) => (
                <tr
                  key={capa.id}
                  onClick={() => onNavigate('capa-actions', capa.id)}
                  style={{ borderBottom: '1px solid #EBECF0', cursor: 'pointer', transition: 'background-color 0.1s' }}
                  onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = '#F4F5F7')}
                  onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = '#FFFFFF')}
                >
                  <td style={{ padding: '12px 16px', fontWeight: 600, color: '#0052CC' }}>{capa.capa_number}</td>
                  <td style={{ padding: '12px 16px', maxWidth: '300px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontWeight: 500 }}>
                    {capa.title}
                  </td>
                  <td style={{ padding: '12px 16px' }}>
                    <span style={{ fontSize: '11px', fontWeight: 700, color: '#403294', backgroundColor: '#EAE6FF', padding: '2px 6px', borderRadius: '3px' }}>
                      {capa.capa_type}
                    </span>
                  </td>
                  <td style={{ padding: '12px 16px' }}>
                    <StatusBadge type="status" value={capa.status} />
                  </td>
                  <td style={{ padding: '12px 16px' }}>
                    <StatusBadge type="severity" value={capa.risk_level} />
                  </td>
                  <td style={{ padding: '12px 16px', color: '#6B778C' }}>
                    {new Date(capa.due_date).toLocaleDateString()}
                  </td>
                  <td style={{ padding: '12px 16px', color: '#172B4D' }}>{capa.owner_name}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Modal: Initiate CAPA */}
      <Modal isOpen={isModalOpen} title="Initiate Corrective & Preventive Action Program" onClose={() => setIsModalOpen(false)}>
        <form onSubmit={handleCreateCapa} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div>
            <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#172B4D', marginBottom: '4px' }}>
              CAPA Program Title *
            </label>
            <input
              type="text"
              required
              value={formData.title}
              onChange={(e) => setFormData({ ...formData, title: e.target.value })}
              placeholder="e.g. Ultrasonic Welder Acoustic Feedback Interlock Implementation"
              style={{ width: '100%', padding: '8px 12px', borderRadius: '4px', border: '1px solid #DFE1E6', fontSize: '13px' }}
            />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
            <div>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#172B4D', marginBottom: '4px' }}>
                Program Type *
              </label>
              <select
                value={formData.capaType}
                onChange={(e) => setFormData({ ...formData, capaType: e.target.value as CapaType })}
                style={{ width: '100%', padding: '8px 12px', borderRadius: '4px', border: '1px solid #DFE1E6', fontSize: '13px' }}
              >
                <option value="CORRECTIVE">Corrective Action (Existing Non-Conformance)</option>
                <option value="PREVENTIVE">Preventive Action (Risk Mitigation)</option>
              </select>
            </div>
            <div>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#172B4D', marginBottom: '4px' }}>
                Risk Classification *
              </label>
              <select
                value={formData.riskLevel}
                onChange={(e) => setFormData({ ...formData, riskLevel: e.target.value as CapaRisk })}
                style={{ width: '100%', padding: '8px 12px', borderRadius: '4px', border: '1px solid #DFE1E6', fontSize: '13px' }}
              >
                <option value="CRITICAL">Critical</option>
                <option value="HIGH">High</option>
                <option value="MEDIUM">Medium</option>
                <option value="LOW">Low</option>
              </select>
            </div>
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#172B4D', marginBottom: '4px' }}>
              Problem Statement *
            </label>
            <textarea
              required
              rows={3}
              value={formData.problemStatement}
              onChange={(e) => setFormData({ ...formData, problemStatement: e.target.value })}
              placeholder="State the root cause failure mechanism and why corrective action is necessary..."
              style={{ width: '100%', padding: '8px 12px', borderRadius: '4px', border: '1px solid #DFE1E6', fontSize: '13px' }}
            />
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#172B4D', marginBottom: '4px' }}>
              Target Implementation Due Date *
            </label>
            <input
              type="date"
              required
              value={formData.dueDate}
              onChange={(e) => setFormData({ ...formData, dueDate: e.target.value })}
              style={{ width: '100%', padding: '8px 12px', borderRadius: '4px', border: '1px solid #DFE1E6', fontSize: '13px' }}
            />
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', marginTop: '12px' }}>
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
              Initiate Program
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
