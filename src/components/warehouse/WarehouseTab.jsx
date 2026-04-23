'use client';
import React, { useMemo, useState } from 'react';
import { useUI } from '@/hooks/useUI';
import { useData } from '@/hooks/useData';
import KPICard from '@/components/shared/KPICard';
import SectionHeader from '@/components/shared/SectionHeader';
import { Warehouse, MapPin, Flame, Skull, ArrowDownUp, BarChart3 } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ScatterChart, Scatter, ZAxis, Cell } from 'recharts';

function parseBinCoords(bin) {
  const s = String(bin).trim();
  const pts = s.split('-');
  let aisle = 0, stack = 0;
  const extractNum = (p) => { const d = String(p).replace(/\D/g, ''); return d ? parseInt(d) : 0; };
  if (pts.length >= 4) { aisle = extractNum(pts[0]); stack = extractNum(pts[1]); }
  else if (pts.length === 3) { aisle = extractNum(pts[0]); stack = extractNum(pts[1]); }
  else if (pts.length === 2) { aisle = extractNum(pts[0]); stack = extractNum(pts[1]); }
  return { aisle, stack };
}

export default function WarehouseTab() {
  const { t } = useUI();
  const { warehouseData, pickData, isLoading } = useData();
  const [activeSubTab, setActiveSubTab] = useState('capacity');
  const [deadStockDays, setDeadStockDays] = useState(90);
  const [downsizingLimit, setDownsizingLimit] = useState(10);

  const lx03 = warehouseData.lx03;
  const lt10 = warehouseData.lt10;

  // Capacity
  const capacityStats = useMemo(() => {
    if (!lx03 || lx03.length === 0) return null;
    const total = lx03.length;
    const empty = lx03.filter(r => {
      const m = String(r.material || '').trim().toLowerCase();
      return !m || m === '' || m === 'nan' || m === 'null' || m === 'none' || m === '<<empty>>';
    }).length;
    const occupied = total - empty;

    // By bin type
    const byType = {};
    lx03.forEach(r => {
      const bt = r.bin_type || 'N/A';
      if (!byType[bt]) byType[bt] = { type: bt, total: 0, empty: 0, occupied: 0 };
      byType[bt].total++;
      const m = String(r.material || '').trim().toLowerCase();
      if (!m || m === '' || m === 'nan' || m === 'null' || m === 'none' || m === '<<empty>>') byType[bt].empty++;
      else byType[bt].occupied++;
    });

    return { total, empty, occupied, pct: total > 0 ? (occupied / total * 100) : 0,
      byType: Object.values(byType).sort((a, b) => b.total - a.total) };
  }, [lx03]);

  // 2D Floor plan
  const floorPlanData = useMemo(() => {
    if (!lx03 || lx03.length === 0) return [];
    const agg = {};
    lx03.forEach(r => {
      if (!r.storage_bin) return;
      const { aisle, stack } = parseBinCoords(r.storage_bin);
      if (aisle <= 0 || aisle > 150 || stack <= 0) return;
      const key = `${aisle}-${stack}`;
      if (!agg[key]) agg[key] = { x: aisle, y: stack, total: 0, free: 0 };
      agg[key].total++;
      const m = String(r.material || '').trim().toLowerCase();
      if (!m || m === '' || m === 'nan' || m === 'null' || m === 'none' || m === '<<empty>>') agg[key].free++;
    });
    return Object.values(agg).map(d => ({ ...d, capacity: d.total > 0 ? +((d.total - d.free) / d.total).toFixed(2) : 0, z: d.total }));
  }, [lx03]);

  // Dead stock
  const deadStock = useMemo(() => {
    if (!lt10 || lt10.length === 0) return [];
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - deadStockDays);
    return lt10.filter(r => {
      if (!r.last_movement) return false;
      const d = new Date(r.last_movement);
      return d < cutoff && parseFloat(r.available_stock || 0) > 0;
    }).map(r => ({
      ...r, days_dead: Math.floor((Date.now() - new Date(r.last_movement).getTime()) / 86400000)
    })).sort((a, b) => b.days_dead - a.days_dead).slice(0, 100);
  }, [lt10, deadStockDays]);

  // Downsizing candidates
  const downsizing = useMemo(() => {
    if (!lt10 || lt10.length === 0) return [];
    const palletTypes = ['EP1','P1','EP2','P2','EP3','PE3','P3','EP4','P4'];
    return lt10.filter(r => {
      const bt = String(r.bin_type || '').toUpperCase().trim();
      const qty = parseFloat(r.available_stock || 0);
      return palletTypes.includes(bt) && qty > 0 && qty <= downsizingLimit;
    }).sort((a, b) => parseFloat(a.available_stock) - parseFloat(b.available_stock)).slice(0, 100);
  }, [lt10, downsizingLimit]);

  if (isLoading) return <div className="skeleton h-96 w-full" />;

  const hasLx03 = lx03 && lx03.length > 0;
  const hasLt10 = lt10 && lt10.length > 0;

  if (!hasLx03 && !hasLt10) {
    return (
      <div className="space-y-6">
        <SectionHeader title={t.warehouseTitle} description={t.warehouseDesc} icon={Warehouse} />
        <div className="glass-card p-12 text-center">
          <Warehouse className="w-16 h-16 text-slate-600 mx-auto mb-4" />
          <h3 className="text-xl font-bold text-slate-400 mb-2">{t.noData}</h3>
          <p className="text-slate-500">Nahrajte LX03 a/nebo LT10 v sekci Admin & Import.</p>
        </div>
      </div>
    );
  }

  const subTabs = [
    { id: 'capacity', label: t.capacityZones, icon: BarChart3 },
    { id: 'floor', label: t.floorPlan2D, icon: MapPin },
    ...(hasLt10 ? [
      { id: 'dead', label: t.deadStock, icon: Skull },
      { id: 'downsize', label: t.downsizing, icon: ArrowDownUp },
    ] : []),
  ];

  const chartTooltipStyle = { backgroundColor: 'rgba(15,23,42,0.95)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 12 };

  return (
    <div className="space-y-6">
      <SectionHeader title={t.warehouseTitle} description={t.warehouseDesc} icon={Warehouse} />

      {/* KPIs */}
      {capacityStats && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <KPICard title={t.totalBins} value={capacityStats.total} icon={MapPin} color="blue" />
          <KPICard title={t.occupiedBins} value={capacityStats.occupied} icon={Warehouse} color="yellow" />
          <KPICard title={t.emptyBins} value={capacityStats.empty} icon={MapPin} color="green" />
          <KPICard title={t.occupancyRate} value={`${capacityStats.pct.toFixed(1)}%`} icon={BarChart3}
            color={capacityStats.pct > 85 ? 'red' : capacityStats.pct > 70 ? 'yellow' : 'green'} />
        </div>
      )}

      {/* Sub-tabs */}
      <div className="flex gap-2 overflow-x-auto pb-2">
        {subTabs.map(st => (
          <button key={st.id} onClick={() => setActiveSubTab(st.id)}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-all whitespace-nowrap ${activeSubTab === st.id ? 'bg-blue-500/20 text-blue-400 border border-blue-500/30' : 'bg-white/[0.03] text-slate-500 border border-white/[0.06] hover:text-slate-300'}`}>
            <st.icon size={16} /> {st.label}
          </button>
        ))}
      </div>

      {/* Capacity */}
      {activeSubTab === 'capacity' && capacityStats && (
        <div className="glass-card p-4" style={{ height: 400 }}>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={capacityStats.byType}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
              <XAxis dataKey="type" tick={{ fill: '#94a3b8', fontSize: 11 }} />
              <YAxis tick={{ fill: '#94a3b8', fontSize: 11 }} />
              <Tooltip contentStyle={chartTooltipStyle} />
              <Bar dataKey="occupied" name="Obsazeno" stackId="a" fill="#f59e0b" radius={[0,0,0,0]} />
              <Bar dataKey="empty" name="Volno" stackId="a" fill="#10b981" radius={[4,4,0,0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* 2D Floor Plan */}
      {activeSubTab === 'floor' && floorPlanData.length > 0 && (
        <div className="glass-card p-4" style={{ height: 600 }}>
          <ResponsiveContainer width="100%" height="100%">
            <ScatterChart>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
              <XAxis dataKey="x" name="Řada" tick={{ fill: '#94a3b8', fontSize: 10 }} />
              <YAxis dataKey="y" name="Dům" tick={{ fill: '#94a3b8', fontSize: 10 }} reversed />
              <ZAxis dataKey="z" range={[40, 120]} />
              <Tooltip contentStyle={chartTooltipStyle} formatter={(v, n) => n === 'capacity' ? `${(v*100).toFixed(0)}%` : v} />
              <Scatter data={floorPlanData} shape="square">
                {floorPlanData.map((d, i) => (
                  <Cell key={i} fill={d.capacity > 0.8 ? '#ef4444' : d.capacity > 0.5 ? '#f59e0b' : '#10b981'} opacity={0.8} />
                ))}
              </Scatter>
            </ScatterChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Dead Stock */}
      {activeSubTab === 'dead' && (
        <div>
          <div className="mb-4">
            <label className="text-sm text-slate-500">Min. dní bez pohybu:
              <input type="number" min={30} max={365} step={10} value={deadStockDays} onChange={e => setDeadStockDays(parseInt(e.target.value) || 90)}
                className="ml-3 w-20 px-3 py-1.5 bg-slate-800 border border-white/10 rounded-lg text-slate-200 text-sm" />
            </label>
          </div>
          {deadStock.length > 0 ? (
            <div className="glass-card overflow-hidden">
              <p className="p-3 text-amber-400 text-sm font-semibold">⚠️ {deadStock.length} materiálů bez pohybu &gt; {deadStockDays} dní</p>
              <div className="overflow-x-auto max-h-96">
                <table className="data-table"><thead><tr>
                  <th>Lokace</th><th>Typ</th><th>{t.material}</th><th className="text-right">Zásoba</th><th className="text-right">Dní mrtvo</th>
                </tr></thead><tbody>{deadStock.map((r, i) => (
                  <tr key={i}>
                    <td className="font-mono text-xs">{r.storage_bin}</td>
                    <td>{r.bin_type}</td>
                    <td className="font-mono text-sm text-blue-400">{r.material}</td>
                    <td className="text-right tabular-nums">{parseFloat(r.available_stock).toLocaleString('cs-CZ')}</td>
                    <td className="text-right tabular-nums font-semibold text-red-400">{r.days_dead}</td>
                  </tr>
                ))}</tbody></table>
              </div>
            </div>
          ) : <div className="glass-card p-6 text-center text-emerald-400">✅ Žádné ležáky &gt; {deadStockDays} dní!</div>}
        </div>
      )}

      {/* Downsizing */}
      {activeSubTab === 'downsize' && (
        <div>
          <div className="mb-4">
            <label className="text-sm text-slate-500">Max. kusů na pozici:
              <input type="number" min={1} max={100} value={downsizingLimit} onChange={e => setDownsizingLimit(parseInt(e.target.value) || 10)}
                className="ml-3 w-20 px-3 py-1.5 bg-slate-800 border border-white/10 rounded-lg text-slate-200 text-sm" />
            </label>
          </div>
          {downsizing.length > 0 ? (
            <div className="glass-card overflow-hidden">
              <p className="p-3 text-emerald-400 text-sm font-semibold">✅ {downsizing.length} pozic k přeskladnění (P → K1)</p>
              <div className="overflow-x-auto max-h-96">
                <table className="data-table"><thead><tr>
                  <th>Lokace</th><th>Typ</th><th>{t.material}</th><th className="text-right">Zásoba</th>
                </tr></thead><tbody>{downsizing.map((r, i) => (
                  <tr key={i}>
                    <td className="font-mono text-xs">{r.storage_bin}</td>
                    <td className="text-amber-400">{r.bin_type}</td>
                    <td className="font-mono text-sm text-blue-400">{r.material}</td>
                    <td className="text-right tabular-nums">{parseFloat(r.available_stock).toLocaleString('cs-CZ')}</td>
                  </tr>
                ))}</tbody></table>
              </div>
            </div>
          ) : <div className="glass-card p-6 text-center text-slate-500">Žádné kandidáty s ≤ {downsizingLimit} ks.</div>}
        </div>
      )}
    </div>
  );
}
