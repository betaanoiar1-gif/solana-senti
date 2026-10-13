import React, { useState } from 'react';
import {
  Cpu,
  Play,
  RotateCcw,
  CheckCircle,
  AlertCircle,
  TrendingUp,
  Percent,
  Activity,
  Calendar,
  ShieldCheck,
} from 'lucide-react';
import { BacktestResult, StrategyConfig } from '../types';

interface StrategyLabTabProps {
  strategies: StrategyConfig[];
  backtests: BacktestResult[];
  isAr: boolean;
  onRunBacktest: (strategyId: string, initialCapital: number) => Promise<BacktestResult>;
}

export const StrategyLabTab: React.FC<StrategyLabTabProps> = ({
  strategies,
  backtests,
  isAr,
  onRunBacktest,
}) => {
  const [selectedStrategyId, setSelectedStrategyId] = useState<string>(strategies[0]?.id || 'strat-conservative');
  const [initialCapital, setInitialCapital] = useState('10000');
  const [isRunning, setIsRunning] = useState(false);
  const [currentResult, setCurrentResult] = useState<BacktestResult | null>(backtests[0] || null);

  const selectedStrategy = strategies.find(s => s.id === selectedStrategyId) || strategies[0];

  const handleRun = async () => {
    if (!selectedStrategyId) return;
    setIsRunning(true);
    try {
      const res = await onRunBacktest(selectedStrategyId, Number(initialCapital));
      setCurrentResult(res);
    } finally {
      setIsRunning(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Intro Header */}
      <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-5">
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-xl bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 flex items-center justify-center shrink-0">
            <Cpu className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-sm font-bold text-white uppercase tracking-wider">
              {isAr ? 'مختبر الاستراتيجيات والاختبار التاريخي (Backtesting Lab)' : 'Strategy Lab & Chronological Backtesting'}
            </h2>
            <p className="text-xs text-slate-300 leading-relaxed mt-1">
              {isAr
                ? 'محاكاة زمنية نزيهة خالية تماماً من تسريب بيانات المستقبل (No Lookahead Bias). يعتمد الاختبار حصراً على اللقطات المسجلة فعلياً في SQLite.'
                : 'Zero-lookahead simulation strictly replaying recorded historical snapshots. Incomplete data returns INSUFFICIENT_DATA.'}
            </p>
          </div>
        </div>
      </div>

      {/* Strategy Selector & Controls */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left: Strategy Configuration */}
        <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-5 space-y-4">
          <h3 className="text-sm font-bold text-white uppercase tracking-wider">
            {isAr ? 'اختيار الاستراتيجية' : 'Strategy Selection'}
          </h3>

          <div className="space-y-2">
            {strategies.map((strat) => (
              <div
                key={strat.id}
                onClick={() => setSelectedStrategyId(strat.id)}
                className={`p-3 rounded-xl border cursor-pointer transition ${
                  selectedStrategyId === strat.id
                    ? 'bg-indigo-950/40 border-indigo-500/50 text-white'
                    : 'bg-slate-950/60 border-slate-800 text-slate-300 hover:border-slate-700'
                }`}
              >
                <div className="font-bold text-xs">{strat.name}</div>
                <div className="text-[11px] text-slate-400 mt-1 line-clamp-2 leading-relaxed">
                  {strat.description}
                </div>
              </div>
            ))}
          </div>

          {selectedStrategy && (
            <div className="p-3.5 rounded-xl bg-slate-950 border border-slate-800/80 space-y-2 text-xs">
              <div className="text-slate-400 font-semibold mb-1">{isAr ? 'شروط الدخول والخروج:' : 'Entry & Exit Rules:'}</div>
              <div className="flex justify-between text-slate-300">
                <span>{isAr ? 'الحد الأدنى للفرصة:' : 'Min Opp Score:'}</span>
                <span className="font-mono text-cyan-400 font-bold">{selectedStrategy.minOpportunityScore}</span>
              </div>
              <div className="flex justify-between text-slate-300">
                <span>{isAr ? 'أقصى درجة مخاطر مسموحة:' : 'Max Risk Score:'}</span>
                <span className="font-mono text-amber-400 font-bold">{selectedStrategy.maxRiskScore}</span>
              </div>
              <div className="flex justify-between text-slate-300">
                <span>{isAr ? 'وقف الخسارة:' : 'Stop Loss:'}</span>
                <span className="font-mono text-rose-400 font-bold">-{selectedStrategy.stopLossPercent}%</span>
              </div>
              <div className="flex justify-between text-slate-300">
                <span>{isAr ? 'جني الأرباح:' : 'Take Profit:'}</span>
                <span className="font-mono text-emerald-400 font-bold">+{selectedStrategy.takeProfitPercent}%</span>
              </div>
              <div className="flex justify-between text-slate-300">
                <span>{isAr ? 'نموذج الانزلاق والرسوم:' : 'Slippage & Fee Model:'}</span>
                <span className="font-mono text-slate-400">
                  {selectedStrategy.slippageModelPercent}% / {selectedStrategy.feeModelPercent}%
                </span>
              </div>
            </div>
          )}

          <div>
            <label className="block text-xs font-medium text-slate-400 mb-1">
              {isAr ? 'رأس المال الافتراضي الأولي ($)' : 'Initial Backtest Capital ($)'}
            </label>
            <input
              type="number"
              value={initialCapital}
              onChange={(e) => setInitialCapital(e.target.value)}
              className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-xs font-mono text-white focus:outline-none focus:border-indigo-500"
            />
          </div>

          <button
            onClick={handleRun}
            disabled={isRunning}
            className="w-full py-3 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs transition flex items-center justify-center gap-2 disabled:opacity-50"
          >
            <Play className={`w-3.5 h-3.5 ${isRunning ? 'animate-spin' : ''}`} />
            <span>{isRunning ? (isAr ? 'جاري إعادة التشغيل الزمني...' : 'Replaying chronologically...') : (isAr ? 'تشغيل الاختبار التاريخي' : 'Execute Backtest')}</span>
          </button>
        </div>

        {/* Right 2 cols: Backtest Results & Trades */}
        <div className="lg:col-span-2 rounded-2xl border border-slate-800 bg-slate-900/60 p-5 space-y-5">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-white uppercase tracking-wider">
              {isAr ? 'نتائج الاختبار والمؤشرات الإحصائية' : 'Backtest Performance Metrics'}
            </h3>
            {currentResult && (
              <span className={`px-2.5 py-0.5 rounded text-xs font-mono font-bold ${
                currentResult.status === 'SUCCESS'
                  ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                  : currentResult.status === 'INSUFFICIENT_DATA'
                  ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                  : 'bg-rose-500/10 text-rose-400 border border-rose-500/20'
              }`}>
                {currentResult.status}
              </span>
            )}
          </div>

          {!currentResult ? (
            <div className="text-center py-16 text-slate-500 text-xs">
              {isAr ? 'اضغط على "تشغيل الاختبار التاريخي" لبدء المحاكاة الزمنية' : 'Click "Execute Backtest" to run simulation against recorded snapshots'}
            </div>
          ) : (
            <div className="space-y-5">
              {/* Status Explanation Banner */}
              <div className="p-3.5 rounded-xl bg-slate-950 border border-slate-800 text-xs text-slate-300 leading-relaxed">
                <span className="font-bold text-white mr-1">{isAr ? 'تقرير المحاكاة:' : 'Simulation Note:'}</span>
                {currentResult.statusExplanation}
              </div>

              {/* KPI Metrics Grid */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="p-3 rounded-xl bg-slate-950 border border-slate-800">
                  <div className="text-[11px] text-slate-400">{isAr ? 'صافي العائد ($)' : 'Net PnL'}</div>
                  <div className={`text-base font-bold font-mono mt-1 ${
                    currentResult.netPnlUsd >= 0 ? 'text-emerald-400' : 'text-rose-400'
                  }`}>
                    {currentResult.netPnlUsd >= 0 ? '+' : ''}${currentResult.netPnlUsd.toFixed(2)}
                  </div>
                  <div className="text-[10px] text-slate-500 font-mono mt-0.5">
                    ({currentResult.totalReturnPercent.toFixed(1)}%)
                  </div>
                </div>

                <div className="p-3 rounded-xl bg-slate-950 border border-slate-800">
                  <div className="text-[11px] text-slate-400">{isAr ? 'نسبة الصفقات الرابحة' : 'Win Rate'}</div>
                  <div className="text-base font-bold font-mono text-cyan-400 mt-1">
                    {currentResult.winRatePercent.toFixed(1)}%
                  </div>
                  <div className="text-[10px] text-slate-500 font-mono mt-0.5">
                    {currentResult.winningTrades}W / {currentResult.losingTrades}L
                  </div>
                </div>

                <div className="p-3 rounded-xl bg-slate-950 border border-slate-800">
                  <div className="text-[11px] text-slate-400">{isAr ? 'معامل الربح (Profit Factor)' : 'Profit Factor'}</div>
                  <div className="text-base font-bold font-mono text-white mt-1">
                    {currentResult.profitFactor.toFixed(2)}
                  </div>
                  <div className="text-[10px] text-slate-500 font-mono mt-0.5">
                    {currentResult.totalTrades} {isAr ? 'صفقات' : 'trades'}
                  </div>
                </div>

                <div className="p-3 rounded-xl bg-slate-950 border border-slate-800">
                  <div className="text-[11px] text-slate-400">{isAr ? 'أقصى تراجع (Drawdown)' : 'Max Drawdown'}</div>
                  <div className="text-base font-bold font-mono text-rose-400 mt-1">
                    {currentResult.maxDrawdownPercent.toFixed(1)}%
                  </div>
                  <div className="text-[10px] text-slate-500 font-mono mt-0.5">
                    Avg Hold: {currentResult.avgHoldTimeMinutes.toFixed(0)}m
                  </div>
                </div>
              </div>

              {/* Trades Log */}
              {currentResult.trades && currentResult.trades.length > 0 && (
                <div className="space-y-2">
                  <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider">
                    {isAr ? 'سجل الصفقات التاريخية المحاكاة' : 'Simulated Trade Log'}
                  </h4>

                  <div className="overflow-x-auto">
                    <table className="w-full text-right text-xs font-mono">
                      <thead className="text-slate-400 border-b border-slate-800 pb-2">
                        <tr>
                          <th className="py-2 px-3 font-sans">{isAr ? 'التوكن' : 'Token'}</th>
                          <th className="py-2 px-3">{isAr ? 'الدخول' : 'Entry'}</th>
                          <th className="py-2 px-3">{isAr ? 'الخروج' : 'Exit'}</th>
                          <th className="py-2 px-3">{isAr ? 'الربح/الخسارة' : 'PnL'}</th>
                          <th className="py-2 px-3 font-sans">{isAr ? 'سبب الخروج' : 'Reason'}</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-800/60">
                        {currentResult.trades.map((t, idx) => (
                          <tr key={idx} className="hover:bg-slate-800/30">
                            <td className="py-2 px-3 font-sans font-bold text-white">{t.tokenSymbol}</td>
                            <td className="py-2 px-3 text-slate-300">${t.entryPriceUsd.toFixed(4)}</td>
                            <td className="py-2 px-3 text-slate-300">${t.exitPriceUsd.toFixed(4)}</td>
                            <td className={`py-2 px-3 font-bold ${t.pnlUsd >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                              {t.pnlUsd >= 0 ? '+' : ''}${t.pnlUsd.toFixed(2)} ({t.pnlPercent.toFixed(1)}%)
                            </td>
                            <td className="py-2 px-3 font-sans text-slate-400 text-[11px]">{t.exitReason}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
