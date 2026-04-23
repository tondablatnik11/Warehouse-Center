// src/components/layout/Sidebar.jsx
'use client';
import React, { useState } from 'react';
import { useUI } from '@/hooks/useUI';
import {
  LayoutDashboard, PackageCheck, Gift, Warehouse,
  Settings, ChevronDown, ChevronsLeft, ChevronsRight,
  Upload, Ticket, Globe
} from 'lucide-react';

const Sidebar = ({ activeTab, onTabChange, isCollapsed, setCollapsed }) => {
  const { t, toggleLang, lang } = useUI();
  const [openGroup, setOpenGroup] = useState(null);

  const menuItems = [
    { id: 'dashboard', label: t.navDashboard, icon: LayoutDashboard },
    { id: 'picking', label: t.navPicking, icon: PackageCheck },
    { id: 'packing', label: t.navPacking, icon: Gift },
    { id: 'warehouse', label: t.navWarehouse, icon: Warehouse },
    {
      id: 'admin-group',
      label: t.navAdmin,
      icon: Settings,
      subItems: [
        { id: 'admin', label: t.uploadTitle, icon: Upload },
        { id: 'tickets', label: t.tickets, icon: Ticket },
      ]
    },
  ];

  const NavItem = ({ item, isSubItem = false }) => {
    const isActive = activeTab === item.id;
    return (
      <button
        onClick={() => onTabChange(item.id)}
        title={isCollapsed ? item.label : ''}
        className={`sidebar-link w-full text-left ${isSubItem ? 'pl-12 py-2' : ''} ${isActive ? 'active' : ''}`}
      >
        {item.icon && <item.icon className="w-5 h-5 flex-shrink-0" />}
        {!isCollapsed && (
          <span className="whitespace-nowrap overflow-hidden">{item.label}</span>
        )}
      </button>
    );
  };

  const NavGroup = ({ item }) => {
    const isGroupActive = item.subItems?.some(sub => sub.id === activeTab);
    const isOpen = openGroup === item.id;

    return (
      <div>
        <button
          onClick={() => setOpenGroup(isOpen ? null : item.id)}
          className={`sidebar-link w-full justify-between ${isGroupActive ? 'text-blue-400' : ''}`}
        >
          <div className="flex items-center gap-3">
            <item.icon className="w-5 h-5 flex-shrink-0" />
            {!isCollapsed && <span>{item.label}</span>}
          </div>
          {!isCollapsed && (
            <ChevronDown className={`w-4 h-4 transition-transform duration-300 ${isOpen ? 'rotate-180' : ''}`} />
          )}
        </button>
        <div className={`overflow-hidden transition-all duration-300 ease-in-out ${isOpen && !isCollapsed ? 'max-h-48 mt-1' : 'max-h-0'}`}>
          {item.subItems?.map(sub => (
            <NavItem key={sub.id} item={sub} isSubItem />
          ))}
        </div>
      </div>
    );
  };

  return (
    <aside className={`fixed inset-y-0 left-0 z-40 flex flex-col justify-between border-r border-white/[0.06] transition-all duration-300 ease-in-out lg:static lg:translate-x-0 ${isCollapsed ? 'w-20 p-3' : 'w-64 p-4'}`}
      style={{ background: 'rgba(10, 14, 23, 0.85)', backdropFilter: 'blur(20px)' }}>

      {/* Logo */}
      <div>
        <div className={`flex items-center h-16 mb-6 ${isCollapsed ? 'justify-center' : 'justify-between'}`}>
          {!isCollapsed ? (
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-blue-500 to-cyan-400 flex items-center justify-center font-bold text-white text-sm shadow-lg shadow-blue-500/20">
                WC
              </div>
              <div>
                <h1 className="text-base font-bold text-white leading-tight">Warehouse</h1>
                <p className="text-xs text-slate-500 leading-tight">Center</p>
              </div>
            </div>
          ) : (
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-blue-500 to-cyan-400 flex items-center justify-center font-bold text-white text-sm">
              WC
            </div>
          )}
          <button
            onClick={() => setCollapsed(!isCollapsed)}
            className="hidden lg:flex p-1.5 rounded-lg hover:bg-white/5 text-slate-500 transition-colors"
          >
            {isCollapsed ? <ChevronsRight size={16} /> : <ChevronsLeft size={16} />}
          </button>
        </div>

        {/* Navigation */}
        <nav className="space-y-1">
          {menuItems.map(item => (
            <div key={item.id}>
              {item.subItems ? <NavGroup item={item} /> : <NavItem item={item} />}
            </div>
          ))}
        </nav>
      </div>

      {/* Bottom */}
      <div className="space-y-2 border-t border-white/[0.06] pt-4">
        <button
          onClick={toggleLang}
          className="sidebar-link w-full"
        >
          <Globe className="w-5 h-5 flex-shrink-0" />
          {!isCollapsed && <span>{t.switchLang}</span>}
        </button>
      </div>
    </aside>
  );
};

export default Sidebar;
