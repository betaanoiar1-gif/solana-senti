import {
  AlertNotification,
  BacktestResult,
  SentinelSettings,
  StrategyConfig,
  SystemHealthStatus,
  TokenIntelligence,
} from '../types';

export const api = {
  async getHealth(): Promise<SystemHealthStatus> {
    const res = await fetch('/api/health');
    if (!res.ok) throw new Error('Failed to fetch health');
    return res.json();
  },

  async getMarketOverview(): Promise<any> {
    const res = await fetch('/api/market/overview');
    if (!res.ok) throw new Error('Failed to fetch market overview');
    return res.json();
  },

  async getTokens(params: Record<string, any> = {}): Promise<{ total: number; tokens: TokenIntelligence[] }> {
    const query = new URLSearchParams();
    for (const [key, val] of Object.entries(params)) {
      if (val !== undefined && val !== null && val !== '') {
        query.append(key, String(val));
      }
    }
    const res = await fetch(`/api/tokens?${query.toString()}`);
    if (!res.ok) throw new Error('Failed to fetch tokens');
    return res.json();
  },

  async getToken(address: string): Promise<TokenIntelligence> {
    const res = await fetch(`/api/tokens/${address}`);
    if (!res.ok) throw new Error('Failed to fetch token details');
    return res.json();
  },

  async toggleWatchlist(address: string): Promise<{ isWatchlist: boolean }> {
    const res = await fetch(`/api/tokens/${address}/watchlist`, { method: 'POST' });
    if (!res.ok) throw new Error('Failed to toggle watchlist');
    return res.json();
  },

  async getPortfolio(): Promise<any> {
    const res = await fetch('/api/portfolio');
    if (!res.ok) throw new Error('Failed to fetch portfolio');
    return res.json();
  },

  async executePaperOrder(order: any): Promise<any> {
    const res = await fetch('/api/paper-trading/order', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(order),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Failed to execute paper order');
    return data;
  },

  async closePosition(tokenAddress: string): Promise<any> {
    const res = await fetch('/api/paper-trading/close-position', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tokenAddress }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Failed to close position');
    return data;
  },

  async resetPortfolio(): Promise<any> {
    const res = await fetch('/api/paper-trading/reset', { method: 'POST' });
    return res.json();
  },

  async analyzeWallet(address: string): Promise<any> {
    const res = await fetch(`/api/wallets/analyze?address=${encodeURIComponent(address)}`);
    if (!res.ok) throw new Error('Failed to analyze wallet');
    return res.json();
  },

  async getStrategies(): Promise<StrategyConfig[]> {
    const res = await fetch('/api/strategies');
    if (!res.ok) throw new Error('Failed to fetch strategies');
    return res.json();
  },

  async runBacktest(strategyId: string, initialCapitalUsd = 10000): Promise<BacktestResult> {
    const res = await fetch('/api/backtests/run', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ strategyId, initialCapitalUsd }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Failed to run backtest');
    return data;
  },

  async getBacktests(): Promise<BacktestResult[]> {
    const res = await fetch('/api/backtests/history');
    if (!res.ok) throw new Error('Failed to fetch backtest history');
    return res.json();
  },

  async getAlerts(): Promise<AlertNotification[]> {
    const res = await fetch('/api/alerts');
    if (!res.ok) throw new Error('Failed to fetch alerts');
    return res.json();
  },

  async markAlertAsRead(id: string): Promise<void> {
    await fetch(`/api/alerts/${id}/read`, { method: 'POST' });
  },

  async clearAlerts(): Promise<void> {
    await fetch('/api/alerts/clear', { method: 'POST' });
  },

  async getSettings(): Promise<SentinelSettings> {
    const res = await fetch('/api/settings');
    if (!res.ok) throw new Error('Failed to fetch settings');
    return res.json();
  },

  async updateSettings(settings: Partial<SentinelSettings>): Promise<SentinelSettings> {
    const res = await fetch('/api/settings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(settings),
    });
    if (!res.ok) throw new Error('Failed to update settings');
    return res.json();
  },

  async triggerSync(): Promise<any> {
    const res = await fetch('/api/market/sync', { method: 'POST' });
    return res.json();
  },

  async getPipelineStatus(): Promise<any> {
    const res = await fetch('/api/market/pipeline-status');
    if (!res.ok) throw new Error('Failed to fetch pipeline status');
    return res.json();
  },
};
