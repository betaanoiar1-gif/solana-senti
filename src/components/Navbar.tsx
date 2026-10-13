import React from 'react';
import {
  ShieldAlert,
  Activity,
  RefreshCw,
  Globe,
  Bell,
  Coins,
  Cpu,
  Layers,
  Sparkles,
} from 'lucide-react';
import { SentinelSettings, SystemHealthStatus } from '../types';

interface NavbarProps {
  health: SystemHealthStatus | null;
  settings: SentinelSettings;
  unreadAlertsCount: number;
  isSyncing: boolean;
  activeTab: string;
  onTabChange: (tab: string) => void;
  onLanguageToggle: () => void;
  onManualSync: () => void;
  onOpenAlerts: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  health,
  settings,
  unreadAlertsCount,
  isSyncing,
  activeTab,
  onTabChange,
  onLanguageToggle,
  onManualSync,
  onOpenAlerts,
}) => {
  const isAr = settings.language === 'ar';

  const navItems = [
    { id: 'dashboard', label: isAr ? 'لوحة القيادة' : 'Dashboard', icon: Activity },
    { id: 'scanner', label: isAr ? 'مسح السوق' : 'Scanner', icon: Layers },
    { id: 'paper-trading', label: isAr ? 'التداول الافتراضي' : 'Paper Trading', icon: Coins },
    { id: 'risk-engine', label: isAr ? 'محرك المخاطر' : 'Risk Engine', icon: ShieldAlert },
    { id: 'opportunity-lab', label: isAr ? 'مقياس الفرص' : 'Opportunity Lab', icon: Sparkles },
    { id: 'strategy-lab', label: isAr ? 'مختبر الاستراتيجيات' : 'Backtesting', icon: Cpu },
    { id: 'wallet-intel', label: isAr ? 'استخبارات المحافظ' : 'Wallet Intel', icon: Globe },
    { id: 'system-health', label: isAr ? 'صحة النظام والإعدادات' : 'System Health', icon: Activity },
  ];

  const getStatusColor = () => {
    if (!health) return 'bg-amber-500';
    if (health.backend === 'HEALTHY' && health.database === 'HEALTHY') return 'bg-emerald-500';
    return 'bg-rose-500';
  };

  return (
    <header className="border-b border-slate-800 bg-slate-900/90 backdrop-blur sticky top-0 z-40">
      {/* Top Bar */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Logo & Brand */}
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-indigo-600 via-indigo-500 to-cyan-400 p-0.5 shadow-lg shadow-indigo-500/20 flex items-center justify-center">
              <div className="w-full h-full bg-slate-950 rounded-[10px] flex items-center justify-center">
                <ShieldAlert className="w-5 h-5 text-cyan-400" />
              </div>
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-lg font-bold tracking-tight text-white flex items-center gap-2">
                  SOLANA SENTINEL
                  <span className="text-[10px] font-mono uppercase px-1.5 py-0.5 rounded bg-cyan-500/10 text-cyan-400 border border-cyan-500/20 font-semibold">
                    v2.5
                  </span>
                </h1>
              </div>
              <p className="text-xs text-slate-400 hidden sm:block">
                {isAr
                  ? 'رادار استخبارات ومخاطر Solana والمحاكاة الافتراضية والعلوم اللامركزية (DeSci)'
                  : 'Solana Market Intelligence, Risk Engine & DeSci Paper Simulator'}
              </p>
            </div>
          </div>

          {/* Indicators & Actions */}
          <div className="flex items-center gap-2 sm:gap-3">
            {/* Live Data Badge */}
            <div className="hidden md:flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-mono">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              <span>LIVE MARKET DATA</span>
            </div>

            {/* Paper Trading Mode Badge */}
            <div className="hidden lg:flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-indigo-500/10 border border-indigo-500/20 text-indigo-300 text-xs font-mono font-medium">
              <Coins className="w-3.5 h-3.5 text-indigo-400" />
              <span>PAPER SIMULATION</span>
            </div>

            {/* SOL Price Display */}
            <div className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-slate-800/80 border border-slate-700 text-xs font-mono text-slate-200">
              <span className="text-slate-400 font-sans">SOL:</span>
              <span className="font-semibold text-cyan-300">${settings.solPriceUsd.toFixed(2)}</span>
            </div>

            {/* Manual Sync Trigger */}
            <button
              onClick={onManualSync}
              disabled={isSyncing}
              title={isAr ? 'تحديث ومسح فوري للسوق' : 'Immediate Market Sync'}
              className="p-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition disabled:opacity-50 border border-slate-700 flex items-center justify-center"
            >
              <RefreshCw className={`w-4 h-4 ${isSyncing ? 'animate-spin text-cyan-400' : ''}`} />
            </button>

            {/* Alerts Bell */}
            <button
              onClick={onOpenAlerts}
              title={isAr ? 'التنبيهات' : 'Alerts'}
              className="p-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition relative border border-slate-700"
            >
              <Bell className="w-4 h-4" />
              {unreadAlertsCount > 0 && (
                <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-rose-500 text-white text-[10px] flex items-center justify-center font-bold font-mono animate-bounce">
                  {unreadAlertsCount > 9 ? '9+' : unreadAlertsCount}
                </span>
              )}
            </button>

            {/* Language Switch */}
            <button
              onClick={onLanguageToggle}
              title={isAr ? 'التبديل إلى الإنجليزية' : 'Switch to Arabic'}
              className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs font-medium text-slate-200 border border-slate-700 transition"
            >
              <Globe className="w-3.5 h-3.5 text-slate-400" />
              <span>{isAr ? 'EN' : 'العربية'}</span>
            </button>

            {/* System Status Dot */}
            <div
              title={`System Status: ${health?.backend || 'CONNECTING'}`}
              className="flex items-center gap-1 pl-1"
            >
              <span className={`w-2.5 h-2.5 rounded-full ${getStatusColor()}`} />
            </div>
          </div>
        </div>

        {/* Navigation Tabs */}
        <div className="flex items-center gap-1 overflow-x-auto py-2 scrollbar-none border-t border-slate-800/80">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => onTabChange(item.id)}
                className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition ${
                  isActive
                    ? 'bg-indigo-600 text-white shadow-sm shadow-indigo-500/20'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
                }`}
              >
                <Icon className={`w-3.5 h-3.5 ${isActive ? 'text-white' : 'text-slate-400'}`} />
                <span>{item.label}</span>
              </button>
            );
          })}
        </div>
      </div>
    </header>
  );
};
