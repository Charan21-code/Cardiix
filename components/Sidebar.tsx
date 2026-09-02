import React from 'react';
import { NavLink } from 'react-router-dom';
import { Activity, MessageSquare, FileText, Heart, ScanFace } from 'lucide-react';

const Sidebar: React.FC = () => {
  const navItems = [
    { path: '/dashboard', label: 'Dashboard', icon: Activity, end: true },
    { path: '/dashboard/scan', label: 'Vital Scan', icon: ScanFace },
    { path: '/dashboard/reports', label: 'Report Analyzer', icon: FileText },
    { path: '/dashboard/chat', label: 'Cardiix AI', icon: MessageSquare },
  ];

  return (
    <nav className="bg-white/90 backdrop-blur-xl border border-white shadow-xl shadow-orange-900/5 rounded-full px-4 py-3 flex items-center justify-between gap-4 md:gap-8 min-w-max">
      {/* Branding */}
      <NavLink
        to="/"
        className="flex items-center gap-3 pr-4 md:pr-6 border-r border-slate-200 hover:opacity-80 transition-opacity"
      >
        <div className="w-9 h-9 shrink-0 bg-gradient-to-br from-orange-500 to-red-500 rounded-lg flex items-center justify-center shadow-md shadow-orange-500/20">
          <Heart size={18} className="text-white" fill="currentColor" />
        </div>
        <span className="text-xl font-display font-bold tracking-tight text-slate-800 hidden sm:block">
          Cardiix
        </span>
      </NavLink>

      {/* Navigation */}
      <div className="flex items-center gap-1 md:gap-2">
        {navItems.map((item) => (
          <NavLink
            key={item.path}
            to={item.path}
            end={item.end}
            className={({ isActive }) => `
              flex items-center gap-2 px-3 md:px-5 py-2.5 rounded-full transition-all duration-200 group font-medium text-sm
              ${isActive
                ? 'bg-orange-100 text-orange-700 shadow-sm border border-orange-200/50'
                : 'text-slate-500 hover:bg-slate-50 hover:text-slate-900 border border-transparent'
              }
            `}
            title={item.label}
          >
            {({ isActive }) => (
              <>
                <item.icon size={18} className={isActive ? "text-orange-600" : "text-slate-400 group-hover:text-slate-600"} />
                <span className="hidden lg:block">{item.label}</span>
              </>
            )}
          </NavLink>
        ))}
      </div>
    </nav>
  );
};

export default Sidebar;
