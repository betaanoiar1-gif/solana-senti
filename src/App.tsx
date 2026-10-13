import React, { useEffect, useState, useCallback } from 'react';
import { Navbar } from './components/Navbar';
import { DashboardTab } from './components/DashboardTab';
import { ScannerTab } from './components/ScannerTab';
import { PaperTradingTab } from './components/PaperTradingTab';
import { RiskRadarTab } from './components/RiskRadarTab';
import { OpportunityLabTab } from './components/OpportunityLabTab';
import { StrategyLabTab } from './components/StrategyLabTab';
import { WalletIntelTab } from './components/WalletIntelTab';
import { SystemHealthTab } from './components/SystemHealthTab';
import { TokenDossierModal } from './components/TokenDossierModal';
import { api } from './services/api';
import {
  AlertNotification,
  BacktestResult,
  SentinelSettings,
  StrategyConfig,
  SystemHealthStatus,
  TokenIntelligence,
} from './types';

export default function App() {
  const [activeTab, setActiveTab] = useState<string>('dashboard');
  const [health, setHealth] = useState<SystemHealthStatus | null>(null);
  const [overview, setOverview] = useState<any>(null);
  const [tokens, setTokens] = useState<TokenIntelligence[]>([]);
  const [portfolioData, setPortfolioData] = useState<any>(null);
  const [alerts, setAlerts] = useState<AlertNotification[]>([]);
  const [strategies, setStrategies] = useState<StrategyConfig[]>([]);
  const [backtests, setBacktests] = useState<BacktestResult[]>([]);
  const [selectedToken, setSelectedToken] = useState<TokenIntelligence | null>(null);
  const [isDossierOpen, setIsDossierOpen] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [initialLoading, setInitialLoading] = useState(true);

  const [settings, setSettings] = useState<SentinelSettings>({
    language: 'ar',
    timezone: 'UTC',
    operationalMode: 'LIVE',
    solPriceUsd: 185.5,
    pollIntervalSeconds: 15,
    riskThresholdBlocked: 60,
    minLiquidityFilter: 5000,
    minVolumeFilter: 2000,
    autoPaperTradingEnabled: false,
  });

  const isAr = settings.language === 'ar';

  // Synchronize document direction with language
  useEffect(() => {
    document.documentElement.dir = isAr ? 'rtl' : 'ltr';
    document.documentElement.lang = isAr ? 'ar' : 'en';
  }, [isAr]);

  const loadAllData = useCallback(async () => {
    try {
      const [h, ov, t, p, al, st, bk, sett] = await Promise.allSettled([
        api.getHealth(),
        api.getMarketOverview(),
        api.getTokens(),
        api.getPortfolio(),
        api.getAlerts(),
        api.getStrategies(),
        api.getBacktests(),
        api.getSettings(),
      ]);

      if (h.status === 'fulfilled') setHealth(h.value);
      if (ov.status === 'fulfilled') setOverview(ov.value);
      if (t.status === 'fulfilled') setTokens(t.value.tokens);
      if (p.status === 'fulfilled') setPortfolioData(p.value);
      if (al.status === 'fulfilled') setAlerts(al.value);
      if (st.status === 'fulfilled') setStrategies(st.value);
      if (bk.status === 'fulfilled') setBacktests(bk.value);
      if (sett.status === 'fulfilled') setSettings(sett.value);
    } catch (err) {
      console.error('Failed to load data:', err);
    } finally {
      setInitialLoading(false);
    }
  }, []);

  // Initial mount
  useEffect(() => {
    loadAllData();
  }, [loadAllData]);

  // Periodic polling for live feeds
  useEffect(() => {
    const timer = setInterval(() => {
      loadAllData();
    }, 15000);
    return () => clearInterval(timer);
  }, [loadAllData]);

  const handleManualSync = async () => {
    setIsSyncing(true);
    try {
      await api.triggerSync();
      await loadAllData();
    } finally {
      setIsSyncing(false);
    }
  };

  const handleLanguageToggle = async () => {
    const newLang = isAr ? 'en' : 'ar';
    const updated = await api.updateSettings({ language: newLang });
    setSettings(updated);
  };

  const handleToggleWatchlist = async (address: string) => {
    await api.toggleWatchlist(address);
    setTokens((prev) =>
      prev.map((t) => (t.address === address ? { ...t, isWatchlist: !t.isWatchlist } : t))
    );
  };

  const handleOpenToken = (token: TokenIntelligence) => {
    setSelectedToken(token);
    setIsDossierOpen(true);
  };

  const handleCloseTokenDossier = () => {
    setIsDossierOpen(false);
  };

  const handleExecutePaperOrder = async (order: any) => {
    await api.executePaperOrder(order);
    const p = await api.getPortfolio();
    setPortfolioData(p);
    const ov = await api.getMarketOverview();
    setOverview(ov);
    const al = await api.getAlerts();
    setAlerts(al);
  };

  const handleClosePosition = async (address: string) => {
    await api.closePosition(address);
    const p = await api.getPortfolio();
    setPortfolioData(p);
    const ov = await api.getMarketOverview();
    setOverview(ov);
  };

  const handleResetPortfolio = async () => {
    await api.resetPortfolio();
    const p = await api.getPortfolio();
    setPortfolioData(p);
    const ov = await api.getMarketOverview();
    setOverview(ov);
  };

  const handleRunBacktest = async (strategyId: string, initialCap: number) => {
    const res = await api.runBacktest(strategyId, initialCap);
    const runs = await api.getBacktests();
    setBacktests(runs);
    return res;
  };

  const handleUpdateSettings = async (newSettings: Partial<SentinelSettings>) => {
    const updated = await api.updateSettings(newSettings);
    setSettings(updated);
  };

  const handleClearAlerts = async () => {
    await api.clearAlerts();
    setAlerts([]);
  };

  const handleMarkAlertRead = async (id: string) => {
    await api.markAlertAsRead(id);
    setAlerts((prev) => prev.map((a) => (a.id === id ? { ...a, isRead: true } : a)));
  };

  const unreadAlertsCount = alerts.filter((a) => !a.isRead).length;

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans">
      <Navbar
        health={health}
        settings={settings}
        unreadAlertsCount={unreadAlertsCount}
        isSyncing={isSyncing}
        activeTab={activeTab}
        onTabChange={setActiveTab}
        onLanguageToggle={handleLanguageToggle}
        onManualSync={handleManualSync}
        onOpenAlerts={() => setActiveTab('system-health')}
      />

      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {initialLoading ? (
          <div className="flex items-center justify-center min-h-[60vh]">
            <div className="text-center space-y-3">
              <div className="w-10 h-10 border-3 border-indigo-500 border-t-transparent rounded-full animate-spin mx-auto" />
              <div className="font-bold text-white text-base">SOLANA SENTINEL</div>
              <div className="text-xs text-slate-400">
                {isAr ? 'جاري تهيئة محركات الأمان وقاعدة البيانات ومسح الأسواق...' : 'Bootstrapping security engines & SQLite state...'}
              </div>
            </div>
          </div>
        ) : (
          <>
            {activeTab === 'dashboard' && (
              <DashboardTab
                overview={overview}
                isAr={isAr}
                onSelectToken={handleOpenToken}
                onNavigateTab={setActiveTab}
              />
            )}

            {activeTab === 'scanner' && (
              <ScannerTab
                tokens={tokens}
                isAr={isAr}
                onSelectToken={handleOpenToken}
                onToggleWatchlist={handleToggleWatchlist}
                onQuickPaperBuy={(t) => {
                  setSelectedToken(t);
                  setIsDossierOpen(true);
                }}
              />
            )}

            {activeTab === 'paper-trading' && (
              <PaperTradingTab
                portfolioData={portfolioData}
                tokens={tokens}
                isAr={isAr}
                onClosePosition={handleClosePosition}
                onResetPortfolio={handleResetPortfolio}
                onExecutePaperOrder={handleExecutePaperOrder}
              />
            )}

            {activeTab === 'risk-engine' && (
              <RiskRadarTab
                tokens={tokens}
                isAr={isAr}
                onSelectToken={handleOpenToken}
              />
            )}

            {activeTab === 'opportunity-lab' && (
              <OpportunityLabTab
                tokens={tokens}
                isAr={isAr}
                onSelectToken={handleOpenToken}
              />
            )}

            {activeTab === 'strategy-lab' && (
              <StrategyLabTab
                strategies={strategies}
                backtests={backtests}
                isAr={isAr}
                onRunBacktest={handleRunBacktest}
              />
            )}

            {activeTab === 'wallet-intel' && (
              <WalletIntelTab isAr={isAr} />
            )}

            {activeTab === 'system-health' && (
              <SystemHealthTab
                health={health}
                settings={settings}
                alerts={alerts}
                isAr={isAr}
                onUpdateSettings={handleUpdateSettings}
                onClearAlerts={handleClearAlerts}
                onMarkAlertRead={handleMarkAlertRead}
              />
            )}
          </>
        )}
      </main>

      {/* Token Dossier Modal */}
      <TokenDossierModal
        token={selectedToken}
        isOpen={isDossierOpen}
        isAr={isAr}
        onClose={handleCloseTokenDossier}
        onExecutePaperOrder={handleExecutePaperOrder}
      />

      {/* Footer */}
      <footer className="border-t border-slate-900 bg-slate-950 py-4 text-center text-xs text-slate-500">
        <div className="max-w-7xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-2">
          <span>SOLANA SENTINEL v2.5 — Autonomous Market Intelligence & Paper Simulation Engine</span>
          <span className="font-mono text-[11px] text-slate-400">
            {isAr ? 'محاكاة افتراضية خالية من المخاطر المالية' : 'Risk-Free Virtual Paper Trading Only'}
          </span>
        </div>
      </footer>
    </div>
  );
}
