import React, { useState } from 'react';
import {
  Coins,
  ArrowUpRight,
  ArrowDownRight,
  RotateCcw,
  CheckCircle,
  AlertCircle,
  TrendingUp,
  XCircle,
  ShieldCheck,
} from 'lucide-react';
import { PaperPosition, PaperTrade, TokenIntelligence } from '../types';

interface PaperTradingTabProps {
  portfolioData: any;
  tokens: TokenIntelligence[];
  isAr: boolean;
  onClosePosition: (address: string) => Promise<void>;
  onResetPortfolio: () => Promise<void>;
  onExecutePaperOrder: (order: any) => Promise<void>;
}

export const PaperTradingTab: React.FC<PaperTradingTabProps> = ({
  portfolioData,
  tokens,
  isAr,
  onClosePosition,
  onResetPortfolio,
  onExecutePaperOrder,
}) => {
  const [closingAddress, setClosingAddress] = useState<string | null>(null);
  const [showResetConfirm, setShowResetConfirm] = useState(false);
  const [isResetting, setIsResetting] = useState(false);

  // Quick buy state
  const [selectedTokenAddr, setSelectedTokenAddr] = useState<string>(tokens[0]?.address || '');
  const [spendAmount, setSpendAmount] = useState('250');
  const [spendAsset, setSpendAsset] = useState<'USDC' | 'SOL'>('USDC');
  const [tradeLoading, setTradeLoading] = useState(false);
  const [tradeFeedback, setTradeFeedback] = useState<string | null>(null);

  const portfolio = portfolioData?.portfolio;
  const positions: PaperPosition[] = portfolioData?.positions || [];
  const trades: PaperTrade[] = portfolioData?.trades || [];
  const summary = portfolioData?.summary || {};

  const handleClose = async (addr: string) => {
    setClosingAddress(addr);
    try {
      await onClosePosition(addr);
    } finally {
      setClosingAddress(null);
    }
  };

  const handleReset = async () => {
    setIsResetting(true);
    try {
      await onResetPortfolio();
      setShowResetConfirm(false);
    } finally {
      setIsResetting(false);
    }
  };

  const handleQuickTrade = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedTokenAddr) return;
    const targetToken = tokens.find(t => t.address === selectedTokenAddr);
    if (!targetToken) return;

    setTradeLoading(true);
    setTradeFeedback(null);
    try {
      await onExecutePaperOrder({
        tokenAddress: targetToken.address,
        tokenSymbol: targetToken.symbol,
        tokenName: targetToken.name,
        orderType: 'BUY',
        assetUsed: spendAsset,
        amountIn: Number(spendAmount),
        marketPriceUsd: targetToken.baseTokenPriceUsd,
        liquidityUsd: targetToken.liquidityUsd,
        idempotencyKey: `tab-order-${Date.now()}`,
      });
      setTradeFeedback(isAr ? 'تم تنفيذ الشراء الافتراضي بنجاح!' : 'Paper purchase filled successfully!');
    } catch (err: any) {
      setTradeFeedback(err.message || 'Error executing order');
    } finally {
      setTradeLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Disclaimer Banner */}
      <div className="rounded-2xl border border-indigo-500/20 bg-indigo-950/20 p-4 flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-indigo-500/10 text-indigo-400 flex items-center justify-center shrink-0">
            <Coins className="w-5 h-5" />
          </div>
          <div>
            <div className="text-sm font-semibold text-white">
              {isAr ? 'بيئة التداول الافتراضي الآمنة (Paper Trading Simulator)' : 'Simulated Paper Trading Sandbox'}
            </div>
            <div className="text-xs text-slate-400 mt-0.5">
              {isAr
                ? 'رصيد افتراضي ابتدائي 50 SOL و 5000 USDC محفوظ في SQLite ولا يُمسح عند إعادة تشغيل الخادم.'
                : 'Default balance 50 SOL & 5000 USDC persisted in SQLite and retained across restarts.'}
            </div>
          </div>
        </div>

        <button
          onClick={() => setShowResetConfirm(true)}
          className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white text-xs font-semibold border border-slate-700 transition flex items-center gap-1.5 shrink-0"
        >
          <RotateCcw className="w-3.5 h-3.5" />
          <span>{isAr ? 'إعادة ضبط المحفظة' : 'Reset Balance'}</span>
        </button>
      </div>

      {/* Portfolio Stats Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="p-4 rounded-2xl bg-slate-900/60 border border-slate-800">
          <div className="text-xs text-slate-400 font-medium">{isAr ? 'القيمة الإجمالية للمحفظة' : 'Total Portfolio Value'}</div>
          <div className="text-2xl font-bold font-mono text-white mt-1">
            ${(summary.totalPortfolioValueUsd || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </div>
          <div className="text-xs font-mono text-slate-500 mt-2">
            {isAr ? 'الرصيد الابتدائي: $14,275 (تقريبي)' : 'Initial: ~$14,275'}
          </div>
        </div>

        <div className="p-4 rounded-2xl bg-slate-900/60 border border-slate-800">
          <div className="text-xs text-slate-400 font-medium">{isAr ? 'السيولة النقدية المتاحة' : 'Available Cash'}</div>
          <div className="text-lg font-bold font-mono text-cyan-400 mt-1">
            {(portfolio?.solBalance || 0).toFixed(2)} SOL
          </div>
          <div className="text-xs font-mono text-slate-300 mt-1">
            ${(portfolio?.usdcBalance || 0).toFixed(2)} USDC
          </div>
        </div>

        <div className="p-4 rounded-2xl bg-slate-900/60 border border-slate-800">
          <div className="text-xs text-slate-400 font-medium">{isAr ? 'الأرباح غير المحققة (المراكز المفتوحة)' : 'Unrealized PnL'}</div>
          <div className={`text-2xl font-bold font-mono mt-1 flex items-center gap-1 ${
            (summary.totalUnrealizedPnlUsd || 0) >= 0 ? 'text-emerald-400' : 'text-rose-400'
          }`}>
            {(summary.totalUnrealizedPnlUsd || 0) >= 0 ? '+' : ''}${(summary.totalUnrealizedPnlUsd || 0).toFixed(2)}
          </div>
          <div className="text-xs text-slate-500 mt-2">
            {positions.length} {isAr ? 'مراكز نشطة' : 'open positions'}
          </div>
        </div>

        <div className="p-4 rounded-2xl bg-slate-900/60 border border-slate-800">
          <div className="text-xs text-slate-400 font-medium">{isAr ? 'الأرباح المحققة التراكمية' : 'Realized PnL'}</div>
          <div className={`text-2xl font-bold font-mono mt-1 ${
            (portfolio?.totalRealizedPnlUsd || 0) >= 0 ? 'text-emerald-400' : 'text-rose-400'
          }`}>
            {(portfolio?.totalRealizedPnlUsd || 0) >= 0 ? '+' : ''}${(portfolio?.totalRealizedPnlUsd || 0).toFixed(2)}
          </div>
          <div className="text-xs text-slate-500 mt-2">
            {isAr ? 'صافي العائد بعد خصم رسوم التداول والانزلاق' : 'Net of DEX fees & slippage'}
          </div>
        </div>
      </div>

      {/* Main Split: Open Positions & Quick Order Entry */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Open Positions Table (2 cols) */}
        <div className="lg:col-span-2 rounded-2xl border border-slate-800 bg-slate-900/60 p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-bold text-white uppercase tracking-wider">
              {isAr ? 'المراكز الاستثمارية المفتوحة' : 'Open Positions'} ({positions.length})
            </h3>
          </div>

          {positions.length === 0 ? (
            <div className="text-center py-12 text-slate-500 text-xs">
              {isAr ? 'لا توجد مراكز مفتوحة حالياً. يمكنك فتح مركز جديد عبر نافذة الشراء.' : 'No open positions. Use the order form to enter a paper position.'}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-right text-xs">
                <thead className="text-slate-400 border-b border-slate-800 pb-2 font-medium">
                  <tr>
                    <th className="py-2.5 px-3">{isAr ? 'التوكن' : 'Token'}</th>
                    <th className="py-2.5 px-3">{isAr ? 'سعر الدخول' : 'Entry'}</th>
                    <th className="py-2.5 px-3">{isAr ? 'السعر الحالي' : 'Current'}</th>
                    <th className="py-2.5 px-3">{isAr ? 'القيمة' : 'Value'}</th>
                    <th className="py-2.5 px-3">{isAr ? 'الربح/الخسارة' : 'PnL'}</th>
                    <th className="py-2.5 px-3 text-center">{isAr ? 'إغلاق' : 'Close'}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60 font-mono">
                  {positions.map((pos) => {
                    const isProfit = pos.unrealizedPnlUsd >= 0;
                    return (
                      <tr key={pos.id} className="hover:bg-slate-800/30 transition">
                        <td className="py-3 px-3">
                          <div className="font-semibold text-white font-sans">{pos.tokenName}</div>
                          <div className="text-[11px] text-slate-400 uppercase">{pos.tokenSymbol} ({pos.amount.toFixed(2)})</div>
                        </td>
                        <td className="py-3 px-3 text-slate-300">
                          ${pos.entryPriceUsd < 0.01 ? pos.entryPriceUsd.toFixed(6) : pos.entryPriceUsd.toFixed(4)}
                        </td>
                        <td className="py-3 px-3 text-slate-200">
                          ${pos.currentPriceUsd < 0.01 ? pos.currentPriceUsd.toFixed(6) : pos.currentPriceUsd.toFixed(4)}
                        </td>
                        <td className="py-3 px-3 text-white font-bold">
                          ${pos.currentValueUsd.toFixed(2)}
                        </td>
                        <td className={`py-3 px-3 font-bold ${isProfit ? 'text-emerald-400' : 'text-rose-400'}`}>
                          {isProfit ? '+' : ''}${pos.unrealizedPnlUsd.toFixed(2)}
                          <span className="text-[10px] block">
                            ({isProfit ? '+' : ''}{pos.unrealizedPnlPercent.toFixed(1)}%)
                          </span>
                        </td>
                        <td className="py-3 px-3 text-center">
                          <button
                            onClick={() => handleClose(pos.tokenAddress)}
                            disabled={closingAddress === pos.tokenAddress}
                            className="px-2.5 py-1 rounded-lg bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/20 transition disabled:opacity-50 text-[11px] font-sans font-medium"
                          >
                            {closingAddress === pos.tokenAddress ? (isAr ? 'جاري الإغلاق...' : 'Closing...') : (isAr ? 'إغلاق المركز' : 'Close')}
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Quick Order Executor Card (1 col) */}
        <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-5">
          <h3 className="text-sm font-bold text-white uppercase tracking-wider mb-4">
            {isAr ? 'تنفيذ أمر شراء افتراضي' : 'Quick Paper Buy'}
          </h3>

          <form onSubmit={handleQuickTrade} className="space-y-4">
            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1">
                {isAr ? 'اختر التوكن المرصود' : 'Select Token'}
              </label>
              <select
                value={selectedTokenAddr}
                onChange={(e) => setSelectedTokenAddr(e.target.value)}
                className="w-full px-3 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-xs text-white focus:outline-none focus:border-indigo-500"
              >
                {tokens.map((t) => (
                  <option key={t.address} value={t.address}>
                    {t.name} ({t.symbol}) - ${t.baseTokenPriceUsd < 0.01 ? t.baseTokenPriceUsd.toFixed(6) : t.baseTokenPriceUsd.toFixed(4)}
                  </option>
                ))}
              </select>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setSpendAsset('USDC')}
                className={`py-2 rounded-xl text-xs font-bold transition border ${
                  spendAsset === 'USDC'
                    ? 'bg-indigo-600 border-indigo-500 text-white'
                    : 'bg-slate-950 border-slate-800 text-slate-400'
                }`}
              >
                USDC
              </button>
              <button
                type="button"
                onClick={() => setSpendAsset('SOL')}
                className={`py-2 rounded-xl text-xs font-bold transition border ${
                  spendAsset === 'SOL'
                    ? 'bg-indigo-600 border-indigo-500 text-white'
                    : 'bg-slate-950 border-slate-800 text-slate-400'
                }`}
              >
                SOL
              </button>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1">
                {isAr ? `المبلغ المراد استثماره (${spendAsset})` : `Amount to Invest (${spendAsset})`}
              </label>
              <input
                type="number"
                step="any"
                value={spendAmount}
                onChange={(e) => setSpendAmount(e.target.value)}
                required
                className="w-full px-3 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-sm font-mono text-white focus:outline-none focus:border-indigo-500"
              />
            </div>

            {tradeFeedback && (
              <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 text-xs text-slate-300">
                {tradeFeedback}
              </div>
            )}

            <button
              type="submit"
              disabled={tradeLoading || !selectedTokenAddr}
              className="w-full py-3 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold transition disabled:opacity-40"
            >
              {tradeLoading ? (isAr ? 'جاري التنفيذ...' : 'Executing...') : (isAr ? 'شراء افتراضي الآن' : 'Submit Paper Order')}
            </button>
          </form>
        </div>
      </div>

      {/* Trade History Log */}
      <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-5">
        <h3 className="text-sm font-bold text-white uppercase tracking-wider mb-4">
          {isAr ? 'سجل العمليات والصفقات المنفذة (Audit Log)' : 'Executed Trades & Audit Log'}
        </h3>

        {trades.length === 0 ? (
          <div className="text-center py-6 text-slate-500 text-xs">
            {isAr ? 'لا توجد صفقات منفذة بعد' : 'No executed trades logged'}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-right text-xs">
              <thead className="text-slate-400 border-b border-slate-800 pb-2 font-medium">
                <tr>
                  <th className="py-2.5 px-3">{isAr ? 'الوقت' : 'Time'}</th>
                  <th className="py-2.5 px-3">{isAr ? 'النوع' : 'Side'}</th>
                  <th className="py-2.5 px-3">{isAr ? 'التوكن' : 'Token'}</th>
                  <th className="py-2.5 px-3">{isAr ? 'الكمية' : 'Amount'}</th>
                  <th className="py-2.5 px-3">{isAr ? 'السعر' : 'Price'}</th>
                  <th className="py-2.5 px-3">{isAr ? 'الإجمالي' : 'Total'}</th>
                  <th className="py-2.5 px-3">{isAr ? 'الرسوم' : 'Fee'}</th>
                  <th className="py-2.5 px-3">{isAr ? 'الربح المحقق' : 'Realized PnL'}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60 font-mono">
                {trades.map((t) => (
                  <tr key={t.id} className="hover:bg-slate-800/20 transition">
                    <td className="py-2.5 px-3 text-slate-400">
                      {new Date(t.timestamp).toLocaleTimeString()}
                    </td>
                    <td className="py-2.5 px-3">
                      <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                        t.side === 'BUY'
                          ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                          : 'bg-rose-500/10 text-rose-400 border border-rose-500/20'
                      }`}>
                        {t.side}
                      </span>
                    </td>
                    <td className="py-2.5 px-3 text-white font-sans font-semibold">
                      {t.tokenSymbol}
                    </td>
                    <td className="py-2.5 px-3 text-slate-300">
                      {t.amount.toFixed(2)}
                    </td>
                    <td className="py-2.5 px-3 text-slate-300">
                      ${t.priceUsd < 0.01 ? t.priceUsd.toFixed(6) : t.priceUsd.toFixed(4)}
                    </td>
                    <td className="py-2.5 px-3 text-white font-bold">
                      ${t.totalUsd.toFixed(2)}
                    </td>
                    <td className="py-2.5 px-3 text-slate-500">
                      ${t.feeUsd.toFixed(4)}
                    </td>
                    <td className={`py-2.5 px-3 ${
                      t.realizedPnlUsd !== undefined
                        ? t.realizedPnlUsd >= 0 ? 'text-emerald-400 font-bold' : 'text-rose-400 font-bold'
                        : 'text-slate-500'
                    }`}>
                      {t.realizedPnlUsd !== undefined
                        ? `${t.realizedPnlUsd >= 0 ? '+' : ''}$${t.realizedPnlUsd.toFixed(2)}`
                        : '-'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Reset Confirmation Modal */}
      {showResetConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <div className="w-full max-w-md p-6 rounded-2xl bg-slate-900 border border-slate-800 text-center space-y-4">
            <div className="w-12 h-12 rounded-xl bg-rose-500/10 text-rose-400 border border-rose-500/20 flex items-center justify-center mx-auto">
              <RotateCcw className="w-6 h-6" />
            </div>
            <h4 className="text-base font-bold text-white">
              {isAr ? 'تأكيد إعادة تعيين المحفظة الافتراضية' : 'Reset Virtual Portfolio?'}
            </h4>
            <p className="text-xs text-slate-300 leading-relaxed">
              {isAr
                ? 'سيتم استعادة الرصيد الابتدائي (50 SOL و 5000 USDC) ومسح كافة المراكز وسجل الصفقات الافتراضية.'
                : 'This will reset your demo balances back to 50 SOL & 5000 USDC and clear all open positions.'}
            </p>
            <div className="flex items-center gap-3 pt-2">
              <button
                onClick={() => setShowResetConfirm(false)}
                className="flex-1 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold"
              >
                {isAr ? 'إلغاء' : 'Cancel'}
              </button>
              <button
                onClick={handleReset}
                disabled={isResetting}
                className="flex-1 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold"
              >
                {isResetting ? (isAr ? 'جاري الإعادة...' : 'Resetting...') : (isAr ? 'تأكيد الإعادة' : 'Confirm Reset')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
