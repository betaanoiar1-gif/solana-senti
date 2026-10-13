import React from 'react';
import {
  ShieldAlert,
  ShieldCheck,
  AlertTriangle,
  XCircle,
  HelpCircle,
  Lock,
  Unlock,
  Eye,
  Info,
} from 'lucide-react';
import { TokenIntelligence } from '../types';

interface RiskRadarTabProps {
  tokens: TokenIntelligence[];
  isAr: boolean;
  onSelectToken: (token: TokenIntelligence) => void;
}

export const RiskRadarTab: React.FC<RiskRadarTabProps> = ({
  tokens,
  isAr,
  onSelectToken,
}) => {
  const blockedTokens = tokens.filter((t) => t.risk.status === 'BLOCKED');
  const reviewTokens = tokens.filter((t) => t.risk.status === 'REVIEW');
  const passTokens = tokens.filter((t) => t.risk.status === 'PASS');
  const unknownTokens = tokens.filter((t) => t.risk.status === 'UNKNOWN' || t.risk.status === 'ERROR');

  const coreRules = [
    {
      id: 'MINT',
      name: isAr ? 'إلغاء سلطة الصك (Mint Revocation)' : 'Mint Authority Revocation',
      desc: isAr
        ? 'التحقق عبر Solana RPC من أن سلطة طباعة التوكن ملغاة (null). عدم الإلغاء يتيح للمطور صك ترليونات الرموز وإسقاط السعر إلى الصفر.'
        : 'Verifies via Solana RPC that mint authority is revoked (null). Active authority allows minting infinite tokens.',
      severity: 'CRITICAL',
    },
    {
      id: 'FREEZE',
      name: isAr ? 'إلغاء سلطة التجميد (Freeze Revocation)' : 'Freeze Authority Revocation',
      desc: isAr
        ? 'التأكد من خلو العقد من سلطة تجميد حسابات المشترين. وجود سلطة تجميد يمثل مصيدة Honeypot كاملة تمنع بيع العملة.'
        : 'Ensures freeze authority is revoked. Active freeze authority allows blacklisting buyers (Honeypot).',
      severity: 'CRITICAL',
    },
    {
      id: 'LIQUIDITY',
      name: isAr ? 'حاجز عمق السيولة (Liquidity Threshold)' : 'Liquidity Depth Floor',
      desc: isAr
        ? 'اشتراط حد أدنى أولي للسيولة ($5,000 كحد حرج، و$20,000 كحد أمان). الأحواض ذات السيولة الشحيحة تعرض المتداول لانزلاق كارثي.'
        : 'Requires minimum pool liquidity ($5,000 floor, $20,000 safe margin). Shallow pools inflict severe slippage.',
      severity: 'CRITICAL / HIGH',
    },
    {
      id: 'DRAIN',
      name: isAr ? 'رصد نزيف السيولة المفاجئ (Drain / Pull)' : 'Liquidity Drain Detection',
      desc: isAr
        ? 'مقارنة اللقطات التاريخية لاكتشاف أي سحب مفاجئ لسيولة المسبح (-35% أو أكثر) وحظر التوكن فوراً.'
        : 'Compares chronological snapshots to catch sudden liquidity pulls (-35%+) and instantly block.',
      severity: 'CRITICAL',
    },
  ];

  return (
    <div className="space-y-6">
      {/* Educational Mission Notice */}
      <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-5">
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-xl bg-rose-500/10 text-rose-400 border border-rose-500/20 flex items-center justify-center shrink-0">
            <ShieldAlert className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-sm font-bold text-white uppercase tracking-wider">
              {isAr ? 'محرك فحص المخاطر والأمان (SENTINEL_RISK_v2.1)' : 'Sentinel Security & Risk Engine'}
            </h2>
            <p className="text-xs text-slate-300 leading-relaxed mt-1">
              {isAr
                ? 'قواعد تقييم قطعية ومفسرة ترفض مبدأ الافتراضات العمياء. حالات UNKNOWN أو ERROR لا تتحول مطلقاً إلى PASS، ونقص البيانات يمنع التأهيل التلقائي لحماية رأس المال.'
                : 'Deterministic and explainable rules. UNKNOWN or ERROR states NEVER evaluate to PASS. Missing data blocks qualification to protect simulated capital.'}
            </p>
          </div>
        </div>
      </div>

      {/* Core Rules Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {coreRules.map((rule) => (
          <div key={rule.id} className="p-4 rounded-2xl bg-slate-900/60 border border-slate-800 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-white">{rule.name}</span>
              <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded bg-rose-500/10 text-rose-400 border border-rose-500/20">
                {rule.severity}
              </span>
            </div>
            <p className="text-xs text-slate-400 leading-relaxed">{rule.desc}</p>
          </div>
        ))}
      </div>

      {/* Blocked Tokens Warning Section */}
      <div className="rounded-2xl border border-rose-500/20 bg-rose-950/10 p-5 space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-rose-400">
            <XCircle className="w-4 h-4" />
            <h3 className="text-sm font-bold uppercase tracking-wider text-white">
              {isAr ? 'العملات المحظورة أمنياً (BLOCKED)' : 'Blocked Tokens'} ({blockedTokens.length})
            </h3>
          </div>
          <span className="text-xs text-rose-400 font-mono">
            {isAr ? 'ممنوع من الشراء والتأهيل' : 'Trading & Qualification Blocked'}
          </span>
        </div>

        {blockedTokens.length === 0 ? (
          <div className="text-center py-6 text-xs text-slate-500">
            {isAr ? 'لم يتم رصد أي عملة محظورة حالياً في التغذية النشطة' : 'No blocked tokens detected in active feed'}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {blockedTokens.map((token) => (
              <div
                key={token.address}
                className="p-3.5 rounded-xl bg-slate-950/80 border border-rose-500/20 flex items-start justify-between gap-3"
              >
                <div className="min-w-0">
                  <div className="font-bold text-white text-xs truncate">
                    {token.name} ({token.symbol})
                  </div>
                  <div className="text-[11px] text-rose-300 mt-1 line-clamp-2">
                    {token.risk.summary}
                  </div>
                  <div className="text-[10px] font-mono text-slate-500 mt-1.5 truncate">
                    {token.address}
                  </div>
                </div>

                <button
                  onClick={() => onSelectToken(token)}
                  className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-[11px] font-medium shrink-0"
                >
                  {isAr ? 'التفاصيل' : 'Audit'}
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Review & Unknown Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* REVIEW */}
        <div className="rounded-2xl border border-amber-500/20 bg-amber-950/10 p-5 space-y-3">
          <div className="flex items-center gap-2 text-amber-400">
            <AlertTriangle className="w-4 h-4" />
            <h3 className="text-sm font-bold text-white uppercase tracking-wider">
              {isAr ? 'أزواج تحت المراجعة (REVIEW)' : 'Under Review'} ({reviewTokens.length})
            </h3>
          </div>
          <p className="text-xs text-slate-400">
            {isAr
              ? 'مؤشرات مخاطر متوسطة (عمر حديث، سيولة متواضعة، أو تذبذب متسارع) تستوجب الحيطة.'
              : 'Moderate risk indicators (very young pair, marginal liquidity) requiring extra caution.'}
          </p>

          <div className="space-y-2">
            {reviewTokens.slice(0, 5).map((token) => (
              <div
                key={token.address}
                onClick={() => onSelectToken(token)}
                className="p-2.5 rounded-xl bg-slate-950 border border-slate-800 hover:border-slate-700 cursor-pointer flex items-center justify-between text-xs transition"
              >
                <span className="font-semibold text-white truncate">{token.name} ({token.symbol})</span>
                <span className="text-amber-400 font-mono font-bold">{token.risk.score}/100</span>
              </div>
            ))}
          </div>
        </div>

        {/* PASS */}
        <div className="rounded-2xl border border-emerald-500/20 bg-emerald-950/10 p-5 space-y-3">
          <div className="flex items-center gap-2 text-emerald-400">
            <ShieldCheck className="w-4 h-4" />
            <h3 className="text-sm font-bold text-white uppercase tracking-wider">
              {isAr ? 'أزواج مجتازة للأمان (PASS)' : 'Passed Security'} ({passTokens.length})
            </h3>
          </div>
          <p className="text-xs text-slate-400">
            {isAr
              ? 'سلطات الصك والتجميد ملغاة، سيولة قوية ومستقرة، ومطابقة للمعايير القياسية.'
              : 'Mint & Freeze authorities revoked, deep pool depth, passed all criteria.'}
          </p>

          <div className="space-y-2">
            {passTokens.slice(0, 5).map((token) => (
              <div
                key={token.address}
                onClick={() => onSelectToken(token)}
                className="p-2.5 rounded-xl bg-slate-950 border border-slate-800 hover:border-slate-700 cursor-pointer flex items-center justify-between text-xs transition"
              >
                <span className="font-semibold text-white truncate">{token.name} ({token.symbol})</span>
                <span className="text-emerald-400 font-mono font-bold">{token.risk.score}/100</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};
