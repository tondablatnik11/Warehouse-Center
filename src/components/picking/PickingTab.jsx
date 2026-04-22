'use client';
import React, { useMemo, useState } from 'react';
import { useUI } from '@/hooks/useUI';
import { useData } from '@/hooks/useData';
import KPICard from '@/components/shared/KPICard';
import SectionHeader from '@/components/shared/SectionHeader';
import { PackageCheck, Zap, MapPin, Target, Calendar, Settings2, TrendingUp } from 'lucide-react';
import { computeMoves, splitQueue, QUEUE_DESC, getMatchKey, BOX_UNITS } from '@/lib/pickingEngine';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, LineChart, Line, ComposedChart } from 'recharts';

const CHART_COLORS = ['#3b82f6','#10b981','#f59e0b','#ef4444','#8b5cf6','#ec4899','#14b8a6','#f97316'];

export default function PickingTab() {
  const { t } = useUI();
  const { pickData, marmData, manualMaster, queueData, isLoading } = useData();
  const [period, setPeriod] = useState('all');
  const [config, setConfig] = useState({ weightLimit: 2.0, dimLimit: 15.0, grabLimit: 1 });
  const [showConfig, setShowConfig] = useState(false);

  // Build lookups and process data
  const processed = useMemo(() => {
    if (!pickData || pickData.length === 0) return null;

    const boxDict = {}, weightDict = {}, dimDict = {};
    if (marmData?.length > 0) {
      marmData.forEach(row => {
        const key = getMatchKey(row.material || '');
        const unit = String(row.alt_unit || '').toUpperCase();
        if (BOX_UNITS.has(unit)) {
          const num = parseFloat(row.numerator);
          if (num > 1) { if (!boxDict[key]) boxDict[key] = []; boxDict[key].push(num); }
        }
        if (['ST','PCE','KS','EA','PC'].includes(unit)) {
          const w = parseFloat(row.gross_weight || 0);
          const wU = String(row.weight_unit || '').toUpperCase();
          weightDict[key] = wU === 'G' ? w / 1000 : w;
          dimDict[key] = Math.max(parseFloat(row.length||0), parseFloat(row.width||0), parseFloat(row.height||0));
        }
      });
    }
    Object.keys(boxDict).forEach(k => { boxDict[k].sort((a, b) => b - a); });

    const manualBoxes = {};
    manualMaster?.forEach(row => {
      const key = getMatchKey(row.material || '');
      if (row.box_sizes) try { manualBoxes[key] = JSON.parse(row.box_sizes); } catch {}
    });

    const queueMap = {};
    queueData?.forEach(row => { if (row.transfer_order && row.queue) queueMap[row.transfer_order] = row.queue; });

    const enriched = pickData.map(row => {
      const matKey = getMatchKey(row.material || '');
      const qty = parseFloat(row.qty || 0);
      const queue = row.queue || queueMap[row.transfer_order] || 'N/A';
      const boxSizes = manualBoxes[matKey] || boxDict[matKey] || [];
      const pw = weightDict[matKey] || 0;
      const pd = dimDict[matKey] || 0;
      const moves = computeMoves(qty, queue, row.removal_su || '', boxSizes, pw, pd, config);
      const date = row.confirmation_date ? new Date(row.confirmation_date) : null;
      const month = date ? `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}` : null;
      const week = date ? `${date.getFullYear()}-W${String(Math.ceil((date.getDate()+(new Date(date.getFullYear(),0,1).getDay()))/7)).padStart(2,'0')}` : null;
      return { ...row, qty, queue, match_key: matKey, box_sizes: boxSizes, piece_weight: pw, piece_dim: pd,
        moves_total: moves.total, moves_exact: moves.exact, moves_miss: moves.miss, date, month, week };
    });

    return enriched;
  }, [pickData, marmData, manualMaster, queueData, config]);

  // Queue stats
  const queueStats = useMemo(() => {
    if (!processed) return [];
    const toGroups = {};
    processed.forEach(row => {
      const toKey = row.transfer_order || row.delivery;
      if (!toGroups[toKey]) toGroups[toKey] = { queue: row.queue, delivery: row.delivery, locs: new Set(), mats: new Set(), qty: 0, moves: 0, exact: 0, miss: 0 };
      toGroups[toKey].locs.add(row.source_bin);
      toGroups[toKey].mats.add(row.material);
      toGroups[toKey].qty += row.qty;
      toGroups[toKey].moves += row.moves_total;
      toGroups[toKey].exact += row.moves_exact;
      toGroups[toKey].miss += row.moves_miss;
    });
    const agg = {};
    Object.values(toGroups).forEach(to => {
      const q = splitQueue(to.queue, to.mats.size);
      if (!agg[q]) agg[q] = { queue: q, toCount: 0, dels: new Set(), locs: 0, qty: 0, moves: 0, exact: 0, miss: 0 };
      agg[q].toCount++; agg[q].dels.add(to.delivery); agg[q].locs += to.locs.size;
      agg[q].qty += to.qty; agg[q].moves += to.moves; agg[q].exact += to.exact; agg[q].miss += to.miss;
    });
    return Object.values(agg).map(q => ({
      queue: q.queue, desc: QUEUE_DESC[q.queue] || '', toCount: q.toCount, deliveries: q.dels.size,
      avgLocsPerTO: q.toCount > 0 ? q.locs / q.toCount : 0,
      avgMovesPerLoc: q.locs > 0 ? q.moves / q.locs : 0,
      pctExact: q.moves > 0 ? q.exact / q.moves * 100 : 0,
      pctMiss: q.moves > 0 ? q.miss / q.moves * 100 : 0,
    })).sort((a, b) => b.toCount - a.toCount);
  }, [processed]);

  // Monthly trend
  const trendData = useMemo(() => {
    if (!processed) return [];
    const byMonth = {};
    processed.forEach(row => {
      if (!row.month) return;
      if (!byMonth[row.month]) byMonth[row.month] = { month: row.month, moves: 0, locs: new Set(), tos: new Set(), qty: 0 };
      byMonth[row.month].moves += row.moves_total;
      byMonth[row.month].locs.add(row.source_bin + '_' + row.transfer_order);
      byMonth[row.month].tos.add(row.transfer_order);
      byMonth[row.month].qty += row.qty;
    });
    return Object.values(byMonth).map(m => ({
      month: m.month, moves: m.moves, toCount: m.tos.size, locCount: m.locs.size,
      avgMovesPerLoc: m.locs.size > 0 ? +(m.moves / m.locs.size).toFixed(2) : 0
    })).sort((a, b) => a.month.localeCompare(b.month));
  }, [processed]);

  // TOP materials
  const topMaterials = useMemo(() => {
    if (!processed) return [];
    const matAgg = {};
    processed.forEach(row => {
      const k = row.material || 'N/A';
      if (!matAgg[k]) matAgg[k] = { material: k, qty: 0, moves: 0, picks: 0, weight: 0 };
      matAgg[k].qty += row.qty; matAgg[k].moves += row.moves_total; matAgg[k].picks++;
      matAgg[k].weight += row.qty * row.piece_weight;
    });
    return Object.values(matAgg).sort((a, b) => b.moves - a.moves).slice(0, 20);
  }, [processed]);

  // Summary KPIs
  const kpis = useMemo(() => {
    if (!processed) return { totalMoves: 0, totalQty: 0, uniqueTOs: 0, uniqueDels: 0, uniqueLocs: 0, pctExact: 0 };
    const totalMoves = processed.reduce((s, r) => s + r.moves_total, 0);
    const exactMoves = processed.reduce((s, r) => s + r.moves_exact, 0);
    return {
      totalMoves, totalQty: processed.reduce((s, r) => s + r.qty, 0),
      uniqueTOs: new Set(processed.map(r => r.transfer_order)).size,
      uniqueDels: new Set(processed.map(r => r.delivery)).size,
      uniqueLocs: new Set(processed.map(r => r.source_bin)).size,
      pctExact: totalMoves > 0 ? (exactMoves / totalMoves * 100) : 0,
    };
  }, [processed]);

  if (isLoading) return <div className="space-y-4">{[1,2,3].map(i => <div key={i} className="skeleton h-24 w-full" />)}</div>;

  if (!processed || processed.length === 0) {
    return (
      <div className="space-y-6">
        <SectionHeader title={t.pickingTitle} description={t.pickingDesc} icon={PackageCheck} />
        <div className="glass-card p-12 text-center">
          <PackageCheck className="w-16 h-16 text-slate-600 mx-auto mb-4" />
          <h3 className="text-xl font-bold text-slate-400 mb-2">{t.noData}</h3>
          <p className="text-slate-500">Nahrajte Pick Report (LTAP/LTAK) v sekci Admin & Import.</p>
        </div>
      </div>
    );
  }

  const chartTooltipStyle = { backgroundColor: 'rgba(15,23,42,0.95)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 12 };

  return (
    <div className="space-y-6">
      <SectionHeader title={t.pickingTitle} description={t.pickingDesc} icon={PackageCheck} />

      {/* KPI Row */}
      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-4">
        <KPICard title={t.totalMoves} value={kpis.totalMoves} icon={Zap} color="purple" />
        <KPICard title={t.totalTOs} value={kpis.uniqueTOs} icon={PackageCheck} color="blue" />
        <KPICard title={t.totalDeliveries} value={kpis.uniqueDels} icon={Target} color="green" />
        <KPICard title="Lokací" value={kpis.uniqueLocs} icon={MapPin} color="cyan" />
        <KPICard title="Kusů celkem" value={kpis.totalQty} icon={PackageCheck} color="yellow" />
        <KPICard title={t.pctExact} value={`${kpis.pctExact.toFixed(1)}%`} icon={Target} color={kpis.pctExact > 70 ? 'green' : 'red'} />
      </div>

      {/* Config toggle */}
      <button onClick={() => setShowConfig(!showConfig)} className="flex items-center gap-2 text-sm text-slate-500 hover:text-blue-400 transition-colors">
        <Settings2 size={16} /> {t.configTitle}
      </button>
      {showConfig && (
        <div className="glass-card p-4 grid grid-cols-3 gap-4">
          <label className="text-xs text-slate-500">
            {t.weightLimit}
            <input type="number" step="0.5" value={config.weightLimit} onChange={e => setConfig(p => ({...p, weightLimit: parseFloat(e.target.value)||2}))}
              className="mt-1 w-full px-3 py-2 bg-slate-800 border border-white/10 rounded-lg text-slate-200 text-sm" />
          </label>
          <label className="text-xs text-slate-500">
            {t.dimLimit}
            <input type="number" step="1" value={config.dimLimit} onChange={e => setConfig(p => ({...p, dimLimit: parseFloat(e.target.value)||15}))}
              className="mt-1 w-full px-3 py-2 bg-slate-800 border border-white/10 rounded-lg text-slate-200 text-sm" />
          </label>
          <label className="text-xs text-slate-500">
            {t.grabLimit}
            <input type="number" step="1" min="1" value={config.grabLimit} onChange={e => setConfig(p => ({...p, grabLimit: parseInt(e.target.value)||1}))}
              className="mt-1 w-full px-3 py-2 bg-slate-800 border border-white/10 rounded-lg text-slate-200 text-sm" />
          </label>
        </div>
      )}

      {/* Queue Table */}
      <SectionHeader title={t.queueAnalytics} icon={PackageCheck} />
      <div className="glass-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="data-table">
            <thead><tr>
              <th>Queue</th><th>{t.queueDesc}</th><th className="text-right">{t.totalTOs}</th>
              <th className="text-right">{t.totalDeliveries}</th><th className="text-right">{t.avgLocsPerTO}</th>
              <th className="text-right">{t.avgMovesPerLoc}</th><th className="text-right">{t.pctExact}</th><th className="text-right">{t.pctEstimate}</th>
            </tr></thead>
            <tbody>{queueStats.map(q => (
              <tr key={q.queue}>
                <td className="font-semibold text-blue-400">{q.queue}</td>
                <td className="text-slate-500">{q.desc}</td>
                <td className="text-right tabular-nums">{q.toCount.toLocaleString('cs-CZ')}</td>
                <td className="text-right tabular-nums">{q.deliveries.toLocaleString('cs-CZ')}</td>
                <td className="text-right tabular-nums">{q.avgLocsPerTO.toFixed(1)}</td>
                <td className="text-right tabular-nums font-semibold">{q.avgMovesPerLoc.toFixed(2)}</td>
                <td className="text-right"><span className={`badge ${q.pctExact > 80 ? 'bg-emerald-500/20 text-emerald-400' : 'bg-amber-500/20 text-amber-400'}`}>{q.pctExact.toFixed(1)}%</span></td>
                <td className="text-right"><span className={`badge ${q.pctMiss < 20 ? 'bg-emerald-500/20 text-emerald-400' : 'bg-red-500/20 text-red-400'}`}>{q.pctMiss.toFixed(1)}%</span></td>
              </tr>
            ))}</tbody>
          </table>
        </div>
      </div>

      {/* Monthly Trend Chart */}
      {trendData.length > 1 && (
        <>
          <SectionHeader title={t.trendTitle} icon={TrendingUp} />
          <div className="glass-card p-4" style={{ height: 380 }}>
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={trendData}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                <XAxis dataKey="month" tick={{ fill: '#94a3b8', fontSize: 12 }} />
                <YAxis yAxisId="left" tick={{ fill: '#94a3b8', fontSize: 12 }} />
                <YAxis yAxisId="right" orientation="right" tick={{ fill: '#94a3b8', fontSize: 12 }} />
                <Tooltip contentStyle={chartTooltipStyle} />
                <Legend />
                <Bar yAxisId="left" dataKey="toCount" name="Počet TO" fill="#3b82f6" opacity={0.7} radius={[4,4,0,0]} />
                <Line yAxisId="right" dataKey="avgMovesPerLoc" name="Prům. pohybů/lok" stroke="#f59e0b" strokeWidth={3} dot={{ r: 5 }} />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        </>
      )}

      {/* TOP Materials */}
      <SectionHeader title={t.topMaterials} icon={Target} />
      <div className="glass-card overflow-hidden">
        <div className="overflow-x-auto max-h-96">
          <table className="data-table">
            <thead><tr>
              <th>#</th><th>{t.material}</th><th className="text-right">{t.moves}</th>
              <th className="text-right">{t.quantity}</th><th className="text-right">Picků</th>
              <th className="text-right">{t.weight} (kg)</th>
            </tr></thead>
            <tbody>{topMaterials.map((m, i) => (
              <tr key={m.material}>
                <td className="text-slate-600">{i + 1}</td>
                <td className="font-mono text-sm text-blue-400">{m.material}</td>
                <td className="text-right tabular-nums font-semibold">{m.moves.toLocaleString('cs-CZ')}</td>
                <td className="text-right tabular-nums">{m.qty.toLocaleString('cs-CZ')}</td>
                <td className="text-right tabular-nums">{m.picks.toLocaleString('cs-CZ')}</td>
                <td className="text-right tabular-nums">{m.weight > 0 ? m.weight.toFixed(1) : '—'}</td>
              </tr>
            ))}</tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
