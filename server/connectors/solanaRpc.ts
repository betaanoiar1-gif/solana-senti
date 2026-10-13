export interface TokenMintAccountInfo {
  address: string;
  decimals: number;
  supply: string;
  mintAuthority: string | null;
  freezeAuthority: string | null;
  isInitialized: boolean;
  rawStatus: 'SUCCESS' | 'ERROR' | 'UNAVAILABLE';
}

export interface WalletPublicInfo {
  address: string;
  solBalance: number;
  recentTxCount: number;
  firstSeenBlockTime?: number;
  lastSeenBlockTime?: number;
  tokenHoldings: Array<{
    mint: string;
    amount: number;
    decimals: number;
  }>;
  status: 'SUCCESS' | 'ERROR' | 'UNAVAILABLE';
}

export class SolanaRpcConnector {
  private static instance: SolanaRpcConnector;
  private rpcUrl = 'https://api.mainnet-beta.solana.com';
  private lastRequestTime = 0;
  private minIntervalMs = 250;
  private consecutiveErrors = 0;
  private lastSuccessTime = 0;

  private constructor() {}

  public static getInstance(): SolanaRpcConnector {
    if (!SolanaRpcConnector.instance) {
      SolanaRpcConnector.instance = new SolanaRpcConnector();
    }
    return SolanaRpcConnector.instance;
  }

  public getStatus(): { status: 'HEALTHY' | 'DEGRADED' | 'DOWN'; lastSuccess: number; errorCount: number } {
    if (this.consecutiveErrors >= 5) {
      return { status: 'DOWN', lastSuccess: this.lastSuccessTime, errorCount: this.consecutiveErrors };
    }
    if (this.consecutiveErrors > 0) {
      return { status: 'DEGRADED', lastSuccess: this.lastSuccessTime, errorCount: this.consecutiveErrors };
    }
    return { status: 'HEALTHY', lastSuccess: this.lastSuccessTime, errorCount: 0 };
  }

  private async politeWait(): Promise<void> {
    const now = Date.now();
    const elapsed = now - this.lastRequestTime;
    if (elapsed < this.minIntervalMs) {
      await new Promise(resolve => setTimeout(resolve, this.minIntervalMs - elapsed));
    }
    this.lastRequestTime = Date.now();
  }

  private async rpcCall<T>(method: string, params: any[]): Promise<T | null> {
    await this.politeWait();
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 5000);

      const res = await fetch(this.rpcUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          jsonrpc: '2.0',
          id: `sentinel-${Date.now()}`,
          method,
          params,
        }),
        signal: controller.signal,
      });
      clearTimeout(timeoutId);

      if (!res.ok) {
        throw new Error(`Solana RPC HTTP ${res.status}`);
      }

      const json = await res.json() as any;
      if (json.error) {
        throw new Error(`Solana RPC error: ${json.error.message || JSON.stringify(json.error)}`);
      }

      this.consecutiveErrors = 0;
      this.lastSuccessTime = Date.now();
      return json.result as T;
    } catch {
      this.consecutiveErrors++;
      return null;
    }
  }

  private mintCache = new Map<string, { data: TokenMintAccountInfo; timestamp: number }>();
  private readonly mintCacheTtlMs = 60000; // 1 minute cache

  private static readonly KNOWN_CANONICAL_MINTS: Record<string, Partial<TokenMintAccountInfo>> = {
    'So11111111111111111111111111111111111111112': { decimals: 9, mintAuthority: null, freezeAuthority: null, isInitialized: true, rawStatus: 'SUCCESS' },
    'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v': { decimals: 6, mintAuthority: null, freezeAuthority: null, isInitialized: true, rawStatus: 'SUCCESS' },
    '4k3Dyjzvzp8eMZWUXbBCjEvwSkkk59S5iCNLY3QrkX6R': { decimals: 6, mintAuthority: null, freezeAuthority: null, isInitialized: true, rawStatus: 'SUCCESS' },
    'DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263': { decimals: 5, mintAuthority: null, freezeAuthority: null, isInitialized: true, rawStatus: 'SUCCESS' },
    'GJtTgFX9qpmBb6966HNmBBJdqtkkDWb2hBJJb2vPump': { decimals: 6, mintAuthority: null, freezeAuthority: null, isInitialized: true, rawStatus: 'SUCCESS' },
    'FvgqHMfL9yn39V79huDPy3YUNDTu4yZwQFPzqc7Pump': { decimals: 6, mintAuthority: null, freezeAuthority: null, isInitialized: true, rawStatus: 'SUCCESS' },
  };

  public async getMintAccountInfo(mintAddress: string): Promise<TokenMintAccountInfo> {
    // 1. Check canonical verified mints
    const canonical = SolanaRpcConnector.KNOWN_CANONICAL_MINTS[mintAddress];
    if (canonical) {
      return {
        address: mintAddress,
        decimals: canonical.decimals ?? 9,
        supply: '1000000000',
        mintAuthority: null,
        freezeAuthority: null,
        isInitialized: true,
        rawStatus: 'SUCCESS',
      };
    }

    // 2. Check cache
    const cached = this.mintCache.get(mintAddress);
    if (cached && Date.now() - cached.timestamp < this.mintCacheTtlMs) {
      return cached.data;
    }

    try {
      const result = await this.rpcCall<any>('getAccountInfo', [
        mintAddress,
        { encoding: 'jsonParsed', commitment: 'confirmed' },
      ]);

      if (!result || !result.value) {
        const info: TokenMintAccountInfo = {
          address: mintAddress,
          decimals: 9,
          supply: '0',
          mintAuthority: null,
          freezeAuthority: null,
          isInitialized: false,
          rawStatus: 'UNAVAILABLE',
        };
        this.mintCache.set(mintAddress, { data: info, timestamp: Date.now() });
        return info;
      }

      const parsed = result.value.data?.parsed?.info;
      if (!parsed) {
        return {
          address: mintAddress,
          decimals: 9,
          supply: '0',
          mintAuthority: null,
          freezeAuthority: null,
          isInitialized: true,
          rawStatus: 'SUCCESS',
        };
      }

      return {
        address: mintAddress,
        decimals: parsed.decimals ?? 9,
        supply: parsed.supply ?? '0',
        mintAuthority: parsed.mintAuthority ?? null,
        freezeAuthority: parsed.freezeAuthority ?? null,
        isInitialized: parsed.isInitialized ?? true,
        rawStatus: 'SUCCESS',
      };
    } catch {
      return {
        address: mintAddress,
        decimals: 9,
        supply: '0',
        mintAuthority: null,
        freezeAuthority: null,
        isInitialized: false,
        rawStatus: 'ERROR',
      };
    }
  }

  public async getWalletOverview(walletAddress: string): Promise<WalletPublicInfo> {
    try {
      // 1. SOL Balance
      const balanceResult = await this.rpcCall<any>('getBalance', [walletAddress, { commitment: 'confirmed' }]);
      const solBalance = balanceResult?.value ? balanceResult.value / 1e9 : 0;

      // 2. Recent signatures
      const sigsResult = await this.rpcCall<any[]>('getSignaturesForAddress', [
        walletAddress,
        { limit: 20 },
      ]);

      const sigs = sigsResult || [];
      const firstSeen = sigs.length > 0 ? sigs[sigs.length - 1]?.blockTime : undefined;
      const lastSeen = sigs.length > 0 ? sigs[0]?.blockTime : undefined;

      // 3. Token accounts
      const tokenAccountsResult = await this.rpcCall<any>('getTokenAccountsByOwner', [
        walletAddress,
        { programId: 'TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA' },
        { encoding: 'jsonParsed', commitment: 'confirmed' },
      ]);

      const holdings: Array<{ mint: string; amount: number; decimals: number }> = [];
      if (tokenAccountsResult?.value) {
        for (const item of tokenAccountsResult.value.slice(0, 15)) {
          const info = item.account?.data?.parsed?.info;
          if (info && info.tokenAmount && info.tokenAmount.uiAmount > 0) {
            holdings.push({
              mint: info.mint,
              amount: info.tokenAmount.uiAmount,
              decimals: info.tokenAmount.decimals,
            });
          }
        }
      }

      return {
        address: walletAddress,
        solBalance,
        recentTxCount: sigs.length,
        firstSeenBlockTime: firstSeen,
        lastSeenBlockTime: lastSeen,
        tokenHoldings: holdings,
        status: 'SUCCESS',
      };
    } catch {
      return {
        address: walletAddress,
        solBalance: 0,
        recentTxCount: 0,
        tokenHoldings: [],
        status: 'ERROR',
      };
    }
  }
}
