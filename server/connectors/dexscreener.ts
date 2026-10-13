import { DataFreshness, OperationalMode } from '../types/index.js';

export interface RawDexPair {
  chainId: string;
  dexId: string;
  url: string;
  pairAddress: string;
  baseToken: {
    address: string;
    name: string;
    symbol: string;
  };
  quoteToken: {
    address: string;
    name: string;
    symbol: string;
  };
  priceNative: string;
  priceUsd: string;
  txns?: {
    m5?: { buys: number; sells: number };
    h1?: { buys: number; sells: number };
    h6?: { buys: number; sells: number };
    h24?: { buys: number; sells: number };
  };
  volume?: {
    h24?: number;
    h6?: number;
    h1?: number;
    m5?: number;
  };
  priceChange?: {
    m5?: number;
    h1?: number;
    h6?: number;
    h24?: number;
  };
  liquidity?: {
    usd?: number;
    base?: number;
    quote?: number;
  };
  fdv?: number;
  marketCap?: number;
  pairCreatedAt?: number;
}

interface CacheEntry<T> {
  data: T;
  cachedAt: number;
  freshness: DataFreshness;
}

export class DexScreenerConnector {
  private static instance: DexScreenerConnector;
  private cache: Map<string, CacheEntry<any>> = new Map();
  private cacheTtlMs = 15000; // 15 seconds cache
  private lastRequestTime = 0;
  private minIntervalMs = 300; // polite throttle (max ~3 req/s)
  private consecutiveErrors = 0;
  private lastSuccessfulFetch = 0;

  private constructor() {}

  public static getInstance(): DexScreenerConnector {
    if (!DexScreenerConnector.instance) {
      DexScreenerConnector.instance = new DexScreenerConnector();
    }
    return DexScreenerConnector.instance;
  }

  public getStatus(): { status: 'HEALTHY' | 'RATE_LIMITED' | 'DOWN' | 'CACHED'; lastSuccess: number; errorCount: number } {
    if (this.consecutiveErrors >= 5) {
      return { status: 'DOWN', lastSuccess: this.lastSuccessfulFetch, errorCount: this.consecutiveErrors };
    }
    if (this.consecutiveErrors > 0) {
      return { status: 'RATE_LIMITED', lastSuccess: this.lastSuccessfulFetch, errorCount: this.consecutiveErrors };
    }
    return { status: 'HEALTHY', lastSuccess: this.lastSuccessfulFetch, errorCount: 0 };
  }

  private async politeWait(): Promise<void> {
    const now = Date.now();
    const elapsed = now - this.lastRequestTime;
    if (elapsed < this.minIntervalMs) {
      await new Promise(resolve => setTimeout(resolve, this.minIntervalMs - elapsed));
    }
    this.lastRequestTime = Date.now();
  }

  public async fetchSolanaPairs(query = 'solana'): Promise<{ pairs: RawDexPair[]; freshness: DataFreshness }> {
    const cacheKey = `search_${query}`;
    const cached = this.cache.get(cacheKey);
    const now = Date.now();

    if (cached && now - cached.cachedAt < this.cacheTtlMs) {
      return { pairs: cached.data, freshness: 'FRESH' };
    }

    await this.politeWait();

    try {
      const url = `https://api.dexscreener.com/latest/dex/search?q=${encodeURIComponent(query)}`;
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 6000);

      const res = await fetch(url, {
        signal: controller.signal,
        headers: {
          'Accept': 'application/json',
          'User-Agent': 'SolanaSentinel/1.0',
        },
      });
      clearTimeout(timeoutId);

      if (res.status === 429) {
        this.consecutiveErrors++;
        if (cached) return { pairs: cached.data, freshness: 'STALE' };
        return { pairs: [], freshness: 'ERROR' };
      }

      if (!res.ok) {
        throw new Error(`DEX Screener HTTP ${res.status}`);
      }

      const json = await res.json() as { pairs?: RawDexPair[] };
      const rawPairs = json.pairs || [];
      const solPairs = rawPairs.filter(p => p.chainId === 'solana');

      this.consecutiveErrors = 0;
      this.lastSuccessfulFetch = Date.now();
      this.cache.set(cacheKey, { data: solPairs, cachedAt: Date.now(), freshness: 'FRESH' });

      return { pairs: solPairs, freshness: 'FRESH' };
    } catch (err) {
      this.consecutiveErrors++;
      if (cached) {
        return { pairs: cached.data, freshness: 'STALE' };
      }
      return { pairs: [], freshness: 'ERROR' };
    }
  }

  public async fetchTokensByAddress(addresses: string[]): Promise<{ pairs: RawDexPair[]; freshness: DataFreshness }> {
    if (addresses.length === 0) return { pairs: [], freshness: 'FRESH' };

    const batch = addresses.slice(0, 30).join(',');
    const cacheKey = `tokens_${batch}`;
    const cached = this.cache.get(cacheKey);
    const now = Date.now();

    if (cached && now - cached.cachedAt < this.cacheTtlMs) {
      return { pairs: cached.data, freshness: 'FRESH' };
    }

    await this.politeWait();

    try {
      const url = `https://api.dexscreener.com/latest/dex/tokens/${batch}`;
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 6000);

      const res = await fetch(url, {
        signal: controller.signal,
        headers: {
          'Accept': 'application/json',
          'User-Agent': 'SolanaSentinel/1.0',
        },
      });
      clearTimeout(timeoutId);

      if (!res.ok) {
        throw new Error(`DEX Screener HTTP ${res.status}`);
      }

      const json = await res.json() as { pairs?: RawDexPair[] };
      const solPairs = (json.pairs || []).filter(p => p.chainId === 'solana');

      this.consecutiveErrors = 0;
      this.lastSuccessfulFetch = Date.now();
      this.cache.set(cacheKey, { data: solPairs, cachedAt: Date.now(), freshness: 'FRESH' });

      return { pairs: solPairs, freshness: 'FRESH' };
    } catch {
      this.consecutiveErrors++;
      if (cached) return { pairs: cached.data, freshness: 'STALE' };
      return { pairs: [], freshness: 'ERROR' };
    }
  }
}
