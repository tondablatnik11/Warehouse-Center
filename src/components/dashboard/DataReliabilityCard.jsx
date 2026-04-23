// src/components/dashboard/DataReliabilityCard.jsx
'use client';
import React from 'react';
import { useUI } from '@/hooks/useUI';
import SectionHeader from '@/components/shared/SectionHeader';
import { Target } from 'lucide-react';

export default function DataReliabilityCard({ data }) {
  const { t } = useUI();

  if (!data) return null;

  const { totalMoves, exactMoves, missMoves, pctExact, pctMiss } = data;

  return (
    <>
      <SectionHeader
        title={t.dataReliability}
        description={t.dataReliabilityDesc}
        icon={Target}
      />
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Total Moves */}
        <div className="glass-card p-5">
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">{t.totalMoves}</p>
          <p className="text-2xl font-extrabold text-white tabular-nums">{totalMoves.toLocaleString('cs-CZ')}</p>
        </div>

        {/* Exact */}
        <div className="glass-card p-5">
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">{t.exactMoves}</p>
          <p className="text-2xl font-extrabold text-emerald-400 tabular-nums">
            {exactMoves.toLocaleString('cs-CZ')}
            <span className="text-sm font-medium text-slate-500 ml-2">({pctExact.toFixed(1)}%)</span>
          </p>
          <div className="mt-3 h-2 bg-slate-800 rounded-full overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-emerald-500 to-emerald-400 rounded-full transition-all duration-700"
              style={{ width: `${pctExact}%` }}
            />
          </div>
        </div>

        {/* Estimates */}
        <div className="glass-card p-5">
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">{t.estimatedMoves}</p>
          <p className="text-2xl font-extrabold text-amber-400 tabular-nums">
            {missMoves.toLocaleString('cs-CZ')}
            <span className="text-sm font-medium text-slate-500 ml-2">({pctMiss.toFixed(1)}%)</span>
          </p>
          <div className="mt-3 h-2 bg-slate-800 rounded-full overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-amber-500 to-amber-400 rounded-full transition-all duration-700"
              style={{ width: `${pctMiss}%` }}
            />
          </div>
        </div>
      </div>
    </>
  );
}
