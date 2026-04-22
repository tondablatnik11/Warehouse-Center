// src/components/shared/KPICard.jsx
'use client';
import React from 'react';
import { TrendingUp, TrendingDown, Minus } from 'lucide-react';

const colorMap = {
  blue:    { bg: 'rgba(59, 130, 246, 0.1)', border: 'rgba(59, 130, 246, 0.3)', text: '#60a5fa', glow: '#3b82f6' },
  green:   { bg: 'rgba(16, 185, 129, 0.1)', border: 'rgba(16, 185, 129, 0.3)', text: '#34d399', glow: '#10b981' },
  yellow:  { bg: 'rgba(245, 158, 11, 0.1)', border: 'rgba(245, 158, 11, 0.3)', text: '#fbbf24', glow: '#f59e0b' },
  red:     { bg: 'rgba(239, 68, 68, 0.1)',  border: 'rgba(239, 68, 68, 0.3)',  text: '#f87171', glow: '#ef4444' },
  purple:  { bg: 'rgba(139, 92, 246, 0.1)', border: 'rgba(139, 92, 246, 0.3)', text: '#a78bfa', glow: '#8b5cf6' },
  cyan:    { bg: 'rgba(14, 165, 233, 0.1)', border: 'rgba(14, 165, 233, 0.3)', text: '#38bdf8', glow: '#0ea5e9' },
  teal:    { bg: 'rgba(20, 184, 166, 0.1)', border: 'rgba(20, 184, 166, 0.3)', text: '#2dd4bf', glow: '#14b8a6' },
};

export default function KPICard({ title, value, icon: Icon, color = 'blue', subtitle, trend, onClick, className = '' }) {
  const c = colorMap[color] || colorMap.blue;

  return (
    <div
      className={`kpi-card cursor-pointer group ${className}`}
      style={{ '--kpi-color': c.glow }}
      onClick={onClick}
    >
      <div className="flex items-start justify-between">
        <div className="flex-1 min-w-0">
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">
            {title}
          </p>
          <p className="text-3xl font-extrabold tabular-nums" style={{ color: c.text }}>
            {typeof value === 'number' ? value.toLocaleString('cs-CZ') : value}
          </p>
          {subtitle && (
            <p className="text-xs text-slate-500 mt-1.5">{subtitle}</p>
          )}
          {trend !== undefined && trend !== null && (
            <div className={`flex items-center gap-1 mt-2 text-xs font-medium ${trend > 0 ? 'text-emerald-400' : trend < 0 ? 'text-red-400' : 'text-slate-500'}`}>
              {trend > 0 ? <TrendingUp size={14} /> : trend < 0 ? <TrendingDown size={14} /> : <Minus size={14} />}
              <span>{trend > 0 ? '+' : ''}{trend}%</span>
            </div>
          )}
        </div>
        {Icon && (
          <div
            className="p-2.5 rounded-xl transition-all duration-300 group-hover:scale-110"
            style={{ background: c.bg, border: `1px solid ${c.border}` }}
          >
            <Icon size={20} style={{ color: c.text }} />
          </div>
        )}
      </div>
    </div>
  );
}

export function KPICardSkeleton() {
  return (
    <div className="kpi-card">
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <div className="skeleton w-24 h-3 mb-3" />
          <div className="skeleton w-32 h-8 mb-2" />
          <div className="skeleton w-20 h-3" />
        </div>
        <div className="skeleton w-10 h-10 rounded-xl" />
      </div>
    </div>
  );
}
