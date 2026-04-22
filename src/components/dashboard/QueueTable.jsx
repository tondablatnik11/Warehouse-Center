// src/components/dashboard/QueueTable.jsx
'use client';
import React, { useMemo } from 'react';
import { useUI } from '@/hooks/useUI';
import { splitQueue, QUEUE_DESC } from '@/lib/pickingEngine';

export default function QueueTable({ data }) {
  const { t } = useUI();

  const queueStats = useMemo(() => {
    if (!data || !data.rows || data.rows.length === 0) return [];

    // Group by TO first
    const toGroups = {};
    data.rows.forEach(row => {
      const toKey = row.transfer_order || row.delivery;
      if (!toGroups[toKey]) {
        toGroups[toKey] = {
          queue: row.queue,
          delivery: row.delivery,
          locations: new Set(),
          materials: new Set(),
          qty: 0,
          moves: 0,
          exact: 0,
          miss: 0,
        };
      }
      toGroups[toKey].locations.add(row.source_bin);
      toGroups[toKey].materials.add(row.material);
      toGroups[toKey].qty += row.qty;
      toGroups[toKey].moves += row.moves_total;
      toGroups[toKey].exact += row.moves_exact;
      toGroups[toKey].miss += row.moves_miss;
    });

    // Split queue and aggregate
    const queueAgg = {};
    Object.values(toGroups).forEach(to => {
      const qSplit = splitQueue(to.queue, to.materials.size);
      if (!queueAgg[qSplit]) {
        queueAgg[qSplit] = {
          queue: qSplit,
          toCount: 0,
          deliveries: new Set(),
          totalLocs: 0,
          totalQty: 0,
          totalMoves: 0,
          totalExact: 0,
          totalMiss: 0,
        };
      }
      queueAgg[qSplit].toCount++;
      queueAgg[qSplit].deliveries.add(to.delivery);
      queueAgg[qSplit].totalLocs += to.locations.size;
      queueAgg[qSplit].totalQty += to.qty;
      queueAgg[qSplit].totalMoves += to.moves;
      queueAgg[qSplit].totalExact += to.exact;
      queueAgg[qSplit].totalMiss += to.miss;
    });

    return Object.values(queueAgg).map(q => ({
      queue: q.queue,
      desc: QUEUE_DESC[q.queue] || '',
      toCount: q.toCount,
      deliveries: q.deliveries.size,
      avgLocsPerTO: q.toCount > 0 ? (q.totalLocs / q.toCount) : 0,
      avgMovesPerLoc: q.totalLocs > 0 ? (q.totalMoves / q.totalLocs) : 0,
      avgExactPerLoc: q.totalLocs > 0 ? (q.totalExact / q.totalLocs) : 0,
      avgMissPerLoc: q.totalLocs > 0 ? (q.totalMiss / q.totalLocs) : 0,
      pctExact: q.totalMoves > 0 ? (q.totalExact / q.totalMoves * 100) : 0,
      pctMiss: q.totalMoves > 0 ? (q.totalMiss / q.totalMoves * 100) : 0,
    })).sort((a, b) => b.toCount - a.toCount);
  }, [data]);

  if (queueStats.length === 0) return null;

  return (
    <div className="glass-card overflow-hidden">
      <div className="overflow-x-auto">
        <table className="data-table">
          <thead>
            <tr>
              <th>Queue</th>
              <th>{t.queueDesc}</th>
              <th className="text-right">{t.totalTOs}</th>
              <th className="text-right">{t.totalDeliveries}</th>
              <th className="text-right">{t.avgLocsPerTO}</th>
              <th className="text-right">{t.avgMovesPerLoc}</th>
              <th className="text-right">{t.exactPerLoc}</th>
              <th className="text-right">{t.pctExact}</th>
              <th className="text-right">{t.estPerLoc}</th>
              <th className="text-right">{t.pctEstimate}</th>
            </tr>
          </thead>
          <tbody>
            {queueStats.map(q => (
              <tr key={q.queue}>
                <td className="font-semibold text-blue-400">{q.queue}</td>
                <td className="text-slate-500">{q.desc}</td>
                <td className="text-right tabular-nums">{q.toCount.toLocaleString('cs-CZ')}</td>
                <td className="text-right tabular-nums">{q.deliveries.toLocaleString('cs-CZ')}</td>
                <td className="text-right tabular-nums">{q.avgLocsPerTO.toFixed(1)}</td>
                <td className="text-right tabular-nums font-semibold">{q.avgMovesPerLoc.toFixed(2)}</td>
                <td className="text-right tabular-nums text-emerald-400">{q.avgExactPerLoc.toFixed(2)}</td>
                <td className="text-right tabular-nums">
                  <span className={`badge ${q.pctExact > 80 ? 'bg-emerald-500/20 text-emerald-400' : q.pctExact > 50 ? 'bg-amber-500/20 text-amber-400' : 'bg-red-500/20 text-red-400'}`}>
                    {q.pctExact.toFixed(1)}%
                  </span>
                </td>
                <td className="text-right tabular-nums text-amber-400">{q.avgMissPerLoc.toFixed(2)}</td>
                <td className="text-right tabular-nums">
                  <span className={`badge ${q.pctMiss < 20 ? 'bg-emerald-500/20 text-emerald-400' : q.pctMiss < 50 ? 'bg-amber-500/20 text-amber-400' : 'bg-red-500/20 text-red-400'}`}>
                    {q.pctMiss.toFixed(1)}%
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
