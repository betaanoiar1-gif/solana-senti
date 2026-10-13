import React from 'react';
import { Sparkles, BarChart2, Info, ArrowUpRight, Eye } from 'lucide-react';
import { TokenIntelligence } from '../types';

interface OpportunityLabTabProps {
  tokens: TokenIntelligence[];
  isAr: boolean;
  onSelectToken: (token: TokenIntelligence) => void;
}

export const OpportunityLabTab: React.FC<OpportunityLabTabProps> = ({
  tokens,
  isAr,
  onSelectToken,
}) => {
  const rankedTokens = [...tokens].sort(
    (a, b) => b.opportunity.overallScore - a.opportunity.overallScore
  );

  const factorSpecs = [
    { name: isAr ? 'زخم المشترين ونشاط الصفقات' : 'Buyer Momentum', pts: 20, weight: '20%' },
    { name: isAr ? 'جودة عمق السيولة' : 'Liquidity Quality', pts: 20, weight: '20%' },
    { name: isAr ? 'تسارع أحجام التداول' : 'Volume Acceleration', pts: 15, weight: '15%' },
    { name: isAr ? 'تنوع المحافظ والصفقات' : 'Holder Diversity', pts: 15, weight: '15%' },
    { name: isAr ? 'عمر الزوج وتوقيت الفرصة' : 'Timing & Pair Age', pts: 10, weight: '10%' },
    { name: isAr ? 'الزخم السعري والمسار' : 'Price Trajectory', pts: 10, weight: '10%' },
    { name: isAr ? 'النشاط المجتمعي والبحث العلمي (DeSci)' : 'DeSci / Ecosystem Activity', pts: 10, weight: '10%' },
  ];

  return (
    <div className="space-y-6">
      {/* Intro Header */}
      <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-5">
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-xl bg-cyan-500/10 text-cyan-400 border border-cyan-500/20 flex items-center justify-center shrink-0">
            <Sparkles className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-sm font-bold text-white uppercase tracking-wider">
              {isAr ? 'مقياس جودة الفرص الاستثمارية (0 إلى 100 نقطة)' : 'Opportunity Scoring Engine (0-100)'}
            </h2>
            <p className="text-xs text-slate-300 leading-relaxed mt-1">
              {isAr
                ? 'نموذج تقييم خوارزمي متعدد العوامل يجمع بين الزخم، عمق السوق، وتدفقات المشترين. لا يتم احتساب أي نقطة على أساس بيانات وهمية، مع فصل تام بين مؤشر الفرصة ومؤشر المخاطر.'
                : 'Multi-factor quantitative model combining momentum, liquidity depth, and net buyer pressure. Separated completely from risk safety.'}
            </p>
          </div>
        </div>
      </div>

      {/* Weights Matrix */}
      <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-5">
        <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3">
          {isAr ? 'مصفوفة أوزان العوامل السبعة (Total: 100 Pts)' : 'Seven-Factor Weight Matrix (Total: 100 Pts)'}
        </h3>

        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-2.5">
          {factorSpecs.map((spec, i) => (
            <div key={i} className="p-3 rounded-xl bg-slate-950 border border-slate-800/80 text-center">
              <div className="text-base font-bold font-mono text-cyan-400">{spec.pts} pts</div>
              <div className="text-[11px] text-slate-300 mt-1 line-clamp-2">{spec.name}</div>
              <div className="text-[10px] text-slate-500 font-mono mt-0.5">{spec.weight}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Ranked Tokens Table */}
      <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-5 space-y-4">
        <h3 className="text-sm font-bold text-white uppercase tracking-wider">
          {isAr ? 'ترتيب العملات حسب قوة الفرصة الحالية' : 'Ranked Tokens by Opportunity Score'}
        </h3>

        <div className="space-y-3">
          {rankedTokens.map((token, index) => {
            const opp = token.opportunity;
            return (
              <div
                key={token.address}
                className="p-4 rounded-xl bg-slate-950/80 border border-slate-800 hover:border-slate-700 transition space-y-3"
              >
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <span className="w-6 h-6 rounded-full bg-slate-800 text-slate-400 font-mono text-xs flex items-center justify-center font-bold">
                      #{index + 1}
                    </span>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-white text-sm">{token.name}</span>
                        <span className="text-xs font-mono text-slate-400 uppercase">({token.symbol})</span>
                        <span className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold ${
                          token.risk.status === 'PASS'
                            ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                            : 'bg-rose-500/10 text-rose-400 border border-rose-500/20'
                        }`}>
                          {token.risk.status}
                        </span>
                      </div>
                      <div className="text-xs font-mono text-slate-400 mt-0.5">
                        ${token.baseTokenPriceUsd < 0.01 ? token.baseTokenPriceUsd.toFixed(6) : token.baseTokenPriceUsd.toFixed(4)}
                        {' • '}${token.liquidityUsd.toLocaleString()} Liq
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-3 self-end sm:self-auto">
                    <div className="text-right">
                      <div className="text-xl font-bold font-mono text-cyan-400">
                        {opp.overallScore} / 100
                      </div>
                      <div className="text-[10px] text-slate-500">
                        {isAr ? 'مستوى الثقة:' : 'Confidence:'} {opp.confidence}%
                      </div>
                    </div>

                    <button
                      onClick={() => onSelectToken(token)}
                      className="px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold flex items-center gap-1 transition"
                    >
                      <Eye className="w-3.5 h-3.5" />
                      <span>{isAr ? 'تحليل العوامل' : 'Factors'}</span>
                    </button>
                  </div>
                </div>

                {/* Factors Mini Progress Grid */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-2 border-t border-slate-900 text-[11px]">
                  {opp.factors.slice(0, 4).map((f, fi) => (
                    <div key={fi} className="p-2 rounded-lg bg-slate-900/60">
                      <div className="flex justify-between text-slate-400 text-[10px]">
                        <span className="truncate">{f.factor}</span>
                        <span className="font-mono text-cyan-400">{f.score}/{f.maxScore}</span>
                      </div>
                      <div className="w-full bg-slate-800 h-1.5 rounded-full mt-1.5 overflow-hidden">
                        <div
                          className="bg-cyan-400 h-1.5 rounded-full"
                          style={{ width: `${(f.score / f.maxScore) * 100}%` }}
                        />
                      </div>
                    </div>
                  ))}
                </div>

                {/* Positive Drivers Pill List */}
                {opp.positiveDrivers.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 pt-1">
                    {opp.positiveDrivers.map((driver, di) => (
                      <span
                        key={di}
                        className="text-[10px] px-2 py-0.5 rounded bg-cyan-950/40 text-cyan-300 border border-cyan-500/20"
                      >
                        ✓ {driver}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
