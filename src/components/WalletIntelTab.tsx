import React, { useState } from 'react';
import {
  Globe,
  Search,
  Coins,
  ShieldCheck,
  AlertCircle,
  ExternalLink,
  Layers,
} from 'lucide-react';
import { api } from '../services/api';

interface WalletIntelTabProps {
  isAr: boolean;
}

export const WalletIntelTab: React.FC<WalletIntelTabProps> = ({ isAr }) => {
  const [addressInput, setAddressInput] = useState('');
  const [walletData, setWalletData] = useState<any | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const sampleWallets = [
    { label: 'Raydium Protocol Authority', address: '5Q544fKrFoe6tsEbD7S8EmxGTJYAKtTVhAW5Q5pge4j1' },
    { label: 'Solana Foundation Stake', address: 'JUP6LkbZbjS1jKKwapdHNy74zcZ3tLUZoi5QNyVTaV4' },
    { label: 'Pump.fun Protocol Vault', address: '6EF8rrecthR5Dkzon8Nwu78hRvfCKubJ14M5uBEwF6P' },
  ];

  const handleAnalyze = async (addrToInspect?: string) => {
    const target = addrToInspect || addressInput.trim();
    if (!target) return;
    setLoading(true);
    setError(null);
    try {
      const data = await api.analyzeWallet(target);
      setWalletData(data);
    } catch (err: any) {
      setError(err.message || 'Failed to inspect wallet');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Intro Header */}
      <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-5">
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-xl bg-cyan-500/10 text-cyan-400 border border-cyan-500/20 flex items-center justify-center shrink-0">
            <Globe className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-sm font-bold text-white uppercase tracking-wider">
              {isAr ? 'استخبارات المحافظ العامة (Solana Public Wallet Intelligence)' : 'Public Wallet Intelligence'}
            </h2>
            <p className="text-xs text-slate-300 leading-relaxed mt-1">
              {isAr
                ? 'فحص استقصائي للمحافظ العامة عبر Solana RPC المباشر. قراءة مؤكدة للأرصدة وسجلات المعاملات دون أي ادعاء بمعرفة هوية أصحابها أو تتبع خاص.'
                : 'Audits public Solana addresses via read-only RPC. Discloses verifiable balances and transaction counts without fabricating human identities.'}
            </p>
          </div>
        </div>
      </div>

      {/* Search Input Bar */}
      <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-5 space-y-4">
        <div className="flex flex-col sm:flex-row gap-2">
          <div className="relative flex-1">
            <input
              type="text"
              value={addressInput}
              onChange={(e) => setAddressInput(e.target.value)}
              placeholder={isAr ? 'أدخل عنوان محفظة Solana عام (Base58)...' : 'Enter public Solana wallet address (Base58)...'}
              className="w-full px-4 py-3 rounded-xl bg-slate-950 border border-slate-800 text-xs font-mono text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500"
            />
          </div>
          <button
            onClick={() => handleAnalyze()}
            disabled={loading || !addressInput.trim()}
            className="px-5 py-3 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs transition flex items-center justify-center gap-1.5 disabled:opacity-40"
          >
            <Search className="w-4 h-4" />
            <span>{loading ? (isAr ? 'جاري الفحص...' : 'Auditing...') : (isAr ? 'فحص المحفظة' : 'Audit Wallet')}</span>
          </button>
        </div>

        {/* Quick Sample Chips */}
        <div className="flex flex-wrap items-center gap-2 pt-1 text-xs text-slate-400">
          <span>{isAr ? 'عناوين عامة سريعة:' : 'Quick samples:'}</span>
          {sampleWallets.map((w, idx) => (
            <button
              key={idx}
              onClick={() => {
                setAddressInput(w.address);
                handleAnalyze(w.address);
              }}
              className="px-2.5 py-1 rounded-lg bg-slate-950 hover:bg-slate-800 text-slate-300 hover:text-white border border-slate-800 transition text-[11px]"
            >
              {w.label}
            </button>
          ))}
        </div>
      </div>

      {error && (
        <div className="p-4 rounded-xl bg-rose-950/20 border border-rose-500/30 text-xs text-rose-300 flex items-center gap-2">
          <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Results View */}
      {walletData && (
        <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-5 space-y-5">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 border-b border-slate-800 pb-4">
            <div>
              <div className="text-xs text-slate-400">{isAr ? 'العنوان المفحوص' : 'Audited Address'}</div>
              <div className="font-mono text-white font-bold text-xs sm:text-sm select-all mt-0.5">
                {walletData.address}
              </div>
            </div>
            <a
              href={`https://solscan.io/account/${walletData.address}`}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1 text-xs text-indigo-400 hover:text-indigo-300 font-medium"
            >
              <span>{isAr ? 'عرض في Solscan' : 'View on Solscan'}</span>
              <ExternalLink className="w-3.5 h-3.5" />
            </a>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="p-4 rounded-xl bg-slate-950 border border-slate-800">
              <div className="text-[11px] text-slate-400">{isAr ? 'رصيد SOL الأصلي' : 'Native SOL Balance'}</div>
              <div className="text-xl font-bold font-mono text-cyan-400 mt-1">
                {walletData.solBalance?.toFixed(4)} SOL
              </div>
            </div>

            <div className="p-4 rounded-xl bg-slate-950 border border-slate-800">
              <div className="text-[11px] text-slate-400">{isAr ? 'المعاملات المرصودة مؤخراً' : 'Recent Signatures'}</div>
              <div className="text-xl font-bold font-mono text-white mt-1">
                {walletData.recentTxCount || 0}
              </div>
            </div>

            <div className="p-4 rounded-xl bg-slate-950 border border-slate-800">
              <div className="text-[11px] text-slate-400">{isAr ? 'حسابات التوكنات النشطة' : 'Active SPL Token Accounts'}</div>
              <div className="text-xl font-bold font-mono text-indigo-300 mt-1">
                {walletData.tokenHoldings?.length || 0}
              </div>
            </div>
          </div>

          {/* Token Holdings Table */}
          {walletData.tokenHoldings && walletData.tokenHoldings.length > 0 && (
            <div className="space-y-2">
              <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider">
                {isAr ? 'أرصدة رموز SPL المملوكة' : 'SPL Token Holdings'}
              </h4>

              <div className="overflow-x-auto">
                <table className="w-full text-right text-xs font-mono">
                  <thead className="text-slate-400 border-b border-slate-800 pb-2">
                    <tr>
                      <th className="py-2 px-3">{isAr ? 'عنوان التوكن' : 'Mint Address'}</th>
                      <th className="py-2 px-3">{isAr ? 'الكمية' : 'Amount'}</th>
                      <th className="py-2 px-3">{isAr ? 'الدقة' : 'Decimals'}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60">
                    {walletData.tokenHoldings.map((h: any, idx: number) => (
                      <tr key={idx} className="hover:bg-slate-800/20">
                        <td className="py-2.5 px-3 text-slate-300 select-all truncate max-w-xs">{h.mint}</td>
                        <td className="py-2.5 px-3 text-cyan-300 font-bold">{h.amount.toLocaleString()}</td>
                        <td className="py-2.5 px-3 text-slate-400">{h.decimals}</td>
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
  );
};
