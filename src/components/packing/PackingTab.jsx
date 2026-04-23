'use client';
import React, { useMemo } from 'react';
import { useUI } from '@/hooks/useUI';
import { useData } from '@/hooks/useData';
import KPICard from '@/components/shared/KPICard';
import SectionHeader from '@/components/shared/SectionHeader';
import { Gift, Clock, Package, BarChart3, Users } from 'lucide-react';
import { parsePackingTime } from '@/lib/pickingEngine';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';

const PIE_COLORS = ['#3b82f6','#10b981','#f59e0b','#ef4444','#8b5cf6','#ec4899','#14b8a6','#f97316'];

export default function PackingTab() {
  const { t } = useUI();
  const { oeTimesData, vekpData, vepoData, isLoading } = useData();

  const oeStats = useMemo(() => {
    if (!oeTimesData || oeTimesData.length === 0) return null;
    const times = oeTimesData.map(r => parsePackingTime(r.process_time)).filter(t => t > 0);
    const avg = times.length > 0 ? times.reduce((s, v) => s + v, 0) / times.length : 0;
    const total = oeTimesData.length;

    // By customer
    const byCust = {};
    oeTimesData.forEach(r => {
      const c = r.customer || 'Neznámý';
      if (!byCust[c]) byCust[c] = { customer: c, count: 0, totalTime: 0 };
      byCust[c].count++;
      byCust[c].totalTime += parsePackingTime(r.process_time);
    });
    const custData = Object.values(byCust).sort((a, b) => b.count - a.count).slice(0, 10)
      .map(c => ({ ...c, avgTime: c.count > 0 ? +(c.totalTime / c.count).toFixed(1) : 0 }));

    // By shift
    const byShift = {};
    oeTimesData.forEach(r => {
      const s = r.shift || 'N/A';
      if (!byShift[s]) byShift[s] = { name: s, value: 0 };
      byShift[s].value++;
    });
    const shiftData = Object.values(byShift);

    return { avg, total, custData, shiftData, times };
  }, [oeTimesData]);

  const billingStats = useMemo(() => {
    if (!vekpData || vekpData.length === 0) return null;
    return {
      totalHUs: vekpData.length,
      totalDeliveries: new Set(vekpData.map(r => r.generated_delivery).filter(Boolean)).size,
      totalWeight: vekpData.reduce((s, r) => s + parseFloat(r.total_weight || 0), 0),
    };
  }, [vekpData]);

  if (isLoading) return <div className="space-y-4">{[1,2,3].map(i => <div key={i} className="skeleton h-24 w-full" />)}</div>;

  const hasData = oeStats || billingStats;

  if (!hasData) {
    return (
      <div className="space-y-6">
        <SectionHeader title={t.packingTitle} description={t.packingDesc} icon={Gift} />
        <div className="glass-card p-12 text-center">
          <Gift className="w-16 h-16 text-slate-600 mx-auto mb-4" />
          <h3 className="text-xl font-bold text-slate-400 mb-2">{t.noData}</h3>
          <p className="text-slate-500">Nahrajte OE-Times, VEKP nebo VEPO v sekci Admin & Import.</p>
        </div>
      </div>
    );
  }

  const chartTooltipStyle = { backgroundColor: 'rgba(15,23,42,0.95)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 12 };

  return (
    <div className="space-y-6">
      <SectionHeader title={t.packingTitle} description={t.packingDesc} icon={Gift} />

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <KPICard title={t.totalPacked} value={oeStats?.total || 0} icon={Package} color="teal" />
        <KPICard title={t.avgPackingTime} value={oeStats ? `${oeStats.avg.toFixed(1)} min` : '—'} icon={Clock} color="blue" />
        {billingStats && <>
          <KPICard title="Handling Units" value={billingStats.totalHUs} icon={Package} color="purple" />
          <KPICard title="Celková váha" value={`${(billingStats.totalWeight / 1000).toFixed(1)} t`} icon={BarChart3} color="yellow" />
        </>}
      </div>

      {/* OE-Times by Customer */}
      {oeStats && oeStats.custData.length > 0 && (
        <>
          <SectionHeader title="Balení dle zákazníka" icon={Users} />
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <div className="glass-card p-4" style={{ height: 350 }}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={oeStats.custData} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                  <XAxis type="number" tick={{ fill: '#94a3b8', fontSize: 11 }} />
                  <YAxis dataKey="customer" type="category" width={100} tick={{ fill: '#94a3b8', fontSize: 11 }} />
                  <Tooltip contentStyle={chartTooltipStyle} />
                  <Bar dataKey="count" name="Počet balíků" fill="#14b8a6" radius={[0,4,4,0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
            <div className="glass-card p-4" style={{ height: 350 }}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={oeStats.custData} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                  <XAxis type="number" tick={{ fill: '#94a3b8', fontSize: 11 }} />
                  <YAxis dataKey="customer" type="category" width={100} tick={{ fill: '#94a3b8', fontSize: 11 }} />
                  <Tooltip contentStyle={chartTooltipStyle} />
                  <Bar dataKey="avgTime" name="Prům. čas (min)" fill="#f59e0b" radius={[0,4,4,0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </>
      )}

      {/* Shift pie */}
      {oeStats && oeStats.shiftData.length > 1 && (
        <div className="glass-card p-4 flex items-center justify-center" style={{ height: 300 }}>
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie data={oeStats.shiftData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={100} innerRadius={60} paddingAngle={4} label>
                {oeStats.shiftData.map((_, i) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
              </Pie>
              <Tooltip contentStyle={chartTooltipStyle} />
              <Legend />
            </PieChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
}
