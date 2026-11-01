import React from 'react';

export const OrganizationSettings: React.FC = () => {
  return (
    <div>
      {/* Header */}
      <div style={{ marginBottom: '24px' }}>
        <h1 style={{ fontSize: '24px', fontWeight: 700, color: '#172B4D', margin: '0 0 6px 0' }}>
          Organization & Regulatory Settings
        </h1>
        <div style={{ fontSize: '13px', color: '#6B778C' }}>
          Manage multi-tenant configuration, Jira Cloud workspace bindings, and FDA establishment credentials.
        </div>
      </div>

      {/* Grid: Tenant Profile & Regulatory Credentials */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px', marginBottom: '24px' }}>
        {/* Tenant Profile */}
        <div style={{ backgroundColor: '#FFFFFF', borderRadius: '6px', border: '1px solid #DFE1E6', padding: '20px' }}>
          <h3 style={{ margin: '0 0 16px 0', fontSize: '16px', fontWeight: 700, color: '#172B4D' }}>
            Tenant Identity & Atlassian Cloud Mapping
          </h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', fontSize: '13px' }}>
            <div>
              <span style={{ color: '#6B778C', display: 'block', marginBottom: '2px' }}>Organization Legal Name:</span>
              <strong style={{ color: '#172B4D', fontSize: '14px' }}>Apex Cardiac Technologies Inc.</strong>
            </div>
            <div>
              <span style={{ color: '#6B778C', display: 'block', marginBottom: '2px' }}>Organization Tenant UUID:</span>
              <code>a1b2c3d4-e5f6-7a8b-9c0d-1e2f3a4b5c6d</code>
            </div>
            <div>
              <span style={{ color: '#6B778C', display: 'block', marginBottom: '2px' }}>Atlassian Installation ID:</span>
              <code>inst-apex-cardiac-cloud-01</code>
            </div>
            <div>
              <span style={{ color: '#6B778C', display: 'block', marginBottom: '2px' }}>Atlassian Cloud Site:</span>
              <a href="https://apexcardiac.atlassian.net" target="_blank" rel="noreferrer" style={{ color: '#0052CC', fontWeight: 600 }}>
                https://apexcardiac.atlassian.net
              </a>
            </div>
          </div>
        </div>

        {/* Regulatory Registration */}
        <div style={{ backgroundColor: '#FFFFFF', borderRadius: '6px', border: '1px solid #DFE1E6', padding: '20px' }}>
          <h3 style={{ margin: '0 0 16px 0', fontSize: '16px', fontWeight: 700, color: '#172B4D' }}>
            Medical Device Regulatory Registrations
          </h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', fontSize: '13px' }}>
            <div>
              <span style={{ color: '#6B778C', display: 'block', marginBottom: '2px' }}>FDA Establishment Registration Number (FEI):</span>
              <strong style={{ color: '#172B4D', fontSize: '14px' }}>3004829101</strong>
            </div>
            <div>
              <span style={{ color: '#6B778C', display: 'block', marginBottom: '2px' }}>ISO 13485:2016 Certificate #:</span>
              <strong>MDSAP-BSI-748920-R2</strong>
            </div>
            <div>
              <span style={{ color: '#6B778C', display: 'block', marginBottom: '2px' }}>Primary Device Portfolio:</span>
              <span>CardioPulse 9000 (Class III Active Implantable)</span>
            </div>
            <div>
              <span style={{ color: '#6B778C', display: 'block', marginBottom: '2px' }}>Quality Management System Standard:</span>
              <span style={{ fontWeight: 600, color: '#006644' }}>FDA QMSR 2026 (21 CFR Part 820 & ISO 13485)</span>
            </div>
          </div>
        </div>
      </div>

      {/* Database & Infrastructure Status Card */}
      <div style={{ backgroundColor: '#FFFFFF', borderRadius: '6px', border: '1px solid #DFE1E6', padding: '20px' }}>
        <h3 style={{ margin: '0 0 16px 0', fontSize: '16px', fontWeight: 700, color: '#172B4D', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span>⚙️</span> Database & Compliance Infrastructure Diagnostics
        </h3>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '16px', backgroundColor: '#FAFBFC', padding: '16px', borderRadius: '4px', border: '1px solid #EBECF0', fontSize: '12px' }}>
          <div>
            <div style={{ color: '#6B778C', fontWeight: 600 }}>Database Engine</div>
            <div style={{ fontSize: '14px', fontWeight: 700, color: '#172B4D', marginTop: '4px' }}>PostgreSQL 18.6</div>
            <div style={{ color: '#006644', marginTop: '2px' }}>● Connected</div>
          </div>
          <div>
            <div style={{ color: '#6B778C', fontWeight: 600 }}>Application Database Role</div>
            <div style={{ fontSize: '14px', fontWeight: 700, color: '#0052CC', marginTop: '4px' }}>audittrail_app</div>
            <div style={{ color: '#6B778C', marginTop: '2px' }}>Least-Privilege Role</div>
          </div>
          <div>
            <div style={{ color: '#6B778C', fontWeight: 600 }}>Tables & RLS Coverage</div>
            <div style={{ fontSize: '14px', fontWeight: 700, color: '#172B4D', marginTop: '4px' }}>38 Tables • 37 RLS</div>
            <div style={{ color: '#006644', marginTop: '2px' }}>100% Business Coverage</div>
          </div>
          <div>
            <div style={{ color: '#6B778C', fontWeight: 600 }}>WORM Compliance Storage</div>
            <div style={{ fontSize: '14px', fontWeight: 700, color: '#172B4D', marginTop: '4px' }}>S3 Object Lock</div>
            <div style={{ color: '#006644', marginTop: '2px' }}>10-Yr SEC/FDA Retain</div>
          </div>
        </div>
      </div>
    </div>
  );
};
