import React, { useState } from 'react';
import {
  X,
  ShieldCheck,
  ShieldAlert,
  AlertTriangle,
  HelpCircle,
  Copy,
  Check,
  Sparkles,
  Dna,
  Coins,
  Cpu,
  Brain,
  ExternalLink,
  BookOpen,
} from 'lucide-react';
import { TokenIntelligence } from '../types';
import { api } from '../services/api';

interface TokenDossierModalProps {
  token: TokenIntelligence | null;
  isOpen: boolean;
  isAr: boolean;
  onClose: () => void;
  onExecutePaperOrder: (order: any) => Promise<void>;
}

export const TokenDossierModal: React.FC<TokenDossierModalProps> = ({
  token,
  isOpen,
  isAr,
  onClose,
  onExecutePaperOrder,
}) => {
  if (!isOpen || !token) return null;

  const [activeTab, setActiveTab] = useState<'overview' | 'risk' | 'opportunity' | 'science' | 'trade'>('overview');
  const [copied, setCopied] = useState(false);
  const [buyAmount, setBuyAmount] = useState('100');
  const [assetUsed, setAssetUsed] = useState<'USDC' | 'SOL'>('USDC');
  const [slPercent, setSlPercent] = useState('15');
  const [tpPercent, setTpPercent] = useState('35');
  const [isOrdering, setIsOrdering] = useState(false);
  const [orderMessage, setOrderMessage] = useState<{ text: string; error?: boolean } | null>(null);

  const copyAddress = () => {
    navigator.clipboard.writeText(token.address);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleExecuteBuy = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsOrdering(true);
    setOrderMessage(null);
    try {
      await onExecutePaperOrder({
        tokenAddress: token.address,
        tokenSymbol: token.symbol,
        tokenName: token.name,
        orderType: 'BUY',
        assetUsed,
        amountIn: Number(buyAmount),
        marketPriceUsd: token.baseTokenPriceUsd,
        liquidityUsd: token.liquidityUsd,
        stopLossPercent: Number(slPercent),
        takeProfitPercent: Number(tpPercent),
        idempotencyKey: `dossier-order-${Date.now()}`,
      });
      setOrderMessage({ text: isAr ? 'تم تنفيذ الشراء الافتراضي بنجاح!' : 'Paper order filled successfully!' });
    } catch (err: any) {
      setOrderMessage({ text: err.message || 'Failed order', error: true });
    } finally {
      setIsOrdering(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-black/80 backdrop-blur-sm overflow-y-auto">
      <div className="relative w-full max-w-4xl rounded-2xl bg-slate-900 border border-slate-800 shadow-2xl overflow-hidden my-auto max-h-[92vh] flex flex-col">
        {/* Header */}
        <div className="p-4 sm:p-6 border-b border-slate-800 bg-slate-950/60 flex items-center justify-between gap-4 shrink-0">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-11 h-11 rounded-xl bg-indigo-500/10 border border-indigo-500/20 font-bold font-mono text-cyan-400 flex items-center justify-center shrink-0 text-sm">
              {token.symbol.slice(0, 3)}
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <h2 className="text-base sm:text-lg font-bold text-white truncate">{token.name}</h2>
                <span className="text-xs font-mono text-slate-400 uppercase">({token.symbol})</span>
                <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
                  {token.lifecycleStage}
                </span>
                {token.scienceData?.isDeSci && (
                  <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-teal-500/10 text-teal-300 border border-teal-500/20">
                    🧬 DeSci
                  </span>
                )}
              </div>
              <div className="flex items-center gap-2 text-xs font-mono text-slate-400 mt-1">
                <span>{token.address.slice(0, 8)}...{token.address.slice(-8)}</span>
                <button
                  onClick={copyAddress}
                  className="p-1 hover:text-white transition text-slate-500"
                  title="Copy contract"
                >
                  {copied ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                </button>
              </div>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Navigation */}
        <div className="flex items-center gap-1 border-b border-slate-800 bg-slate-950/40 px-4 sm:px-6 py-2 overflow-x-auto scrollbar-none shrink-0">
          {[
            { id: 'overview', label: isAr ? 'نظرة عامة' : 'Overview' },
            { id: 'risk', label: isAr ? 'فحص المخاطر والأمان' : 'Risk & Security' },
            { id: 'opportunity', label: isAr ? 'تقييم الفرصة' : 'Opportunity Factors' },
            { id: 'science', label: isAr ? 'الأبحاث والعلوم (DeSci)' : 'Science & Bioscience' },
            { id: 'trade', label: isAr ? 'تداول افتراضي (Paper Buy)' : 'Paper Trade' },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition ${
                activeTab === tab.id
                  ? 'bg-indigo-600 text-white'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Content Body */}
        <div className="p-4 sm:p-6 overflow-y-auto space-y-6 flex-1">
          {/* TAB 1: OVERVIEW */}
          {activeTab === 'overview' && (
            <div className="space-y-6">
              {/* Metric Highlights */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="p-3.5 rounded-xl bg-slate-950 border border-slate-800">
                  <div className="text-[11px] text-slate-400">{isAr ? 'السعر الحالي' : 'Price'}</div>
                  <div className="text-base font-bold font-mono text-white mt-1">
                    ${token.baseTokenPriceUsd < 0.01 ? token.baseTokenPriceUsd.toFixed(6) : token.baseTokenPriceUsd.toFixed(4)}
                  </div>
                </div>

                <div className="p-3.5 rounded-xl bg-slate-950 border border-slate-800">
                  <div className="text-[11px] text-slate-400">{isAr ? 'السيولة' : 'Liquidity'}</div>
                  <div className="text-base font-bold font-mono text-cyan-400 mt-1">
                    ${token.liquidityUsd.toLocaleString()}
                  </div>
                </div>

                <div className="p-3.5 rounded-xl bg-slate-950 border border-slate-800">
                  <div className="text-[11px] text-slate-400">{isAr ? 'حجم التداول 24س' : '24h Volume'}</div>
                  <div className="text-base font-bold font-mono text-slate-200 mt-1">
                    ${token.volume24hUsd.toLocaleString()}
                  </div>
                </div>

                <div className="p-3.5 rounded-xl bg-slate-950 border border-slate-800">
                  <div className="text-[11px] text-slate-400">{isAr ? 'مؤشر الأمان والفرصة' : 'Risk / Opp'}</div>
                  <div className="text-sm font-bold font-mono mt-1 flex items-center gap-1.5">
                    <span className={token.risk.status === 'PASS' ? 'text-emerald-400' : 'text-rose-400'}>
                      {token.risk.status}
                    </span>
                    <span>/</span>
                    <span className="text-cyan-400">{token.opportunity.overallScore}</span>
                  </div>
                </div>
              </div>

              {/* Price & Snapshot Graph simulation */}
              <div className="p-4 rounded-xl bg-slate-950 border border-slate-800">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-xs font-bold text-white uppercase tracking-wider">
                    {isAr ? 'سجل اللقطات الزمنية وحركة السعر' : 'Historical Snapshots & Price Trend'}
                  </h3>
                  <span className="text-[10px] font-mono text-slate-500">
                    {token.snapshots?.length || 1} {isAr ? 'لقطات مسجلة' : 'snapshots'}
                  </span>
                </div>

                {/* SVG Mini Chart */}
                <div className="h-32 w-full flex items-end gap-1 pt-4 pb-2 px-2 border-b border-slate-800">
                  {token.snapshots && token.snapshots.length > 1 ? (
                    token.snapshots.map((s, idx) => {
                      const maxP = Math.max(...token.snapshots.map(x => x.priceUsd)) || 1;
                      const minP = Math.min(...token.snapshots.map(x => x.priceUsd)) || 0;
                      const range = maxP - minP || 1;
                      const heightPercent = Math.max(15, Math.min(100, ((s.priceUsd - minP) / range) * 100));

                      return (
                        <div
                          key={idx}
                          className="flex-1 bg-indigo-500/40 hover:bg-cyan-400 rounded-t transition relative group"
                          style={{ height: `${heightPercent}%` }}
                        >
                          <div className="hidden group-hover:block absolute -top-8 left-1/2 -translate-x-1/2 bg-slate-900 border border-slate-700 text-white text-[10px] font-mono px-2 py-0.5 rounded shadow z-10 whitespace-nowrap">
                            ${s.priceUsd.toFixed(6)}
                          </div>
                        </div>
                      );
                    })
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-xs text-slate-500">
                      {isAr ? 'يتم تجميع لقطات زمنية إضافية عبر المجدول دورياً' : 'Gathering recurring snapshots via scheduler'}
                    </div>
                  )}
                </div>
              </div>

              {/* Summary description */}
              <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 text-xs text-slate-300 leading-relaxed">
                <div className="font-semibold text-white mb-1">{isAr ? 'ملخص المحرك الأمني:' : 'Security Engine Summary:'}</div>
                <p>{token.risk.summary}</p>
              </div>
            </div>
          )}

          {/* TAB 2: RISK CHECKLIST */}
          {activeTab === 'risk' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between p-3.5 rounded-xl bg-slate-950 border border-slate-800">
                <div>
                  <div className="text-xs text-slate-400">{isAr ? 'حالة التقييم العام للمخاطر' : 'Overall Risk Status'}</div>
                  <div className="text-lg font-bold font-mono mt-0.5 text-white flex items-center gap-2">
                    <span>{token.risk.status}</span>
                    <span className="text-xs text-slate-400">({isAr ? 'الدرجة:' : 'Score:'} {token.risk.score}/100)</span>
                  </div>
                </div>
                <div className="text-right text-xs text-slate-400 font-mono">
                  <div>Version: {token.risk.ruleVersion}</div>
                  <div>Level: {token.risk.level}</div>
                </div>
              </div>

              <div className="space-y-2.5">
                {token.risk.evaluations.map((ev) => (
                  <div
                    key={ev.ruleId}
                    className={`p-3.5 rounded-xl border flex items-start gap-3 ${
                      ev.passed
                        ? 'bg-emerald-950/10 border-emerald-500/20'
                        : ev.severity === 'CRITICAL'
                        ? 'bg-rose-950/20 border-rose-500/30'
                        : 'bg-amber-950/15 border-amber-500/20'
                    }`}
                  >
                    <div className="mt-0.5 shrink-0">
                      {ev.passed ? (
                        <ShieldCheck className="w-4 h-4 text-emerald-400" />
                      ) : ev.severity === 'CRITICAL' ? (
                        <ShieldAlert className="w-4 h-4 text-rose-400" />
                      ) : (
                        <AlertTriangle className="w-4 h-4 text-amber-400" />
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-white">{ev.name}</span>
                        <span className={`text-[10px] font-mono px-1.5 py-0.2 rounded font-bold ${
                          ev.passed ? 'text-emerald-400' : 'text-rose-400'
                        }`}>
                          {ev.passed ? 'PASSED' : ev.severity}
                        </span>
                      </div>
                      <div className="text-xs text-slate-300 mt-1">{ev.description}</div>
                      <div className="text-[11px] font-mono text-slate-400 mt-1">
                        {isAr ? 'الدليل:' : 'Evidence:'} {ev.evidence}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* TAB 3: OPPORTUNITY FACTORS */}
          {activeTab === 'opportunity' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between p-3.5 rounded-xl bg-slate-950 border border-slate-800">
                <div>
                  <div className="text-xs text-slate-400">{isAr ? 'مؤشر الفرصة الكلي' : 'Overall Opportunity Score'}</div>
                  <div className="text-xl font-bold font-mono text-cyan-400 mt-0.5">
                    {token.opportunity.overallScore} / 100
                  </div>
                </div>
                <div className="text-right text-xs text-slate-400 font-mono">
                  <div>Confidence: {token.opportunity.confidence}%</div>
                </div>
              </div>

              <div className="space-y-3">
                {token.opportunity.factors.map((f, idx) => (
                  <div key={idx} className="p-3.5 rounded-xl bg-slate-950 border border-slate-800">
                    <div className="flex items-center justify-between text-xs mb-1.5">
                      <span className="font-semibold text-white">{f.factor}</span>
                      <span className="font-mono font-bold text-cyan-400">
                        {f.score} / {f.maxScore}
                      </span>
                    </div>
                    <div className="w-full bg-slate-800 h-2 rounded-full overflow-hidden mb-2">
                      <div
                        className="bg-gradient-to-r from-indigo-500 to-cyan-400 h-2 rounded-full"
                        style={{ width: `${(f.score / f.maxScore) * 100}%` }}
                      />
                    </div>
                    <div className="text-[11px] text-slate-400">{f.evidence}</div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* TAB 4: SCIENCE & DESCI HUB */}
          {activeTab === 'science' && (
            <div className="space-y-5">
              <div className="p-4 rounded-xl bg-teal-950/20 border border-teal-500/30 flex items-start gap-3">
                <Dna className="w-5 h-5 text-teal-400 shrink-0 mt-0.5" />
                <div className="text-xs leading-relaxed text-slate-200">
                  <div className="font-bold text-white mb-1">
                    {isAr ? 'العلوم اللامركزية وأبحاث إطالة العمر (DeSci Longevity)' : 'Decentralized Science (DeSci) Longevity Protocol'}
                  </div>
                  {isAr
                    ? 'يتم ربط توكنات المركبات الطبية مباشرة مع قواعد البيانات العلمية الرسمية (PubChem) وسجلات PubMed لتأكيد الفاعلية البيولوجية.'
                    : 'Tokens representing medical & longevity compounds are verified against official PubChem chemistry and PubMed study references.'}
                </div>
              </div>

              {token.scienceData ? (
                <div className="space-y-4">
                  {/* Compound Spec */}
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                    <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 text-xs">
                      <div className="text-slate-400">{isAr ? 'اسم المركب' : 'Compound'}</div>
                      <div className="font-bold text-white font-mono mt-1">{token.scienceData.compoundName}</div>
                    </div>
                    <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 text-xs">
                      <div className="text-slate-400">PubChem CID</div>
                      <div className="font-bold text-cyan-400 font-mono mt-1">{token.scienceData.pubchemCid || 'N/A'}</div>
                    </div>
                    <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 text-xs">
                      <div className="text-slate-400">{isAr ? 'الصيغة الجزيئية' : 'Formula'}</div>
                      <div className="font-bold text-slate-200 font-mono mt-1">{token.scienceData.molecularFormula || 'C13H8O4'}</div>
                    </div>
                  </div>

                  {/* Chemical Structure SMILES */}
                  {token.scienceData.smiles && (
                    <div className="p-3.5 rounded-xl bg-slate-950 border border-slate-800">
                      <div className="text-xs font-semibold text-white mb-1">{isAr ? 'بنية SMILES الكيميائية:' : 'SMILES Chemical Representation:'}</div>
                      <div className="text-[11px] font-mono text-teal-300 bg-slate-900 p-2.5 rounded-lg break-all select-all">
                        {token.scienceData.smiles}
                      </div>
                    </div>
                  )}

                  {/* Longevity Assay Protocol */}
                  <div className="p-3.5 rounded-xl bg-slate-950 border border-slate-800">
                    <div className="text-xs font-semibold text-white mb-1">{isAr ? 'بروتوكول التجارب الحيوية وإطالة العمر:' : 'Longevity Assay Protocol:'}</div>
                    <div className="text-xs text-slate-300 leading-relaxed">
                      {token.scienceData.longevityTrial || 'تجارب مخبرية على الكائنات الحية النموذجية (C. elegans وذباب الفاكهة) لفحص معدلات البقاء.'}
                    </div>
                  </div>

                  {/* PubMed Literature Citations */}
                  {token.scienceData.pubmedArticles && token.scienceData.pubmedArticles.length > 0 && (
                    <div className="space-y-2">
                      <div className="text-xs font-bold text-white flex items-center gap-1.5">
                        <BookOpen className="w-3.5 h-3.5 text-teal-400" />
                        <span>{isAr ? 'دراسات ومراجع PubMed المحكمة:' : 'Peer-Reviewed PubMed Studies:'}</span>
                      </div>
                      {token.scienceData.pubmedArticles.map((art) => (
                        <a
                          key={art.pmid}
                          href={art.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="block p-3 rounded-xl bg-slate-950 hover:bg-slate-900 border border-slate-800 transition group"
                        >
                          <div className="text-xs font-semibold text-slate-200 group-hover:text-cyan-400 flex items-center justify-between">
                            <span className="truncate">{art.title}</span>
                            <ExternalLink className="w-3.5 h-3.5 shrink-0 ml-2" />
                          </div>
                          <div className="text-[10px] font-mono text-slate-500 mt-1">
                            PMID: {art.pmid} • {art.year}
                          </div>
                        </a>
                      ))}
                    </div>
                  )}
                </div>
              ) : (
                <div className="p-8 text-center text-xs text-slate-500">
                  {isAr ? 'هذا التوكن ليس مسجلاً كرمز DeSci حيوي في النظام' : 'This token is not categorized as a biomedical DeSci asset'}
                </div>
              )}
            </div>
          )}

          {/* TAB 5: PAPER TRADE WIDGET */}
          {activeTab === 'trade' && (
            <div className="max-w-md mx-auto space-y-4 py-2">
              <div className="p-3.5 rounded-xl bg-indigo-950/20 border border-indigo-500/30 text-xs text-slate-300">
                {isAr
                  ? 'محاكاة افتراضية (Paper Trading). لا توجد أموال حقيقية قيد الخطر. يتم التنفيذ بأسعار السوق الحية.'
                  : 'Paper Trading simulator. Zero real funds at risk. Live market execution with simulated slippage.'}
              </div>

              <form onSubmit={handleExecuteBuy} className="space-y-4">
                {/* Asset Choice */}
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setAssetUsed('USDC')}
                    className={`py-2 rounded-xl text-xs font-bold transition border ${
                      assetUsed === 'USDC'
                        ? 'bg-indigo-600 border-indigo-500 text-white'
                        : 'bg-slate-950 border-slate-800 text-slate-400'
                    }`}
                  >
                    شراء بـ USDC
                  </button>
                  <button
                    type="button"
                    onClick={() => setAssetUsed('SOL')}
                    className={`py-2 rounded-xl text-xs font-bold transition border ${
                      assetUsed === 'SOL'
                        ? 'bg-indigo-600 border-indigo-500 text-white'
                        : 'bg-slate-950 border-slate-800 text-slate-400'
                    }`}
                  >
                    شراء بـ SOL
                  </button>
                </div>

                {/* Amount */}
                <div>
                  <label className="block text-xs font-medium text-slate-400 mb-1">
                    {isAr ? `المبلغ المراد استثماره (${assetUsed})` : `Amount to spend (${assetUsed})`}
                  </label>
                  <input
                    type="number"
                    step="any"
                    value={buyAmount}
                    onChange={(e) => setBuyAmount(e.target.value)}
                    required
                    className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-sm font-mono text-white focus:outline-none focus:border-indigo-500"
                  />
                </div>

                {/* Stop Loss & Take Profit */}
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-slate-400 mb-1">
                      {isAr ? 'وقف الخسارة (%)' : 'Stop Loss (%)'}
                    </label>
                    <input
                      type="number"
                      value={slPercent}
                      onChange={(e) => setSlPercent(e.target.value)}
                      className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-xs font-mono text-white"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-400 mb-1">
                      {isAr ? 'جني الأرباح (%)' : 'Take Profit (%)'}
                    </label>
                    <input
                      type="number"
                      value={tpPercent}
                      onChange={(e) => setTpPercent(e.target.value)}
                      className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-xs font-mono text-white"
                    />
                  </div>
                </div>

                {/* Order execution feedback */}
                {orderMessage && (
                  <div className={`p-3 rounded-xl text-xs ${
                    orderMessage.error ? 'bg-rose-950/40 text-rose-300 border border-rose-500/30' : 'bg-emerald-950/40 text-emerald-300 border border-emerald-500/30'
                  }`}>
                    {orderMessage.text}
                  </div>
                )}

                <button
                  type="submit"
                  disabled={isOrdering || token.risk.status === 'BLOCKED'}
                  className="w-full py-3 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs transition disabled:opacity-40"
                >
                  {isOrdering ? (isAr ? 'جاري التنفيذ...' : 'Executing...') : (isAr ? 'تنفيذ الأمر الافتراضي' : 'Execute Paper Buy')}
                </button>
              </form>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
