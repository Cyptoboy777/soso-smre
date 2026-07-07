'use client';

import { ShieldCheck, ShieldAlert, AlertTriangle, Info } from 'lucide-react';
import type { ValidationResult } from '@/lib/riskManager';

interface Props {
  validation: ValidationResult;
  dailyPnL: number;
  maxDailyLoss: number;
}

export default function RiskDashboard({ validation, dailyPnL, maxDailyLoss }: Props) {
  const { riskMeter, errors, warnings } = validation;

  const meterColor = riskMeter === 'GREEN' ? '#2bd9a8' : riskMeter === 'YELLOW' ? '#f59e0b' : '#ff6b6b';
  const MeterIcon = riskMeter === 'GREEN' ? ShieldCheck : riskMeter === 'YELLOW' ? AlertTriangle : ShieldAlert;

  const dailyPct = (dailyPnL / maxDailyLoss) * 100;
  const isNearDailyLimit = dailyPnL < 0 && Math.abs(dailyPnL) >= maxDailyLoss * 0.8;

  return (
    <div style={{ background: '#0a0a14', border: `1px solid ${meterColor}33`, borderRadius: 10, padding: 12, display: 'flex', flexDirection: 'column', gap: 10 }}>
      
      {/* HEADER: Risk Meter */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid #1e1e3a', paddingBottom: 8 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <MeterIcon size={16} color={meterColor} />
          <span style={{ fontSize: 11, fontWeight: 900, color: meterColor, letterSpacing: '0.05em' }}>
            RISK STATUS: {riskMeter}
          </span>
        </div>
        <div style={{ fontSize: 9, color: '#8888aa', fontWeight: 800 }}>ENGINE ACTIVE</div>
      </div>

      {/* DAILY PNL TRACKER */}
      <div>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
          <span style={{ fontSize: 9, color: '#44446a', fontWeight: 800 }}>DAILY PNL EXPOSURE</span>
          <span style={{ fontSize: 9, color: dailyPnL >= 0 ? '#2bd9a8' : isNearDailyLimit ? '#ff6b6b' : '#f59e0b', fontWeight: 800, fontFamily: 'monospace' }}>
            {dailyPnL >= 0 ? '+' : ''}${dailyPnL.toFixed(2)} / -${maxDailyLoss.toFixed(2)}
          </span>
        </div>
        <div style={{ width: '100%', height: 4, background: '#1e1e3a', borderRadius: 2, overflow: 'hidden' }}>
          <div 
            style={{ 
              height: '100%', 
              width: `${Math.min(100, Math.abs(dailyPct))}%`, 
              background: dailyPnL >= 0 ? '#2bd9a8' : isNearDailyLimit ? '#ff6b6b' : '#f59e0b',
              transition: 'width 0.3s'
            }} 
          />
        </div>
      </div>

      {/* WARNINGS & ERRORS */}
      {(errors.length > 0 || warnings.length > 0) && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4, marginTop: 4 }}>
          {errors.map((err, i) => (
            <div key={`err-${i}`} style={{ display: 'flex', alignItems: 'flex-start', gap: 6, background: 'rgba(255,107,107,0.05)', padding: '6px 8px', borderRadius: 4 }}>
              <ShieldAlert size={12} color="#ff6b6b" style={{ flexShrink: 0, marginTop: 1 }} />
              <span style={{ fontSize: 10, color: '#ff6b6b', fontWeight: 700, lineHeight: 1.3 }}>{err}</span>
            </div>
          ))}
          {warnings.map((warn, i) => (
            <div key={`warn-${i}`} style={{ display: 'flex', alignItems: 'flex-start', gap: 6, background: 'rgba(245,158,11,0.05)', padding: '6px 8px', borderRadius: 4 }}>
              <AlertTriangle size={12} color="#f59e0b" style={{ flexShrink: 0, marginTop: 1 }} />
              <span style={{ fontSize: 10, color: '#f59e0b', fontWeight: 700, lineHeight: 1.3 }}>{warn}</span>
            </div>
          ))}
        </div>
      )}

      {errors.length === 0 && warnings.length === 0 && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'rgba(43,217,168,0.05)', padding: '6px 8px', borderRadius: 4 }}>
          <ShieldCheck size={12} color="#2bd9a8" />
          <span style={{ fontSize: 10, color: '#2bd9a8', fontWeight: 700 }}>All Risk Management Rules satisfied.</span>
        </div>
      )}

    </div>
  );
}
