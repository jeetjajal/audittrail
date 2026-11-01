import React, { useState } from 'react';
import { StatusBadge } from '../components/Common';
import { ScreenId } from '../components/Layout';

interface ReportsProps {
  onNavigate: (screen: ScreenId, entityId?: string) => void;
}

export const ReportsAnalytics: React.FC<ReportsProps> = ({ onNavigate }) => {
  const [generating, setGenerating] = useState(false);

  const reports = [
    {
      id: 'rep-01',
      title: 'FDA 21 CFR § 820.100 CAPA & Incident Quality Review Dossier',
      period: 'Q3 - Q4 2026',
      deviceModel: 'CardioPulse 9000 (Class III)',
      sha256: '7c4a8d09f1b2e3c4d5a6f7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8',
      pages: 48,
      status: 'COMPILED_AND_SEALED',
      generatedDate: '2026-10-31',
    },
    {
      id: 'rep-02',
      title: 'ISO 13485:2016 Clause 8.5.2 Corrective Action Effectiveness Summary',
      period: 'Annual 2026',
      deviceModel: 'CardioPulse 9000 (Class III)',
      sha256: '3f2b1a0c9e8d7f6a5b4c3d2e1f0a9b8c7d6e5f4a3b2c1d0e9f8a7b6c5d4e3f2a',
      pages: 32,
      status: 'COMPILED_AND_SEALED',
      generatedDate: '2026-10-28',
    },
    {
      id: 'rep-03',
      title: '21 CFR Part 803 Medical Device Reporting (MDR) Triage Audit',
      period: 'October 2026',
      deviceModel: 'CardioPulse 9000 (Class III)',
      sha256: 'a1b2c3d4e5f67a8b9c0d1e2f3a4b5c6d7e8f9a0b1c2d3e4f5a6b7c8d9e0f1a2b',
      pages: 14,
      status: 'COMPILED_AND_SEALED',
      generatedDate: '2026-10-25',
    },
  ];

  function handleGenerateReport() {
    setGenerating(true);
    setTimeout(() => {
      setGenerating(false);
      alert('Official Audit Package Dossier generated and cryptographically sealed with SHA-256 manifest!');
    }, 1200);
  }

  return (
    <div>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
        <div>
          <h1 style={{ fontSize: '24px', fontWeight: 700, color: '#172B4D', margin: '0 0 6px 0' }}>
            Audit Readiness & Regulatory Reports Studio
          </h1>
          <div style={{ fontSize: '13px', color: '#6B778C' }}>
            Pre-compiled inspection packages for FDA investigators, Notified Body auditors, and ISO 13485 management reviews.
          </div>
        </div>
        <button
          onClick={handleGenerateReport}
          disabled={generating}
          style={{
            backgroundColor: '#0052CC',
            color: '#FFFFFF',
            border: 'none',
            padding: '8px 18px',
            borderRadius: '4px',
            fontWeight: 600,
            cursor: generating ? 'not-allowed' : 'pointer',
          }}
        >
          {generating ? 'Compiling Dossier...' : '+ Compile Audit Package'}
        </button>
      </div>

      {/* Cluster Analysis Preview (Module 11) */}
      <div style={{ backgroundColor: '#FFFFFF', borderRadius: '6px', border: '1px solid #DFE1E6', padding: '20px', marginBottom: '24px' }}>
        <h3 style={{ margin: '0 0 12px 0', fontSize: '16px', fontWeight: 700, color: '#172B4D', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span>🔬</span> Recurring Problem Detection & Cluster Analysis (DBSCAN Discovery)
        </h3>
        <p style={{ fontSize: '13px', color: '#505F79', margin: '0 0 16px 0' }}>
          Autonomous statistical clustering across manufacturing lots, component suppliers, and cleanroom assembly cells.
        </p>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
          <div style={{ padding: '14px', borderRadius: '4px', backgroundColor: '#FFF0B3', border: '1px solid #FFE380' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
              <span style={{ fontSize: '12px', fontWeight: 700, color: '#172B4D' }}>Cluster # CL-2026-A1</span>
              <span style={{ fontSize: '11px', fontWeight: 700, color: '#DE350B' }}>ELEVATED PATTERN</span>
            </div>
            <div style={{ fontSize: '13px', fontWeight: 600, color: '#172B4D', marginBottom: '4px' }}>
              Ultrasonic Welder Thermal Reflow Micro-fissures
            </div>
            <div style={{ fontSize: '12px', color: '#505F79' }}>
              Correlated across 3 incidents involving Lot LOT-2026-03B and Welder Station #3. Corrective action addressed in CAPA-2026-0012.
            </div>
          </div>

          <div style={{ padding: '14px', borderRadius: '4px', backgroundColor: '#E3FCEF', border: '1px solid #ABF5D1' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
              <span style={{ fontSize: '12px', fontWeight: 700, color: '#006644' }}>Cluster # CL-2026-B2</span>
              <span style={{ fontSize: '11px', fontWeight: 700, color: '#006644' }}>RESOLVED</span>
            </div>
            <div style={{ fontSize: '13px', fontWeight: 600, color: '#172B4D', marginBottom: '4px' }}>
              Battery Lead Trimming Dimension Tolerance
            </div>
            <div style={{ fontSize: '12px', color: '#505F79' }}>
              Automated laser micrometry inspection implemented; zero recurring incidents in subsequent 10,000 unit assemblies.
            </div>
          </div>
        </div>
      </div>

      {/* Sealed Regulatory Reports Table */}
      <div style={{ backgroundColor: '#FFFFFF', borderRadius: '6px', border: '1px solid #DFE1E6', overflow: 'hidden' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
          <thead>
            <tr style={{ backgroundColor: '#F4F5F7', borderBottom: '2px solid #EBECF0', textAlign: 'left', color: '#6B778C' }}>
              <th style={{ padding: '10px 16px' }}>Package Title</th>
              <th style={{ padding: '10px 16px' }}>Target Scope</th>
              <th style={{ padding: '10px 16px' }}>Evaluation Period</th>
              <th style={{ padding: '10px 16px' }}>SHA-256 Digest</th>
              <th style={{ padding: '10px 16px' }}>Pages</th>
              <th style={{ padding: '10px 16px' }}>Status</th>
              <th style={{ padding: '10px 16px' }}>Action</th>
            </tr>
          </thead>
          <tbody>
            {reports.map((rep) => (
              <tr key={rep.id} style={{ borderBottom: '1px solid #EBECF0', height: '48px' }}>
                <td style={{ padding: '10px 16px', fontWeight: 600, color: '#0052CC' }}>{rep.title}</td>
                <td style={{ padding: '10px 16px' }}>{rep.deviceModel}</td>
                <td style={{ padding: '10px 16px', color: '#6B778C' }}>{rep.period}</td>
                <td style={{ padding: '10px 16px' }}>
                  <code style={{ fontSize: '11px', backgroundColor: '#F4F5F7', padding: '2px 6px', borderRadius: '3px' }}>
                    {rep.sha256.substring(0, 16)}...
                  </code>
                </td>
                <td style={{ padding: '10px 16px', fontWeight: 600 }}>{rep.pages} pp</td>
                <td style={{ padding: '10px 16px' }}>
                  <StatusBadge type="status" value={rep.status} />
                </td>
                <td style={{ padding: '10px 16px' }}>
                  <button
                    onClick={() => alert(`Exporting cryptographically sealed inspection dossier: ${rep.title}\nSHA-256: ${rep.sha256}`)}
                    style={{
                      border: '1px solid #DFE1E6',
                      backgroundColor: '#FFFFFF',
                      color: '#0052CC',
                      fontWeight: 600,
                      padding: '4px 10px',
                      borderRadius: '3px',
                      fontSize: '12px',
                      cursor: 'pointer',
                    }}
                  >
                    📥 Download Dossier
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};
