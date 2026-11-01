import React, { useState } from 'react';
import { StatusBadge } from '../components/Common';
import { ScreenId } from '../components/Layout';
import { ApiClient } from '../services/api';

interface AiAssistantProps {
  incidentId?: string;
  onNavigate: (screen: ScreenId, entityId?: string) => void;
}

export const AiInvestigationAssistant: React.FC<AiAssistantProps> = ({ incidentId, onNavigate }) => {
  const [analyzing, setAnalyzing] = useState(false);
  const [analysisResult, setAnalysisResult] = useState<any>({
    aiGenerated: true,
    modelName: 'gemini-1.5-pro-002',
    promptTemplateVersion: 'v2.4.0',
    modelConfidence: 0.89,
    latencyMs: 940,
    hypotheses: [
      {
        id: 'sug-1',
        statement: 'Sub-surface wire bond micro-fracture during thermal cycling',
        category: 'MATERIAL_DEGRADATION',
        confidenceScore: 0.89,
        recommendedVerificationMethod: 'Scanning Electron Microscopy (SEM) and in-situ micro-pull shear testing.',
        rationale: 'Telemetry impedance drop corresponds with dielectric stress patterns observed in hermetic seam weld lot samples.',
        status: 'PENDING_REVIEW',
      },
    ],
    historicalMatches: [
      {
        incidentNumber: 'INC-2025-0188',
        title: 'Hermetic feedthrough impedance excursion in lot LOT-2025-11A',
        severity: 'CRITICAL',
        similarityScore: 0.865,
        resolution: 'Corrected via automated welder controller interlock and dual temperature profiling.',
      },
      {
        incidentNumber: 'INC-2024-0094',
        title: 'Wire bond lift off after 500 thermal cycles',
        severity: 'MAJOR',
        similarityScore: 0.782,
        resolution: 'Increased ultrasonic bonding wattage from 18W to 22W.',
      },
    ],
  });

  const [dispositionStatus, setDispositionStatus] = useState<string | null>(null);

  async function handleRunAnalysis() {
    if (!incidentId) return;
    setAnalyzing(true);
    try {
      const res = await ApiClient.analyzeIncident(incidentId);
      setAnalysisResult({
        ...analysisResult,
        modelConfidence: res.modelConfidence,
        generatedAt: res.generatedAt,
      });
      alert('AI investigation analysis generated successfully!');
    } catch (err) {
      alert(`AI execution failed: ${(err as Error).message}`);
    } finally {
      setAnalyzing(false);
    }
  }

  async function handleDisposition(disposition: 'ACCEPTED_AS_IS' | 'EDITED_BEFORE_ACCEPT' | 'DISMISSED') {
    try {
      await ApiClient.submitAiFeedback('sug-1', disposition, { usefulnessScore: 5 });
      setDispositionStatus(disposition);
      alert(`Human disposition recorded: ${disposition}. Registered in tamper-evident audit ledger.`);
    } catch (err) {
      alert(`Feedback submission failed: ${(err as Error).message}`);
    }
  }

  return (
    <div>
      {/* Title */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
        <div>
          <h1 style={{ fontSize: '24px', fontWeight: 700, color: '#172B4D', margin: '0 0 6px 0', display: 'flex', alignItems: 'center', gap: '10px' }}>
            <span>✨</span> AI Investigation & Decision Support Assistant
          </h1>
          <div style={{ fontSize: '13px', color: '#6B778C' }}>
            Human-in-the-Loop Root Cause Hypotheses & Historical Similarity Engine (Google Vertex AI text-embedding-004 & Gemini).
          </div>
        </div>
        <button
          onClick={handleRunAnalysis}
          disabled={analyzing}
          style={{
            backgroundColor: '#6554C0',
            color: '#FFFFFF',
            border: 'none',
            padding: '8px 16px',
            borderRadius: '4px',
            fontWeight: 600,
            cursor: analyzing ? 'not-allowed' : 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
          }}
        >
          {analyzing ? 'Analyzing Clinical Incident...' : '⚡ Re-Analyze Incident'}
        </button>
      </div>

      {/* Mandatory Regulatory AI Disclaimer Banner */}
      <div
        style={{
          backgroundColor: '#FFF0B3',
          border: '1px solid #FFE380',
          borderRadius: '6px',
          padding: '14px 18px',
          marginBottom: '24px',
          display: 'flex',
          gap: '12px',
          alignItems: 'center',
        }}
      >
        <span style={{ fontSize: '22px' }}>⚠️</span>
        <div style={{ fontSize: '12px', color: '#172B4D', lineHeight: '1.5' }}>
          <strong>FDA QMSR 2026 & ISO 13485:2016 COMPLIANCE DIRECTIVE:</strong> AI-generated hypotheses and recommendations are
          strictly non-binding decision support aids. All root cause attributions, CAPA programs, and regulatory determinations
          <strong> must be verified and authorized by a qualified human quality investigator</strong>. AI algorithms are prohibited from
          independently closing investigations or releasing quarantined devices.
        </div>
      </div>

      {/* AI Telemetry Header Card */}
      <div
        style={{
          backgroundColor: '#FFFFFF',
          borderRadius: '6px',
          border: '1px solid #DFE1E6',
          padding: '16px 20px',
          marginBottom: '24px',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
        }}
      >
        <div style={{ display: 'flex', gap: '24px', fontSize: '13px' }}>
          <div>Model: <strong style={{ color: '#6554C0' }}>{analysisResult.modelName}</strong></div>
          <div>Prompt Version: <strong>{analysisResult.promptTemplateVersion}</strong></div>
          <div>Confidence: <strong style={{ color: '#006644' }}>{(analysisResult.modelConfidence * 100).toFixed(1)}%</strong></div>
          <div>Latency: <strong>{analysisResult.latencyMs} ms</strong></div>
        </div>
        <span style={{ fontSize: '11px', fontWeight: 700, backgroundColor: '#EAE6FF', color: '#403294', padding: '3px 8px', borderRadius: '3px' }}>
          AI-GENERATED HYPOTHESIS (NON-BINDING)
        </span>
      </div>

      {/* Hypotheses Cards */}
      <div style={{ marginBottom: '28px' }}>
        <h3 style={{ margin: '0 0 14px 0', fontSize: '16px', fontWeight: 700, color: '#172B4D' }}>
          AI-Proposed Root Cause Hypotheses (Awaiting Human Determination)
        </h3>
        {analysisResult.hypotheses.map((hyp: any) => (
          <div
            key={hyp.id}
            style={{
              backgroundColor: '#FFFFFF',
              borderRadius: '6px',
              border: '1px solid #DFE1E6',
              padding: '20px',
              marginBottom: '16px',
              boxShadow: '0 1px 3px rgba(9, 30, 66, 0.08)',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '10px' }}>
              <div>
                <span style={{ fontSize: '11px', fontWeight: 700, backgroundColor: '#DEEBFF', color: '#0747A6', padding: '2px 8px', borderRadius: '3px', marginRight: '8px' }}>
                  {hyp.category}
                </span>
                <span style={{ fontSize: '12px', color: '#6B778C' }}>
                  Algorithm Confidence: <strong>{(hyp.confidenceScore * 100).toFixed(0)}%</strong>
                </span>
              </div>
              <StatusBadge type="status" value={dispositionStatus || hyp.status} />
            </div>

            <h4 style={{ margin: '0 0 8px 0', fontSize: '16px', fontWeight: 600, color: '#172B4D' }}>
              {hyp.statement}
            </h4>

            <p style={{ margin: '0 0 12px 0', fontSize: '13px', color: '#505F79', lineHeight: '1.5' }}>
              <strong>Scientific Rationale:</strong> {hyp.rationale}
            </p>

            <div style={{ backgroundColor: '#F4F5F7', padding: '10px 14px', borderRadius: '4px', fontSize: '12px', color: '#172B4D', marginBottom: '16px' }}>
              <strong>Recommended Physical Verification Protocol:</strong> {hyp.recommendedVerificationMethod}
            </div>

            {/* Human Review Actions */}
            <div style={{ display: 'flex', gap: '12px', borderTop: '1px solid #EBECF0', paddingTop: '14px' }}>
              <button
                onClick={() => handleDisposition('ACCEPTED_AS_IS')}
                style={{
                  backgroundColor: '#00875A',
                  color: '#FFFFFF',
                  border: 'none',
                  padding: '6px 14px',
                  borderRadius: '3px',
                  fontWeight: 600,
                  fontSize: '12px',
                  cursor: 'pointer',
                }}
              >
                ✓ Accept Hypothesis as Official Cause
              </button>
              <button
                onClick={() => handleDisposition('EDITED_BEFORE_ACCEPT')}
                style={{
                  backgroundColor: '#FFFFFF',
                  color: '#172B4D',
                  border: '1px solid #DFE1E6',
                  padding: '6px 14px',
                  borderRadius: '3px',
                  fontWeight: 600,
                  fontSize: '12px',
                  cursor: 'pointer',
                }}
              >
                ✏️ Edit Before Adoption
              </button>
              <button
                onClick={() => handleDisposition('DISMISSED')}
                style={{
                  backgroundColor: '#FFFFFF',
                  color: '#DE350B',
                  border: '1px solid #FFBDAD',
                  padding: '6px 14px',
                  borderRadius: '3px',
                  fontWeight: 600,
                  fontSize: '12px',
                  cursor: 'pointer',
                }}
              >
                ✕ Dismiss Hypothesis
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* Historical Similar Incidents (Vector Matching) */}
      <div style={{ backgroundColor: '#FFFFFF', borderRadius: '6px', border: '1px solid #DFE1E6', padding: '20px' }}>
        <h3 style={{ margin: '0 0 14px 0', fontSize: '16px', fontWeight: 700, color: '#172B4D', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span>🔍</span> Historical Similar Incidents (Cosine Similarity Matching)
        </h3>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
          <thead>
            <tr style={{ backgroundColor: '#F4F5F7', borderBottom: '2px solid #EBECF0', textAlign: 'left', color: '#6B778C' }}>
              <th style={{ padding: '8px 12px' }}>Incident #</th>
              <th style={{ padding: '8px 12px' }}>Historical Issue Description</th>
              <th style={{ padding: '8px 12px' }}>Severity</th>
              <th style={{ padding: '8px 12px' }}>Similarity</th>
              <th style={{ padding: '8px 12px' }}>Prior CAPA Resolution</th>
            </tr>
          </thead>
          <tbody>
            {analysisResult.historicalMatches.map((m: any, idx: number) => (
              <tr key={idx} style={{ borderBottom: '1px solid #EBECF0', height: '44px' }}>
                <td style={{ padding: '8px 12px', fontWeight: 600, color: '#0052CC' }}>{m.incidentNumber}</td>
                <td style={{ padding: '8px 12px' }}>{m.title}</td>
                <td style={{ padding: '8px 12px' }}>
                  <StatusBadge type="severity" value={m.severity} />
                </td>
                <td style={{ padding: '8px 12px', fontWeight: 700, color: '#00875A' }}>
                  {(m.similarityScore * 100).toFixed(1)}% match
                </td>
                <td style={{ padding: '8px 12px', color: '#505F79', fontSize: '12px' }}>{m.resolution}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};
