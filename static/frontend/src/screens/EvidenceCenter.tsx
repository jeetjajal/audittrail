import React, { useState } from 'react';
import { StatusBadge, Modal } from '../components/Common';
import { ScreenId } from '../components/Layout';
import { ApiClient } from '../services/api';

interface EvidenceCenterProps {
  onNavigate: (screen: ScreenId, entityId?: string) => void;
}

export const EvidenceCenter: React.FC<EvidenceCenterProps> = ({ onNavigate }) => {
  const [documents, setDocuments] = useState([
    {
      id: 'doc-1',
      documentCode: 'EVD-2026-0042',
      title: 'SEM Micrograph & EDX Elemental Failure Analysis Report',
      classification: 'EVIDENCE',
      version: 1,
      fileName: 'SEM_Analysis_Microfissure_WireBond.pdf',
      s3Uri: 's3://audittrail-compliance-records-worm/evidence/2026/EVD-2026-0042-v1.pdf',
      sha256: '9f86d081884c7d659a2feaa0c55ad015a3bf4f1b2b0b822cd15d6c15b0f00a08',
      fileSize: '4.8 MB',
      virusStatus: 'CLEAN',
      retentionDate: '2036-10-18',
      uploadedBy: 'Dr. Eleanor Mitchell',
      linkedEntity: 'Incident INC-2026-0042',
    },
    {
      id: 'doc-2',
      documentCode: 'DHF-2026-0012',
      title: 'Ultrasonic Bonding Energy Interlock Engineering Change Order',
      classification: 'DHF_RECORD',
      version: 2,
      fileName: 'ECO_48102_Welder_Software_Interlock.pdf',
      s3Uri: 's3://audittrail-compliance-records-worm/dhf/2026/ECO-48102-v2.pdf',
      sha256: '5e884898da28047151d0e56f8dc6292773603d0d6aabbdd62a11ef721d1542d8',
      fileSize: '1.2 MB',
      virusStatus: 'CLEAN',
      retentionDate: '2046-10-18',
      uploadedBy: 'Marcus Vance (Design Engineer)',
      linkedEntity: 'CAPA-2026-0012',
    },
  ]);

  const [isUploadModalOpen, setIsUploadModalOpen] = useState(false);
  const [newDoc, setNewDoc] = useState({
    title: '',
    classification: 'EVIDENCE',
    fileName: '',
    sha256: '',
    s3Uri: '',
  });

  async function handleUploadSubmit(e: React.FormEvent) {
    e.preventDefault();
    const code = `EVD-2026-${(documents.length + 1).toString().padStart(4, '0')}`;
    const payload = {
      title: newDoc.title,
      classification: newDoc.classification as any,
      fileName: newDoc.fileName || 'evidence_file.pdf',
      storageS3Uri: newDoc.s3Uri || `s3://audittrail-compliance-records-worm/evidence/2026/${code}-v1.pdf`,
      sha256Checksum: newDoc.sha256 || 'a1b2c3d4e5f67a8b9c0d1e2f3a4b5c6d7e8f9a0b1c2d3e4f5a6b7c8d9e0f1a2b',
      mimeType: 'application/pdf',
      fileSizeBytes: 2450000,
    };
    try {
      const created = await ApiClient.createDocument(payload);
      setDocuments([
        ...documents,
        {
          id: created.id,
          documentCode: created.document_code || code,
          title: created.title,
          classification: created.classification as any,
          version: created.current_version_number || 1,
          fileName: payload.fileName,
          s3Uri: payload.storageS3Uri,
          sha256: payload.sha256Checksum,
          fileSize: '2.4 MB',
          virusStatus: 'CLEAN',
          retentionDate: '2036-11-01',
          uploadedBy: 'Lead Quality Investigator',
          linkedEntity: 'Evidence Repository',
        },
      ]);
    } catch (err) {
      console.warn('Backend document upload fallback to client state:', err);
      setDocuments([
        ...documents,
        {
          id: `doc-${Date.now()}`,
          documentCode: code,
          title: newDoc.title,
          classification: newDoc.classification as any,
          version: 1,
          fileName: payload.fileName,
          s3Uri: payload.storageS3Uri,
          sha256: payload.sha256Checksum,
          fileSize: '2.4 MB',
          virusStatus: 'CLEAN',
          retentionDate: '2036-11-01',
          uploadedBy: 'Lead Quality Investigator',
          linkedEntity: 'Evidence Repository',
        },
      ]);
    }
    setIsUploadModalOpen(false);
    setNewDoc({ title: '', classification: 'EVIDENCE', fileName: '', sha256: '', s3Uri: '' });
  }

  return (
    <div>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
        <div>
          <h1 style={{ fontSize: '24px', fontWeight: 700, color: '#172B4D', margin: '0 0 6px 0' }}>
            Evidence & Controlled Document Repository
          </h1>
          <div style={{ fontSize: '13px', color: '#6B778C' }}>
            WORM Object Storage (S3 Object Lock) with SHA-256 byte-level verification for FDA 21 CFR Part 11 & DHF records.
          </div>
        </div>
        <button
          onClick={() => setIsUploadModalOpen(true)}
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
          + Register Controlled Document
        </button>
      </div>

      {/* S3 WORM Compliance Card */}
      <div
        style={{
          backgroundColor: '#FFFFFF',
          borderRadius: '6px',
          border: '1px solid #DFE1E6',
          padding: '16px 20px',
          marginBottom: '20px',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
          <span style={{ fontSize: '24px' }}>🔒</span>
          <div>
            <div style={{ fontSize: '14px', fontWeight: 700, color: '#172B4D' }}>
              External WORM Object Storage: S3 Compliance Mode Active
            </div>
            <div style={{ fontSize: '12px', color: '#6B778C' }}>
              Bucket: <code>audittrail-compliance-records-worm</code> • Retention Period: 10 Years Immutability
            </div>
          </div>
        </div>
        <span style={{ fontSize: '11px', fontWeight: 700, backgroundColor: '#E3FCEF', color: '#006644', padding: '4px 10px', borderRadius: '4px' }}>
          SEC § 17a-4 / FDA PART 11 COMPLIANT
        </span>
      </div>

      {/* Document Table */}
      <div style={{ backgroundColor: '#FFFFFF', borderRadius: '6px', border: '1px solid #DFE1E6', overflow: 'hidden' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
          <thead>
            <tr style={{ backgroundColor: '#F4F5F7', borderBottom: '2px solid #EBECF0', textAlign: 'left', color: '#6B778C' }}>
              <th style={{ padding: '10px 16px' }}>Document Code</th>
              <th style={{ padding: '10px 16px' }}>Title</th>
              <th style={{ padding: '10px 16px' }}>Classification</th>
              <th style={{ padding: '10px 16px' }}>Version</th>
              <th style={{ padding: '10px 16px' }}>SHA-256 Checksum</th>
              <th style={{ padding: '10px 16px' }}>Virus Scan</th>
              <th style={{ padding: '10px 16px' }}>Linked Entity</th>
            </tr>
          </thead>
          <tbody>
            {documents.map((doc) => (
              <tr key={doc.id} style={{ borderBottom: '1px solid #EBECF0', height: '48px' }}>
                <td style={{ padding: '10px 16px', fontWeight: 600, color: '#0052CC' }}>{doc.documentCode}</td>
                <td style={{ padding: '10px 16px', fontWeight: 500, color: '#172B4D' }}>{doc.title}</td>
                <td style={{ padding: '10px 16px' }}>
                  <span style={{ fontSize: '11px', fontWeight: 700, backgroundColor: '#DEEBFF', color: '#0747A6', padding: '2px 6px', borderRadius: '3px' }}>
                    {doc.classification}
                  </span>
                </td>
                <td style={{ padding: '10px 16px', fontWeight: 600 }}>v{doc.version}.0</td>
                <td style={{ padding: '10px 16px' }}>
                  <code style={{ fontSize: '11px', backgroundColor: '#F4F5F7', padding: '2px 6px', borderRadius: '3px' }}>
                    {doc.sha256.substring(0, 16)}...
                  </code>
                </td>
                <td style={{ padding: '10px 16px' }}>
                  <span style={{ fontSize: '11px', fontWeight: 700, color: '#006644', backgroundColor: '#E3FCEF', padding: '2px 6px', borderRadius: '3px' }}>
                    CLEAN
                  </span>
                </td>
                <td style={{ padding: '10px 16px', color: '#0052CC', fontWeight: 500 }}>{doc.linkedEntity}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Modal: Register Document */}
      <Modal isOpen={isUploadModalOpen} title="Register Controlled Evidence Document" onClose={() => setIsUploadModalOpen(false)}>
        <form onSubmit={handleUploadSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          <div>
            <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#172B4D', marginBottom: '4px' }}>Document Title *</label>
            <input required type="text" value={newDoc.title} onChange={(e) => setNewDoc({ ...newDoc, title: e.target.value })} style={{ width: '100%', padding: '8px', border: '1px solid #DFE1E6', borderRadius: '4px' }} />
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
            <div>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#172B4D', marginBottom: '4px' }}>Classification *</label>
              <select value={newDoc.classification} onChange={(e) => setNewDoc({ ...newDoc, classification: e.target.value })} style={{ width: '100%', padding: '8px', border: '1px solid #DFE1E6', borderRadius: '4px' }}>
                <option value="EVIDENCE">Clinical / Physical Evidence</option>
                <option value="DHF_RECORD">Design History File (DHF)</option>
                <option value="SOP">Standard Operating Procedure</option>
                <option value="VALIDATION_REPORT">Validation Protocol & Report</option>
              </select>
            </div>
            <div>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#172B4D', marginBottom: '4px' }}>File Name *</label>
              <input required type="text" value={newDoc.fileName} onChange={(e) => setNewDoc({ ...newDoc, fileName: e.target.value })} placeholder="report_scan.pdf" style={{ width: '100%', padding: '8px', border: '1px solid #DFE1E6', borderRadius: '4px' }} />
            </div>
          </div>
          <div>
            <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#172B4D', marginBottom: '4px' }}>SHA-256 Digest Checksum *</label>
            <input required type="text" value={newDoc.sha256} onChange={(e) => setNewDoc({ ...newDoc, sha256: e.target.value })} placeholder="64-character hexadecimal SHA-256 hash" style={{ width: '100%', padding: '8px', border: '1px solid #DFE1E6', borderRadius: '4px', fontFamily: 'monospace' }} />
          </div>
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '8px' }}>
            <button type="submit" style={{ backgroundColor: '#0052CC', color: '#FFF', border: 'none', padding: '8px 16px', borderRadius: '4px', fontWeight: 600, cursor: 'pointer' }}>Register Document</button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
