// src/components/dashboard/DashboardTab.jsx
'use client';
import React, { useMemo } from 'react';
import { useUI } from '@/hooks/useUI';
import { useData } from '@/hooks/useData';
import KPICard, { KPICardSkeleton } from '@/components/shared/KPICard';
import SectionHeader from '@/components/shared/SectionHeader';
import QueueTable from '@/components/dashboard/QueueTable';
import DataReliabilityCard from '@/components/dashboard/DataReliabilityCard';
import {
  Package, CheckCircle, Clock, AlertTriangle,
  Zap, Gift, BarChart3, Target
} from 'lucide-react';
import { processPickData, computeMoves, splitQueue, QUEUE_DESC, getMatchKey } from '@/lib/pickingEngine';

export default function DashboardTab({ setActiveTab }) {
  const { t } = useUI();
  const { pickData, deliveriesData, marmData, manualMaster, queueData, oeTimesData, isLoading } = useData();

  // Process pick data with ergonomic model
  const processedData = useMemo(() => {
    if (!pickData || pickData.length === 0) return null;

    // Build box/weight/dim lookups from MARM
    const boxDict = {};
    const weightDict = {};
    const dimDict = {};

    if (marmData && marmData.length > 0) {
      const BOX_UNITS = new Set(['AEK', 'KAR', 'KART', 'PAK', 'VPE', 'CAR', 'BLO', 'ASK', 'BAG', 'PAC']);
      marmData.forEach(row => {
        const key = getMatchKey(row.material || '');
        const unit = String(row.alt_unit || '').toUpperCase();
        if (BOX_UNITS.has(unit)) {
          const num = parseFloat(row.numerator);
          if (num > 1) {
            if (!boxDict[key]) boxDict[key] = [];
            boxDict[key].push(num);
          }
        }
        if (['ST', 'PCE', 'KS', 'EA', 'PC'].includes(unit)) {
          const w = parseFloat(row.gross_weight || 0);
          const wUnit = String(row.weight_unit || '').toUpperCase();
          weightDict[key] = wUnit === 'G' ? w / 1000 : w;
          
          const l = parseFloat(row.length || 0);
          const wi = parseFloat(row.width || 0);
          const h = parseFloat(row.height || 0);
          dimDict[key] = Math.max(l, wi, h);
        }
      });
    }

    // Sort box sizes descending
    Object.keys(boxDict).forEach(k => {
      boxDict[k] = boxDict[k].sort((a, b) => b - a);
    });

    // Build manual overrides
    const manualBoxes = {};
    if (manualMaster && manualMaster.length > 0) {
      manualMaster.forEach(row => {
        const key = getMatchKey(row.material || '');
        if (row.box_sizes) {
          try {
            manualBoxes[key] = JSON.parse(row.box_sizes);
          } catch { /* ignore */ }
        }
      });
    }

    // Build queue map
    const queueMap = {};
    if (queueData && queueData.length > 0) {
      queueData.forEach(row => {
        if (row.transfer_order && row.queue) {
          queueMap[row.transfer_order] = row.queue;
        }
      });
    }

    // Enrich pick rows
    const config = { weightLimit: 2.0, dimLimit: 15.0, grabLimit: 1 };
    const enriched = pickData.map(row => {
      const matKey = getMatchKey(row.material || '');
      const qty = parseFloat(row.qty || 0);
      const queue = row.queue || queueMap[row.transfer_order] || 'N/A';
      const boxSizes = manualBoxes[matKey] || boxDict[matKey] || [];
      const pw = weightDict[matKey] || 0;
      const pd = dimDict[matKey] || 0;
      const moves = computeMoves(qty, queue, row.removal_su || '', boxSizes, pw, pd, config);

      return {
        ...row,
        qty,
        queue,
        match_key: matKey,
        box_sizes: boxSizes,
        piece_weight: pw,
        piece_dim: pd,
        moves_total: moves.total,
        moves_exact: moves.exact,
        moves_miss: moves.miss,
        total_weight: qty * pw,
      };
    });

    // Summary stats
    const totalMoves = enriched.reduce((s, r) => s + r.moves_total, 0);
    const exactMoves = enriched.reduce((s, r) => s + r.moves_exact, 0);
    const missMoves = enriched.reduce((s, r) => s + r.moves_miss, 0);
    const totalQty = enriched.reduce((s, r) => s + r.qty, 0);
    const uniqueDeliveries = new Set(enriched.map(r => r.delivery)).size;
    const uniqueTOs = new Set(enriched.map(r => r.transfer_order)).size;
    const uniqueMaterials = new Set(enriched.map(r => r.material)).size;

    return {
      rows: enriched,
      totalMoves,
      exactMoves,
      missMoves,
      totalQty,
      uniqueDeliveries,
      uniqueTOs,
      uniqueMaterials,
      pctExact: totalMoves > 0 ? (exactMoves / totalMoves * 100) : 0,
      pctMiss: totalMoves > 0 ? (missMoves / totalMoves * 100) : 0,
    };
  }, [pickData, marmData, manualMaster, queueData]);

  // Delivery summary
  const deliverySummary = useMemo(() => {
    if (!deliveriesData || deliveriesData.length === 0) return null;

    const total = deliveriesData.length;
    const doneStatuses = [50, 60, 70, 80, 90];
    const remainingStatuses = [10, 31, 35, 40];

    const done = deliveriesData.filter(d => doneStatuses.includes(Number(d.status))).length;
    const remaining = deliveriesData.filter(d => remainingStatuses.includes(Number(d.status))).length;

    // Delayed — remaining with loading date in the past
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const delayed = deliveriesData.filter(d => {
      if (!remainingStatuses.includes(Number(d.status))) return false;
      const loadDate = d.loading_date ? new Date(d.loading_date) : null;
      return loadDate && loadDate < today;
    }).length;

    return { total, done, remaining, delayed };
  }, [deliveriesData]);

  // Packing summary
  const packingSummary = useMemo(() => {
    if (!oeTimesData || oeTimesData.length === 0) return null;
    return {
      totalPacked: oeTimesData.length,
    };
  }, [oeTimesData]);

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-6 gap-4">
          {Array.from({ length: 6 }).map((_, i) => <KPICardSkeleton key={i} />)}
        </div>
      </div>
    );
  }

  const hasPickData = processedData && processedData.rows.length > 0;
  const hasDeliveryData = deliverySummary !== null;

  return (
    <div className="space-y-6">
      {/* KPI Cards Row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
        <KPICard
          title={t.totalOrders}
          value={hasDeliveryData ? deliverySummary.total : (hasPickData ? processedData.uniqueDeliveries : 0)}
          icon={Package}
          color="blue"
          subtitle={hasPickData ? `${processedData.uniqueTOs.toLocaleString('cs-CZ')} TO` : null}
        />
        <KPICard
          title={t.doneOrders}
          value={hasDeliveryData ? deliverySummary.done : 0}
          icon={CheckCircle}
          color="green"
        />
        <KPICard
          title={t.remainingOrders}
          value={hasDeliveryData ? deliverySummary.remaining : 0}
          icon={Clock}
          color="yellow"
        />
        <KPICard
          title={t.delayedOrders}
          value={hasDeliveryData ? deliverySummary.delayed : 0}
          icon={AlertTriangle}
          color="red"
          onClick={() => setActiveTab && setActiveTab('picking')}
        />
        <KPICard
          title={t.totalMoves}
          value={hasPickData ? processedData.totalMoves : 0}
          icon={Zap}
          color="purple"
          subtitle={hasPickData ? `${processedData.totalQty.toLocaleString('cs-CZ')} ks` : null}
          onClick={() => setActiveTab && setActiveTab('picking')}
        />
        <KPICard
          title={t.totalPacked}
          value={packingSummary ? packingSummary.totalPacked : 0}
          icon={Gift}
          color="teal"
          onClick={() => setActiveTab && setActiveTab('packing')}
        />
      </div>

      {/* Data Reliability + Queue Analytics */}
      {hasPickData && (
        <>
          <DataReliabilityCard data={processedData} />

          <SectionHeader
            title={t.queueAnalytics}
            icon={BarChart3}
          />
          <QueueTable data={processedData} />
        </>
      )}

      {/* Empty State */}
      {!hasPickData && !hasDeliveryData && (
        <div className="glass-card p-12 text-center">
          <Package className="w-16 h-16 text-slate-600 mx-auto mb-4" />
          <h3 className="text-xl font-bold text-slate-400 mb-2">{t.noData}</h3>
          <p className="text-slate-500 mb-6 max-w-md mx-auto">
            Začněte nahráním SAP reportů v sekci Admin & Import.
          </p>
          <button
            onClick={() => setActiveTab && setActiveTab('admin')}
            className="px-6 py-3 bg-blue-500/20 hover:bg-blue-500/30 text-blue-400 rounded-xl font-semibold transition-colors border border-blue-500/30"
          >
            {t.navAdmin} →
          </button>
        </div>
      )}
    </div>
  );
}
