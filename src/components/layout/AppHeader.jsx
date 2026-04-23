// src/components/layout/AppHeader.jsx
'use client';
import React from 'react';
import { useUI } from '@/hooks/useUI';
import { Menu, Search, RefreshCw } from 'lucide-react';
import { useData } from '@/hooks/useData';

const AppHeader = ({ onMenuClick, activeTab }) => {
  const { t } = useUI();
  const { refetchData, isLoading } = useData();

  const tabTitles = {
    dashboard: t.navDashboard,
    picking: t.navPicking,
    packing: t.navPacking,
    warehouse: t.navWarehouse,
    admin: t.navAdmin,
    tickets: t.tickets,
  };

  return (
    <header className="sticky top-0 z-20 flex items-center justify-between px-4 md:px-6 h-16 border-b border-white/[0.06]"
      style={{ background: 'rgba(10, 14, 23, 0.7)', backdropFilter: 'blur(16px)' }}>

      <div className="flex items-center gap-4">
        <button
          onClick={onMenuClick}
          className="lg:hidden p-2 rounded-lg hover:bg-white/5 text-slate-400"
        >
          <Menu size={20} />
        </button>
        <div>
          <h2 className="text-lg font-bold text-white">{tabTitles[activeTab] || t.navDashboard}</h2>
        </div>
      </div>

      <div className="flex items-center gap-3">
        {/* Search */}
        <div className="hidden md:flex items-center gap-2 px-4 py-2 rounded-xl bg-white/[0.04] border border-white/[0.06] text-slate-400 text-sm">
          <Search size={16} />
          <input
            type="text"
            placeholder={t.search}
            className="bg-transparent border-none outline-none text-slate-300 placeholder-slate-500 w-48"
          />
        </div>

        {/* Refresh */}
        <button
          onClick={refetchData}
          disabled={isLoading}
          className="p-2 rounded-xl hover:bg-white/5 text-slate-400 hover:text-white transition-colors disabled:opacity-50"
          title="Obnovit data"
        >
          <RefreshCw size={18} className={isLoading ? 'animate-spin' : ''} />
        </button>
      </div>
    </header>
  );
};

export default AppHeader;
