// src/components/layout/DashboardLayout.jsx
'use client';
import React, { useState } from 'react';
import Sidebar from './Sidebar';
import AppHeader from './AppHeader';
import DashboardTab from '@/components/dashboard/DashboardTab';
import PickingTab from '@/components/picking/PickingTab';
import PackingTab from '@/components/packing/PackingTab';
import WarehouseTab from '@/components/warehouse/WarehouseTab';
import AdminTab from '@/components/admin/AdminTab';
import TicketsTab from '@/components/admin/TicketsTab';

const DashboardLayout = () => {
  const [activeTab, setActiveTab] = useState('dashboard');
  const [isSidebarOpen, setSidebarOpen] = useState(false);
  const [isSidebarCollapsed, setSidebarCollapsed] = useState(false);

  const renderActiveTab = () => {
    switch (activeTab) {
      case 'dashboard': return <DashboardTab setActiveTab={setActiveTab} />;
      case 'picking': return <PickingTab />;
      case 'packing': return <PackingTab />;
      case 'warehouse': return <WarehouseTab />;
      case 'admin': return <AdminTab />;
      case 'tickets': return <TicketsTab />;
      default: return <DashboardTab setActiveTab={setActiveTab} />;
    }
  };

  return (
    <div className="flex h-screen text-slate-200 overflow-hidden">
      {/* Mobile overlay */}
      {isSidebarOpen && (
        <div
          onClick={() => setSidebarOpen(false)}
          className="fixed inset-0 bg-black/60 z-30 lg:hidden backdrop-blur-sm"
        />
      )}

      <Sidebar
        activeTab={activeTab}
        onTabChange={(tab) => { setActiveTab(tab); setSidebarOpen(false); }}
        isCollapsed={isSidebarCollapsed}
        setCollapsed={setSidebarCollapsed}
      />

      <div className="flex flex-col flex-1 min-w-0">
        <AppHeader
          activeTab={activeTab}
          onMenuClick={() => setSidebarOpen(!isSidebarOpen)}
        />
        <main className="flex-1 overflow-y-auto p-4 md:p-6">
          <div className="animate-fadeInUp">
            {renderActiveTab()}
          </div>
        </main>
      </div>
    </div>
  );
};

export default DashboardLayout;
