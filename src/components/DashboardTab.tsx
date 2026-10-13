import React from 'react';
import {
  TrendingUp,
  ShieldCheck,
  ShieldAlert,
  Coins,
  ArrowUpRight,
  ArrowDownRight,
  Sparkles,
  Dna,
  Clock,
  ChevronRight,
  Eye,
  ShoppingCart,
} from 'lucide-react';
import { TokenIntelligence, AlertNotification } from '../types';

interface DashboardTabProps {
  overview: any;
  isAr: boolean;
  onSelectToken: (token: TokenIntelligence) => void;
  onNavigateTab: (tab: string) => void;
}

export const DashboardTab: React.FC<DashboardTabProps> = ({
  overview,
  isAr,
  onSelectToken,
  onNavigateTab,
}) => {
  if (!overview) {
    return (
      <div className="flex items-center justify-center p-16 text-slate-400">
        <div className="text-center">
          <div className="w-8 h-8 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
          <p>{isAr ? 'جاري تحميل مؤشرات لوحة القيادة...' : 'Loading dashboard metrics...'}</p>
        </div>
      </div>
    );
  }

  const {
    totalTokens = 0,
    watchlistCount = 0,
    riskDistribution = { PASS: 0, REVIEW: 0, BLOCKED: 0, UNKNOWN: 0, ERROR: 0 },
    topOpportunities = [] as TokenIntelligence[],
    desciTokens = [] as TokenIntelligence[],
    portfolio,
    recentAlerts = [] as AlertNotification[],
  } = overview;

  const solBalance = portfolio?.solBalance || 0;
  const usdcBalance = portfolio?.usdcBalance || 0;
  const totalValueUsd = portfolio?.totalPortfolioValueUsd || 0;
  const unrealizedPnlUsd = portfolio?.totalUnrealizedPnlUsd || 0;
  const realizedPnlUsd = portfolio?.totalRealizedPnlUsd || 0;

  return (
    <div className="space-y-6">
      {/* Top Banner Notice */}
      <div className="rounded-2xl border border-indigo-500/20 bg-gradient-to-r from-indigo-950/40 via-slate-900 to-cyan-950/30 p-4 sm:p-5 flex flex-col md:flex-row items-start md:items-center justify-between gap-4 shadow-sm">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-cyan-400 shrink-0">
            <Sparkles className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-sm sm:text-base font-semibold text-white">
              {isAr ? 'منصة استخبارات Solana والمحاكاة الافتراضية' : 'Solana Intelligence & Virtual Simulation'}
            </h2>
            <p className="text-xs text-slate-300 mt-0.5">
              {isAr
                ? 'بيانات السوق حية (DEX Screener + Solana RPC). التداول حصراً افتراضي ومحمي (Paper Trading). لا توجد مفاتيح خاصة مطلوبة.'
                : 'Market feeds are LIVE. Trading is strictly simulated (Paper Trading). No private keys required or accessed.'}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 self-stretch md:self-auto">
          <button
            onClick={() => onNavigateTab('scanner')}
            className="flex-1 md:flex-none px-3.5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold transition flex items-center justify-center gap-1.5 shadow-sm shadow-indigo-600/30"
          >
            <span>{isAr ? 'بدء مسح العملات' : 'Open Scanner'}</span>
            <ChevronRight className={`w-3.5 h-3.5 ${isAr ? 'rotate-180' : ''}`} />
          </button>
          <button
            onClick={() => onNavigateTab('paper-trading')}
            className="flex-1 md:flex-none px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold border border-slate-700 transition flex items-center justify-center gap-1.5"
          >
            <span>{isAr ? 'المحفظة الافتراضية' : 'Portfolio'}</span>
          </button>
        </div>
      </div>

      {/* KPI Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Card 1: Virtual Portfolio Value */}
        <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-5 shadow-sm hover:border-slate-700 transition">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-400">
              {isAr ? 'قيمة المحفظة الافتراضية' : 'Paper Portfolio Value'}
            </span>
            <div className="w-8 h-8 rounded-lg bg-indigo-500/10 text-indigo-400 flex items-center justify-center">
              <Coins className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-2xl font-bold font-mono text-white">
              ${totalValueUsd.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </div>
            <div className="mt-2 flex items-center gap-3 text-xs font-mono text-slate-400">
              <span>{solBalance.toFixed(2)} SOL</span>
              <span>•</span>
              <span>${usdcBalance.toFixed(2)} USDC</span>
            </div>
          </div>
        </div>

        {/* Card 2: Unrealized & Realized PnL */}
        <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-5 shadow-sm hover:border-slate-700 transition">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-400">
              {isAr ? 'الأرباح والخسائر التراكمية' : 'Cumulative PnL'}
            </span>
            <div className="w-8 h-8 rounded-lg bg-emerald-500/10 text-emerald-400 flex items-center justify-center">
              <TrendingUp className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3">
            <div className={`text-2xl font-bold font-mono flex items-center gap-1 ${
              unrealizedPnlUsd >= 0 ? 'text-emerald-400' : 'text-rose-400'
            }`}>
              {unrealizedPnlUsd >= 0 ? <ArrowUpRight className="w-5 h-5" /> : <ArrowDownRight className="w-5 h-5" />}
              <span>{unrealizedPnlUsd >= 0 ? '+' : ''}${unrealizedPnlUsd.toFixed(2)}</span>
            </div>
            <div className="mt-2 text-xs font-mono text-slate-400">
              {isAr ? 'المحققة:' : 'Realized:'}{' '}
              <span className={realizedPnlUsd >= 0 ? 'text-emerald-400' : 'text-rose-400'}>
                {realizedPnlUsd >= 0 ? '+' : ''}${realizedPnlUsd.toFixed(2)}
              </span>
            </div>
          </div>
        </div>

        {/* Card 3: Discovered Tokens & Watchlist */}
        <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-5 shadow-sm hover:border-slate-700 transition">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-400">
              {isAr ? 'التوكنات المرصودة' : 'Tracked Tokens'}
            </span>
            <div className="w-8 h-8 rounded-lg bg-cyan-500/10 text-cyan-400 flex items-center justify-center">
              <Eye className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-2xl font-bold font-mono text-white">
              {totalTokens.toLocaleString()}
            </div>
            <div className="mt-2 text-xs text-slate-400 flex items-center gap-1">
              <span>{isAr ? 'قائمة المراقبة:' : 'Watchlist:'}</span>
              <span className="font-mono text-cyan-300 font-semibold">{watchlistCount}</span>
            </div>
          </div>
        </div>

        {/* Card 4: Risk Distribution (PASS vs BLOCKED) */}
        <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-5 shadow-sm hover:border-slate-700 transition">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-400">
              {isAr ? 'توزيع الأمان والمخاطر' : 'Risk Distribution'}
            </span>
            <div className="w-8 h-8 rounded-lg bg-amber-500/10 text-amber-400 flex items-center justify-center">
              <ShieldCheck className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3">
            <div className="flex items-center gap-2 text-xs font-mono">
              <span className="px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 font-bold">
                PASS: {riskDistribution.PASS}
              </span>
              <span className="px-2 py-0.5 rounded bg-amber-500/10 text-amber-400 border border-amber-500/20 font-bold">
                REV: {riskDistribution.REVIEW}
              </span>
              <span className="px-2 py-0.5 rounded bg-rose-500/10 text-rose-400 border border-rose-500/20 font-bold">
                BLK: {riskDistribution.BLOCKED}
              </span>
            </div>
            <div className="mt-2 text-xs text-slate-400">
              {isAr ? 'حماية ضد الاحتيال ومصيدة التجميد' : 'Anti-Honeypot & Freeze revoked'}
            </div>
          </div>
        </div>
      </div>

      {/* Main Split: Top Qualified Opportunities & DeSci Bio Hub */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left 2 Cols: Top Qualified Opportunities */}
        <div className="lg:col-span-2 rounded-2xl border border-slate-800 bg-slate-900/60 p-5">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-cyan-400" />
              <h3 className="text-sm font-bold text-white uppercase tracking-wider">
                {isAr ? 'أفضل الفرص المؤهلة أمنياً' : 'Top Qualified Opportunities'}
              </h3>
            </div>
            <button
              onClick={() => onNavigateTab('scanner')}
              className="text-xs text-indigo-400 hover:text-indigo-300 transition flex items-center gap-1 font-medium"
            >
              <span>{isAr ? 'عرض كل الأزواج' : 'View all'}</span>
              <ChevronRight className={`w-3.5 h-3.5 ${isAr ? 'rotate-180' : ''}`} />
            </button>
          </div>

          {topOpportunities.length === 0 ? (
            <div className="text-center py-12 text-slate-400 text-xs">
              {isAr ? 'جاري استقبال وتأهيل الأزواج...' : 'Awaiting qualifying pairs...'}
            </div>
          ) : (
            <div className="divide-y divide-slate-800">
              {topOpportunities.map((token: TokenIntelligence) => {
                const isPass = token.risk.status === 'PASS';
                const oppScore = token.opportunity.overallScore;

                return (
                  <div
                    key={token.address}
                    className="py-3 flex items-center justify-between gap-3 hover:bg-slate-800/30 px-2 rounded-xl transition"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-9 h-9 rounded-xl bg-slate-800 border border-slate-700 flex items-center justify-center font-bold text-xs text-indigo-300 shrink-0 font-mono">
                        {token.symbol.slice(0, 3)}
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="font-semibold text-white text-sm truncate">{token.name}</span>
                          <span className="text-xs text-slate-400 font-mono uppercase">{token.symbol}</span>
                          {token.scienceData?.isDeSci && (
                            <span className="px-1.5 py-0.2 rounded text-[10px] bg-teal-500/10 text-teal-300 border border-teal-500/20 font-mono">
                              DeSci
                            </span>
                          )}
                        </div>
                        <div className="text-xs font-mono text-slate-400 flex items-center gap-2 mt-0.5">
                          <span>${token.baseTokenPriceUsd < 0.01 ? token.baseTokenPriceUsd.toFixed(6) : token.baseTokenPriceUsd.toFixed(4)}</span>
                          <span>•</span>
                          <span>{isAr ? 'السيولة:' : 'Liq:'} ${token.liquidityUsd.toLocaleString()}</span>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-3 shrink-0">
                      {/* Opportunity Score Pill */}
                      <div className="text-right">
                        <div className="text-sm font-bold font-mono text-cyan-400">
                          {oppScore}/100
                        </div>
                        <div className="text-[10px] text-slate-400">
                          {isAr ? 'مؤشر الفرصة' : 'Score'}
                        </div>
                      </div>

                      {/* Risk Badge */}
                      <span className={`px-2 py-0.5 rounded text-[11px] font-bold font-mono ${
                        isPass
                          ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                          : 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                      }`}>
                        {token.risk.status}
                      </span>

                      {/* Inspect Button */}
                      <button
                        onClick={() => onSelectToken(token)}
                        className="p-1.5 rounded-lg bg-slate-800 hover:bg-indigo-600 text-slate-300 hover:text-white transition"
                        title={isAr ? 'فتح ملف التوكن' : 'Open dossier'}
                      >
                        <Eye className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Right Col: DeSci Bioscience Hub & Pump.science Radar */}
        <div className="rounded-2xl border border-teal-500/20 bg-gradient-to-b from-teal-950/20 to-slate-900/60 p-5">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2 text-teal-400">
              <Dna className="w-4 h-4" />
              <h3 className="text-sm font-bold text-white uppercase tracking-wider">
                {isAr ? 'رادار العلوم اللامركزية (DeSci)' : 'DeSci Bioscience Radar'}
              </h3>
            </div>
            <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-teal-500/10 text-teal-300 border border-teal-500/20">
              Pump.science
            </span>
          </div>

          <p className="text-xs text-slate-300 leading-relaxed mb-4">
            {isAr
              ? 'تتبع توكنات الأبحاث الطبية وإطالة العمر على Solana. فحص كيميائي عبر PubChem ومراجع أبحاث PubMed الحقيقية.'
              : 'Tracking Solana longevity & biomedical compound tokens. Backed by PubChem biochemical SMILES & PubMed trials.'}
          </p>

          <div className="space-y-3">
            {desciTokens.length === 0 ? (
              <div className="p-4 rounded-xl bg-slate-950/50 border border-slate-800 text-center text-xs text-slate-400">
                {isAr ? 'جاري فحص مركبات DeSci...' : 'Scanning for DeSci compounds...'}
              </div>
            ) : (
              desciTokens.slice(0, 3).map((token: TokenIntelligence) => (
                <div
                  key={token.address}
                  onClick={() => onSelectToken(token)}
                  className="p-3 rounded-xl bg-slate-950/60 border border-teal-500/20 hover:border-teal-500/40 cursor-pointer transition"
                >
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-white text-xs">{token.name} ({token.symbol})</span>
                    <span className="text-xs font-mono text-teal-400">${token.baseTokenPriceUsd.toFixed(4)}</span>
                  </div>
                  <div className="text-[11px] text-slate-400 mt-1 line-clamp-2">
                    {token.scienceData?.longevityTrial || 'دراسة سريرية حيوية لإطالة العمر'}
                  </div>
                  {token.scienceData?.pubchemCid && (
                    <div className="mt-2 text-[10px] font-mono text-teal-300">
                      PubChem CID: {token.scienceData.pubchemCid}
                    </div>
                  )}
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* Recent Alerts & System Events Feed */}
      <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-5">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Clock className="w-4 h-4 text-indigo-400" />
            <h3 className="text-sm font-bold text-white uppercase tracking-wider">
              {isAr ? 'آخر التنبيهات وأحداث النظام' : 'Recent Alerts & Events'}
            </h3>
          </div>
          <button
            onClick={() => onNavigateTab('system-health')}
            className="text-xs text-indigo-400 hover:text-indigo-300 font-medium"
          >
            {isAr ? 'إدارة التنبيهات' : 'Manage alerts'}
          </button>
        </div>

        {recentAlerts.length === 0 ? (
          <div className="text-center py-6 text-slate-500 text-xs">
            {isAr ? 'لا توجد تنبيهات جديدة في الوقت الحالي' : 'No recent alerts logged'}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {recentAlerts.slice(0, 4).map((alert: AlertNotification) => (
              <div
                key={alert.id}
                className="p-3 rounded-xl bg-slate-950/60 border border-slate-800/80 flex items-start gap-3"
              >
                <div className={`w-2 h-2 rounded-full mt-1.5 shrink-0 ${
                  alert.severity === 'CRITICAL' ? 'bg-rose-500' :
                  alert.severity === 'WARNING' ? 'bg-amber-500' :
                  alert.severity === 'SUCCESS' ? 'bg-emerald-500' : 'bg-cyan-500'
                }`} />
                <div className="min-w-0">
                  <div className="text-xs font-semibold text-slate-200 truncate">{alert.title}</div>
                  <div className="text-[11px] text-slate-400 mt-0.5 line-clamp-2 leading-relaxed">
                    {alert.message}
                  </div>
                  <div className="text-[10px] text-slate-500 font-mono mt-1">
                    {new Date(alert.createdAt).toLocaleTimeString()}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
