import React from 'react';
import { IncidentSeverity, IncidentStatus, CapaStatus } from '../types';

export const StatusBadge: React.FC<{
  type?: 'severity' | 'status' | 'capa' | 'review';
  value?: string;
  status?: string;
}> = ({ type = 'status', value, status }) => {
  const badgeValue = (value || status || 'UNKNOWN').toString();
  let bg = '#DFE1E6';
  let color = '#172B4D';

  if (badgeValue === 'CRITICAL' || badgeValue === 'REJECTED' || badgeValue === 'DISMISSED' || badgeValue === 'CANCELLED') {
    bg = '#FFEBE6';
    color = '#DE350B';
  } else if (badgeValue === 'MAJOR' || badgeValue === 'CONTAINMENT_ACTIVE' || badgeValue === 'HIGH') {
    bg = '#FFF0B3';
    color = '#172B4D';
  } else if (badgeValue === 'MINOR' || badgeValue === 'MEDIUM') {
    bg = '#EAE6FF';
    color = '#403294';
  } else if (badgeValue === 'NEGLIGIBLE' || badgeValue === 'LOW') {
    bg = '#F4F5F7';
    color = '#6B778C';
  } else if (badgeValue === 'CLOSED' || badgeValue === 'VERIFIED' || badgeValue === 'APPROVED' || badgeValue === 'COMPLETED' || badgeValue === 'ACCEPTED' || badgeValue === 'ACTIVE') {
    bg = '#E3FCEF';
    color = '#006644';
  } else if (badgeValue === 'INVESTIGATING' || badgeValue === 'IN_PROGRESS' || badgeValue === 'OPEN' || badgeValue === 'ACTION_PLANNING') {
    bg = '#DEEBFF';
    color = '#0747A6';
  }

  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        padding: '2px 8px',
        borderRadius: '3px',
        fontSize: '11px',
        fontWeight: 700,
        textTransform: 'uppercase',
        letterSpacing: '0.5px',
        backgroundColor: bg,
        color: color,
        border: `1px solid ${bg === '#F4F5F7' ? '#DFE1E6' : 'transparent'}`,
      }}
    >
      {badgeValue.replace(/_/g, ' ')}
    </span>
  );
};

export const MetricCard: React.FC<{
  title: string;
  value: string | number;
  subtitle?: string;
  badge?: string;
  badgeText?: string;
  badgeColor?: string;
  icon?: string;
}> = ({ title, value, subtitle, badge, badgeText, badgeColor, icon }) => {
  const displayBadge = badge || badgeText;
  return (
    <div
      style={{
        backgroundColor: '#FFFFFF',
        borderRadius: '6px',
        padding: '16px 20px',
        boxShadow: '0 1px 3px rgba(9, 30, 66, 0.12), 0 0 1px rgba(9, 30, 66, 0.31)',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between',
        minWidth: '200px',
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
        <span style={{ fontSize: '12px', fontWeight: 600, color: '#6B778C', textTransform: 'uppercase' }}>
          {title}
        </span>
        {icon && <span style={{ fontSize: '18px' }}>{icon}</span>}
      </div>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px', marginBottom: '4px' }}>
        <span style={{ fontSize: '28px', fontWeight: 700, color: '#172B4D' }}>{value}</span>
        {displayBadge && (
          <span
            style={{
              fontSize: '11px',
              fontWeight: 600,
              padding: '2px 6px',
              borderRadius: '3px',
              backgroundColor: badgeColor === 'critical' ? '#FFEBE6' : badgeColor === 'warning' ? '#FFF0B3' : badgeColor === 'primary' ? '#DEEBFF' : badgeColor || '#E3FCEF',
              color: badgeColor === 'critical' ? '#DE350B' : badgeColor === 'warning' ? '#172B4D' : badgeColor === 'primary' ? '#0747A6' : '#006644',
            }}
          >
            {displayBadge}
          </span>
        )}
      </div>
      {subtitle && <span style={{ fontSize: '12px', color: '#8993A4' }}>{subtitle}</span>}
    </div>
  );
};

export const Modal: React.FC<{
  isOpen: boolean;
  title: string;
  onClose: () => void;
  children: React.ReactNode;
  width?: string;
}> = ({ isOpen, title, onClose, children, width = '600px' }) => {
  if (!isOpen) return null;

  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'rgba(9, 30, 66, 0.54)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 1000,
      }}
    >
      <div
        style={{
          backgroundColor: '#FFFFFF',
          borderRadius: '8px',
          width,
          maxWidth: '90vw',
          maxHeight: '90vh',
          display: 'flex',
          flexDirection: 'column',
          boxShadow: '0 8px 30px rgba(9, 30, 66, 0.25)',
          overflow: 'hidden',
        }}
      >
        <div
          style={{
            padding: '16px 24px',
            borderBottom: '1px solid #EBECF0',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
          }}
        >
          <h3 style={{ margin: 0, fontSize: '18px', fontWeight: 600, color: '#172B4D' }}>{title}</h3>
          <button
            onClick={onClose}
            style={{
              border: 'none',
              background: 'transparent',
              fontSize: '20px',
              cursor: 'pointer',
              color: '#6B778C',
            }}
          >
            ✕
          </button>
        </div>
        <div style={{ padding: '20px 24px', overflowY: 'auto' }}>{children}</div>
      </div>
    </div>
  );
};
