// src/components/admin/TicketsTab.jsx
'use client';
import React from 'react';
import SectionHeader from '@/components/shared/SectionHeader';
import { Ticket, Construction } from 'lucide-react';

export default function TicketsTab() {
  return (
    <div className="space-y-6">
      <SectionHeader
        title="Tickety"
        description="Správa úkolů a ticketů."
        icon={Ticket}
      />
      <div className="glass-card p-12 text-center">
        <Construction className="w-16 h-16 text-amber-400/40 mx-auto mb-4" />
        <h3 className="text-xl font-bold text-slate-300 mb-2">Tickety — Připravuje se</h3>
        <p className="text-slate-500">Kanban-style úkoly s přiřazením uživatelům.</p>
      </div>
    </div>
  );
}
