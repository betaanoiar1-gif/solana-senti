import React, { useState } from 'react';
import {
  Activity,
  Server,
  Database,
  Wifi,
  Clock,
  Settings,
  Bell,
  Trash2,
  CheckCircle,
  ShieldAlert,
  Cpu,
} from 'lucide-react';
import { AlertNotification, SentinelSettings, SystemHealthStatus } from '../types';

interface SystemHealthTabProps {
  health: SystemHealthStatus | null;
  settings: SentinelSettings;
  alerts: AlertNotification[];
  isAr: boolean;
  onUpdateSettings: (newSettings: Partial<SentinelSettings>) => Promise<void>;
  onClearAlerts: () => Promise<void>;
  onMarkAlertRead: (id: string) => Promise<void>;
}

export const SystemHealthTab: React.FC<SystemHealthTabProps> = ({
  health,
  settings,
  alerts,
  isAr,
  onUpdateSettings,
  onClearAlerts,
  onMarkAlertRead,
}) => {
  const [formSettings, setFormSettings] = useState<SentinelSettings>(settings);
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    setSaveSuccess(false);
    try {
      await onUpdateSettings(formSettings);
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);
    } finally {
      setIsSaving(false);
    }
  };

  const timezones = [
    { label: 'UTC (توقيت غرينتش الموحد)', value: 'UTC' },
    { label: 'Asia/Riyadh (الرياض / مكة المكرمة)', value: 'Asia/Riyadh' },
    { label: 'Asia/Dubai (دبي / أبوظبي)', value: 'Asia/Dubai' },
    { label: 'Europe/London (لندن)', value: 'Europe/London' },
    { label: 'America/New_York (نيويورك EST)', value: 'America/New_York' },
    { label: 'Asia/Tokyo (طوكيو)', value: 'Asia/Tokyo' },
  ];

  const getHealthBadge = (status?: string) => {
    if (status === 'HEALTHY' || status === 'RUNNING' || status === 'CONFIGURED') {
      return (
        <span className="px-2 py-0.5 rounded text-[11px] font-mono font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
          {status}
        </span>
      );
    }
    if (status === 'RATE_LIMITED' || status === 'CACHED' || status === 'READY' || status === 'DEGRADED') {
      return (
        <span className="px-2 py-0.5 rounded text-[11px] font-mono font-bold bg-amber-500/10 text-amber-400 border border-amber-500/20">
          {status}
        </span>
      );
    }
    return (
      <span className="px-2 py-0.5 rounded text-[11px] font-mono font-bold bg-rose-500/10 text-rose-400 border border-rose-500/20">
        {status || 'UNKNOWN'}
      </span>
    );
  };

  return (
    <div className="space-y-6">
      {/* Diagnostics Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {/* Backend & Node */}
        <div className="p-4 rounded-2xl bg-slate-900/60 border border-slate-800 space-y-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Server className="w-4 h-4 text-indigo-400" />
              <span className="text-xs font-bold text-white">Express Backend</span>
            </div>
            {getHealthBadge(health?.backend)}
          </div>
          <div className="text-xs text-slate-400 font-mono">
            Uptime: {health ? `${Math.floor(health.uptimeSeconds / 60)}m ${health.uptimeSeconds % 60}s` : 'Connecting...'}
          </div>
        </div>

        {/* Database */}
        <div className="p-4 rounded-2xl bg-slate-900/60 border border-slate-800 space-y-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Database className="w-4 h-4 text-cyan-400" />
              <span className="text-xs font-bold text-white">SQLite Database</span>
            </div>
            {getHealthBadge(health?.database)}
          </div>
          <div className="text-xs text-slate-400 font-mono truncate" title={health?.dbPath}>
            {health?.dbPath || './data/sentinel.db'}
          </div>
        </div>

        {/* Scheduler */}
        <div className="p-4 rounded-2xl bg-slate-900/60 border border-slate-800 space-y-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Clock className="w-4 h-4 text-emerald-400" />
              <span className="text-xs font-bold text-white">Market Scheduler</span>
            </div>
            {getHealthBadge(health?.scheduler)}
          </div>
          <div className="text-xs text-slate-400 font-mono">
            Sync Cycle: {settings.pollIntervalSeconds}s
          </div>
        </div>

        {/* DEX Screener Connector */}
        <div className="p-4 rounded-2xl bg-slate-900/60 border border-slate-800 space-y-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Wifi className="w-4 h-4 text-indigo-400" />
              <span className="text-xs font-bold text-white">DEX Screener API</span>
            </div>
            {getHealthBadge(health?.dexScreener)}
          </div>
          <div className="text-xs text-slate-400 font-mono">
            Last Sync: {health?.lastSuccessfulSyncAt ? new Date(health.lastSuccessfulSyncAt).toLocaleTimeString() : 'Pending'}
          </div>
        </div>

        {/* Solana Public RPC */}
        <div className="p-4 rounded-2xl bg-slate-900/60 border border-slate-800 space-y-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Activity className="w-4 h-4 text-cyan-400" />
              <span className="text-xs font-bold text-white">Solana Public RPC</span>
            </div>
            {getHealthBadge(health?.solanaRpc)}
          </div>
          <div className="text-xs text-slate-400 font-mono">
            Commitment: confirmed
          </div>
        </div>

        {/* Gemini AI Engine */}
        <div className="p-4 rounded-2xl bg-slate-900/60 border border-slate-800 space-y-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Cpu className="w-4 h-4 text-purple-400" />
              <span className="text-xs font-bold text-white">Gemini 4 Argon AI</span>
            </div>
            {getHealthBadge(health?.geminiAi)}
          </div>
          <div className="text-xs text-slate-400 font-mono">
            ThinkingLevel: HIGH
          </div>
        </div>
      </div>

      {/* Main Split: Settings & Alerts Manager */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Settings Form */}
        <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-5 space-y-4">
          <div className="flex items-center gap-2 mb-2">
            <Settings className="w-4 h-4 text-indigo-400" />
            <h3 className="text-sm font-bold text-white uppercase tracking-wider">
              {isAr ? 'إعدادات المنصة المركزية (SENTINEL_CONFIG)' : 'Sentinel System Settings'}
            </h3>
          </div>

          <form onSubmit={handleSave} className="space-y-4">
            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1">
                {isAr ? 'المنطقة الزمنية للعرض (Timezone)' : 'Display Timezone'}
              </label>
              <select
                value={formSettings.timezone}
                onChange={(e) => setFormSettings({ ...formSettings, timezone: e.target.value })}
                className="w-full px-3 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-xs text-white focus:outline-none focus:border-indigo-500"
              >
                {timezones.map((tz) => (
                  <option key={tz.value} value={tz.value}>
                    {tz.label}
                  </option>
                ))}
              </select>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1">
                  {isAr ? 'سعر SOL الافتراضي ($)' : 'SOL Price Reference ($)'}
                </label>
                <input
                  type="number"
                  step="0.1"
                  value={formSettings.solPriceUsd}
                  onChange={(e) => setFormSettings({ ...formSettings, solPriceUsd: Number(e.target.value) })}
                  className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-xs font-mono text-white"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1">
                  {isAr ? 'فترة تحديث السوق (ثانية)' : 'Poll Interval (seconds)'}
                </label>
                <input
                  type="number"
                  value={formSettings.pollIntervalSeconds}
                  onChange={(e) => setFormSettings({ ...formSettings, pollIntervalSeconds: Number(e.target.value) })}
                  className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-xs font-mono text-white"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1">
                  {isAr ? 'حد السيولة الأدنى للمسح ($)' : 'Min Liquidity ($)'}
                </label>
                <input
                  type="number"
                  value={formSettings.minLiquidityFilter}
                  onChange={(e) => setFormSettings({ ...formSettings, minLiquidityFilter: Number(e.target.value) })}
                  className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-xs font-mono text-white"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1">
                  {isAr ? 'حاجز الحظر الأمني للمخاطر (0-100)' : 'Risk Block Threshold'}
                </label>
                <input
                  type="number"
                  value={formSettings.riskThresholdBlocked}
                  onChange={(e) => setFormSettings({ ...formSettings, riskThresholdBlocked: Number(e.target.value) })}
                  className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-xs font-mono text-white"
                />
              </div>
            </div>

            {saveSuccess && (
              <div className="p-3 rounded-xl bg-emerald-950/40 text-emerald-300 border border-emerald-500/30 text-xs flex items-center gap-1.5">
                <CheckCircle className="w-4 h-4 text-emerald-400" />
                <span>{isAr ? 'تم حفظ وتطبيق الإعدادات في قاعدة البيانات بنجاح.' : 'Settings saved to SQLite successfully.'}</span>
              </div>
            )}

            <button
              type="submit"
              disabled={isSaving}
              className="w-full py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold transition disabled:opacity-50"
            >
              {isSaving ? (isAr ? 'جاري الحفظ...' : 'Saving...') : (isAr ? 'حفظ الإعدادات' : 'Save Settings')}
            </button>
          </form>
        </div>

        {/* Alerts & System Notifications Feed */}
        <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-5 space-y-4 flex flex-col">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Bell className="w-4 h-4 text-cyan-400" />
              <h3 className="text-sm font-bold text-white uppercase tracking-wider">
                {isAr ? 'سجل التنبيهات والأحداث' : 'Alerts & System Events'} ({alerts.length})
              </h3>
            </div>
            {alerts.length > 0 && (
              <button
                onClick={onClearAlerts}
                className="text-xs text-rose-400 hover:text-rose-300 flex items-center gap-1 font-medium transition"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>{isAr ? 'مسح الكل' : 'Clear all'}</span>
              </button>
            )}
          </div>

          <div className="space-y-2.5 flex-1 max-h-[380px] overflow-y-auto pr-1">
            {alerts.length === 0 ? (
              <div className="text-center py-12 text-slate-500 text-xs">
                {isAr ? 'لا توجد تنبيهات مسجلة' : 'No alerts recorded'}
              </div>
            ) : (
              alerts.map((alert) => (
                <div
                  key={alert.id}
                  onClick={() => onMarkAlertRead(alert.id)}
                  className={`p-3 rounded-xl border text-xs cursor-pointer transition flex items-start gap-3 ${
                    alert.isRead
                      ? 'bg-slate-950/40 border-slate-800/60 text-slate-400'
                      : 'bg-slate-950 border-slate-800 text-slate-200'
                  }`}
                >
                  <div className={`w-2 h-2 rounded-full mt-1.5 shrink-0 ${
                    alert.severity === 'CRITICAL' ? 'bg-rose-500' :
                    alert.severity === 'WARNING' ? 'bg-amber-500' :
                    alert.severity === 'SUCCESS' ? 'bg-emerald-500' : 'bg-cyan-500'
                  }`} />
                  <div className="min-w-0 flex-1">
                    <div className="font-semibold text-white flex items-center justify-between">
                      <span className="truncate">{alert.title}</span>
                      <span className="text-[10px] font-mono text-slate-500">
                        {new Date(alert.createdAt).toLocaleTimeString()}
                      </span>
                    </div>
                    <div className="text-[11px] text-slate-300 mt-0.5 line-clamp-2 leading-relaxed">
                      {alert.message}
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
