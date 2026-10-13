import React, { useState } from 'react';
import {
  Search,
  Star,
  ShieldCheck,
  ShieldAlert,
  AlertTriangle,
  HelpCircle,
  XCircle,
  Eye,
  ShoppingCart,
  Dna,
  ArrowUpDown,
  Filter,
} from 'lucide-react';
import { RiskStatus, TokenIntelligence } from '../types';

interface ScannerTabProps {
  tokens: TokenIntelligence[];
  isAr: boolean;
  onSelectToken: (token: TokenIntelligence) => void;
  onToggleWatchlist: (address: string) => void;
  onQuickPaperBuy: (token: TokenIntelligence) => void;
}

export const ScannerTab: React.FC<ScannerTabProps> = ({
  tokens,
  isAr,
  onSelectToken,
  onToggleWatchlist,
  onQuickPaperBuy,
}) => {
  const [search, setSearch] = useState('');
  const [selectedRisk, setSelectedRisk] = useState<string>('ALL');
  const [selectedTag, setSelectedTag] = useState<string>('ALL');
  const [watchlistOnly, setWatchlistOnly] = useState(false);
  const [sortBy, setSortBy] = useState<'opportunity' | 'liquidity' | 'volume' | 'price' | 'risk'>('opportunity');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');

  // Filter tokens
  const filteredTokens = tokens.filter((token) => {
    if (search) {
      const q = search.toLowerCase();
      const match =
        token.symbol.toLowerCase().includes(q) ||
        token.name.toLowerCase().includes(q) ||
        token.address.toLowerCase().includes(q);
      if (!match) return false;
    }

    if (watchlistOnly && !token.isWatchlist) return false;

    if (selectedRisk !== 'ALL' && token.risk.status !== selectedRisk) return false;

    if (selectedTag === 'DeSci' && !token.scienceData?.isDeSci) return false;
    if (selectedTag === 'High-Liq' && token.liquidityUsd < 50000) return false;
    if (selectedTag === 'New' && (!token.pairCreatedAt || (Date.now() - token.pairCreatedAt) > 3600 * 1000 * 24)) return false;

    return true;
  });

  // Sort tokens
  filteredTokens.sort((a, b) => {
    const factor = sortOrder === 'asc' ? 1 : -1;
    if (sortBy === 'liquidity') return (a.liquidityUsd - b.liquidityUsd) * factor;
    if (sortBy === 'volume') return (a.volume24hUsd - b.volume24hUsd) * factor;
    if (sortBy === 'price') return (a.baseTokenPriceUsd - b.baseTokenPriceUsd) * factor;
    if (sortBy === 'risk') return (a.risk.score - b.risk.score) * factor;
    return (a.opportunity.overallScore - b.opportunity.overallScore) * factor;
  });

  const getRiskBadge = (status: RiskStatus) => {
    switch (status) {
      case 'PASS':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold font-mono bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
            <ShieldCheck className="w-3.5 h-3.5" />
            <span>PASS</span>
          </span>
        );
      case 'REVIEW':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold font-mono bg-amber-500/10 text-amber-400 border border-amber-500/20">
            <AlertTriangle className="w-3.5 h-3.5" />
            <span>REVIEW</span>
          </span>
        );
      case 'BLOCKED':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold font-mono bg-rose-500/10 text-rose-400 border border-rose-500/20">
            <XCircle className="w-3.5 h-3.5" />
            <span>BLOCKED</span>
          </span>
        );
      case 'UNKNOWN':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold font-mono bg-slate-500/10 text-slate-400 border border-slate-500/20">
            <HelpCircle className="w-3.5 h-3.5" />
            <span>UNKNOWN</span>
          </span>
        );
      case 'ERROR':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold font-mono bg-purple-500/10 text-purple-400 border border-purple-500/20">
            <ShieldAlert className="w-3.5 h-3.5" />
            <span>ERROR</span>
          </span>
        );
    }
  };

  return (
    <div className="space-y-5">
      {/* Search & Filter Header */}
      <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-4 space-y-3">
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
          {/* Search Box */}
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-slate-400 absolute right-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={isAr ? 'البحث بالاسم، الرمز، أو عنوان العقد...' : 'Search token name, symbol, or address...'}
              className="w-full pl-4 pr-10 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500"
            />
          </div>

          {/* Watchlist Toggle */}
          <button
            onClick={() => setWatchlistOnly(!watchlistOnly)}
            className={`px-3.5 py-2.5 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition border ${
              watchlistOnly
                ? 'bg-amber-500/20 border-amber-500/40 text-amber-300'
                : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-slate-200'
            }`}
          >
            <Star className={`w-3.5 h-3.5 ${watchlistOnly ? 'fill-amber-400 text-amber-400' : ''}`} />
            <span>{isAr ? 'قائمة المراقبة فقط' : 'Watchlist only'}</span>
          </button>
        </div>

        {/* Filter Pills */}
        <div className="flex flex-wrap items-center gap-2 pt-1 border-t border-slate-800/60">
          <span className="text-xs text-slate-500 flex items-center gap-1 mr-1">
            <Filter className="w-3 h-3" />
            <span>{isAr ? 'فلاتر الأمان:' : 'Risk:'}</span>
          </span>

          {['ALL', 'PASS', 'REVIEW', 'BLOCKED', 'UNKNOWN'].map((status) => (
            <button
              key={status}
              onClick={() => setSelectedRisk(status)}
              className={`px-2.5 py-1 rounded-lg text-xs font-mono font-medium transition ${
                selectedRisk === status
                  ? 'bg-indigo-600 text-white'
                  : 'bg-slate-950 text-slate-400 hover:bg-slate-800 hover:text-white border border-slate-800'
              }`}
            >
              {status}
            </button>
          ))}

          <span className="text-slate-700">|</span>

          {['ALL', 'DeSci', 'High-Liq', 'New'].map((t) => (
            <button
              key={t}
              onClick={() => setSelectedTag(t)}
              className={`px-2.5 py-1 rounded-lg text-xs font-medium transition ${
                selectedTag === t
                  ? 'bg-cyan-600 text-white'
                  : 'bg-slate-950 text-slate-400 hover:bg-slate-800 hover:text-white border border-slate-800'
              }`}
            >
              {t === 'DeSci' ? '🧬 DeSci Bio' : t}
            </button>
          ))}
        </div>
      </div>

      {/* Tokens Table */}
      <div className="rounded-2xl border border-slate-800 bg-slate-900/60 overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-right text-xs">
            <thead className="bg-slate-950/80 text-slate-400 font-medium border-b border-slate-800">
              <tr>
                <th className="py-3 px-4 text-center w-12">★</th>
                <th className="py-3 px-4">{isAr ? 'التوكن' : 'Token'}</th>
                <th
                  onClick={() => {
                    setSortBy('price');
                    setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
                  }}
                  className="py-3 px-4 cursor-pointer hover:text-white"
                >
                  <div className="flex items-center gap-1">
                    <span>{isAr ? 'السعر' : 'Price'}</span>
                    <ArrowUpDown className="w-3 h-3 text-slate-500" />
                  </div>
                </th>
                <th
                  onClick={() => {
                    setSortBy('liquidity');
                    setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
                  }}
                  className="py-3 px-4 cursor-pointer hover:text-white"
                >
                  <div className="flex items-center gap-1">
                    <span>{isAr ? 'السيولة' : 'Liquidity'}</span>
                    <ArrowUpDown className="w-3 h-3 text-slate-500" />
                  </div>
                </th>
                <th
                  onClick={() => {
                    setSortBy('volume');
                    setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
                  }}
                  className="py-3 px-4 cursor-pointer hover:text-white"
                >
                  <div className="flex items-center gap-1">
                    <span>{isAr ? 'الحجم 24س' : '24h Vol'}</span>
                    <ArrowUpDown className="w-3 h-3 text-slate-500" />
                  </div>
                </th>
                <th
                  onClick={() => {
                    setSortBy('opportunity');
                    setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
                  }}
                  className="py-3 px-4 cursor-pointer hover:text-white"
                >
                  <div className="flex items-center gap-1">
                    <span>{isAr ? 'درجة الفرصة' : 'Opp Score'}</span>
                    <ArrowUpDown className="w-3 h-3 text-slate-500" />
                  </div>
                </th>
                <th className="py-3 px-4">{isAr ? 'حالة المخاطر' : 'Risk'}</th>
                <th className="py-3 px-4 text-center">{isAr ? 'الإجراءات' : 'Actions'}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/80">
              {filteredTokens.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-slate-500">
                    {isAr ? 'لم يتم العثور على أزواج تطابق الفلاتر المحددة' : 'No tokens match the current filters'}
                  </td>
                </tr>
              ) : (
                filteredTokens.map((token) => (
                  <tr
                    key={token.address}
                    className="hover:bg-slate-800/40 transition group"
                  >
                    {/* Watchlist Star */}
                    <td className="py-3.5 px-4 text-center">
                      <button
                        onClick={() => onToggleWatchlist(token.address)}
                        className="text-slate-600 hover:text-amber-400 transition"
                      >
                        <Star className={`w-4 h-4 ${token.isWatchlist ? 'fill-amber-400 text-amber-400' : ''}`} />
                      </button>
                    </td>

                    {/* Token Info */}
                    <td className="py-3.5 px-4">
                      <div className="flex items-center gap-2.5">
                        <div className="w-8 h-8 rounded-lg bg-slate-800 border border-slate-700 font-mono font-bold text-xs text-indigo-300 flex items-center justify-center shrink-0">
                          {token.symbol.slice(0, 3)}
                        </div>
                        <div className="min-w-0">
                          <div className="flex items-center gap-1.5">
                            <span className="font-semibold text-white text-xs truncate">{token.name}</span>
                            <span className="text-[11px] font-mono text-slate-400 uppercase">{token.symbol}</span>
                            {token.scienceData?.isDeSci && (
                              <span className="px-1 py-0.2 rounded text-[10px] bg-teal-500/10 text-teal-300 border border-teal-500/20 font-mono">
                                DeSci
                              </span>
                            )}
                          </div>
                          <div className="text-[10px] font-mono text-slate-500 truncate max-w-[140px]">
                            {token.address.slice(0, 4)}...{token.address.slice(-4)}
                          </div>
                        </div>
                      </div>
                    </td>

                    {/* Price */}
                    <td className="py-3.5 px-4 font-mono font-medium text-slate-200">
                      ${token.baseTokenPriceUsd < 0.01 ? token.baseTokenPriceUsd.toFixed(6) : token.baseTokenPriceUsd.toFixed(4)}
                    </td>

                    {/* Liquidity */}
                    <td className="py-3.5 px-4 font-mono text-slate-300">
                      ${token.liquidityUsd.toLocaleString()}
                    </td>

                    {/* 24h Volume */}
                    <td className="py-3.5 px-4 font-mono text-slate-300">
                      ${token.volume24hUsd.toLocaleString()}
                    </td>

                    {/* Opportunity Score */}
                    <td className="py-3.5 px-4">
                      <div className="flex items-center gap-2">
                        <div className="w-12 bg-slate-800 rounded-full h-2 overflow-hidden">
                          <div
                            className="bg-cyan-400 h-2 rounded-full"
                            style={{ width: `${token.opportunity.overallScore}%` }}
                          />
                        </div>
                        <span className="font-bold font-mono text-cyan-300">
                          {token.opportunity.overallScore}
                        </span>
                      </div>
                    </td>

                    {/* Risk Status */}
                    <td className="py-3.5 px-4">
                      {getRiskBadge(token.risk.status)}
                    </td>

                    {/* Actions */}
                    <td className="py-3.5 px-4 text-center">
                      <div className="flex items-center justify-center gap-1.5">
                        <button
                          onClick={() => onSelectToken(token)}
                          className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition flex items-center gap-1 text-[11px] font-medium border border-slate-700"
                        >
                          <Eye className="w-3.5 h-3.5" />
                          <span>{isAr ? 'فحص' : 'Inspect'}</span>
                        </button>
                        <button
                          onClick={() => onQuickPaperBuy(token)}
                          disabled={token.risk.status === 'BLOCKED'}
                          className="px-2.5 py-1 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white transition flex items-center gap-1 text-[11px] font-medium disabled:opacity-40 disabled:hover:bg-indigo-600"
                          title={token.risk.status === 'BLOCKED' ? 'محظور بسبب مخالفة أمنية' : 'شراء افتراضي فوري'}
                        >
                          <ShoppingCart className="w-3.5 h-3.5" />
                          <span>{isAr ? 'شراء تجريبي' : 'Paper Buy'}</span>
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
