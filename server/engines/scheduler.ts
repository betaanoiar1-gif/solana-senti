import { DatabaseManager } from '../db/database.js';
import { DexScreenerConnector, RawDexPair } from '../connectors/dexscreener.js';
import { SolanaRpcConnector, TokenMintAccountInfo } from '../connectors/solanaRpc.js';
import { ScienceConnector } from '../connectors/science.js';
import { RiskEngine } from './riskEngine.js';
import { OpportunityEngine } from './opportunityEngine.js';
import { PaperTradingEngine } from './paperTrading.js';
import {
  MarketPipelineStatus,
  MarketSnapshot,
  TokenIntelligence,
} from '../types/index.js';

export class MarketScheduler {
  private static instance: MarketScheduler;
  private db: DatabaseManager;
  private dexScreener: DexScreenerConnector;
  private rpc: SolanaRpcConnector;
  private science: ScienceConnector;
  private paperTrading: PaperTradingEngine;

  private isRunning = false;
  private timer: NodeJS.Timeout | null = null;
  private isProcessing = false;
  private lastRunAt = 0;
  private totalCycles = 0;

  private pipelineStatus: MarketPipelineStatus = {
    stage: 'IDLE',
    stageMessage: 'System ready. Waiting for initial market cycle.',
    stageMessageAr: 'النظام جاهز. بانتظار بدء دورة السوق الأولى.',
    sourceStatus: 'HEALTHY',
    lastFetchAttemptAt: 0,
    lastSuccessfulFetchAt: 0,
    pairsReceivedCount: 0,
    pairsNormalizedCount: 0,
    pairsQualifiedCount: 0,
    pairsBlockedCount: 0,
    pairsUnderReviewCount: 0,
    rpcEnrichedCount: 0,
  };

  private constructor() {
    this.db = DatabaseManager.getInstance();
    this.dexScreener = DexScreenerConnector.getInstance();
    this.rpc = SolanaRpcConnector.getInstance();
    this.science = ScienceConnector.getInstance();
    this.paperTrading = new PaperTradingEngine();
  }

  public static getInstance(): MarketScheduler {
    if (!MarketScheduler.instance) {
      MarketScheduler.instance = new MarketScheduler();
    }
    return MarketScheduler.instance;
  }

  public getPipelineStatus(): MarketPipelineStatus {
    return { ...this.pipelineStatus };
  }

  public start(intervalSeconds = 20): void {
    if (this.isRunning) return;
    this.isRunning = true;
    console.log(`[MarketScheduler] Started with interval: ${intervalSeconds}s`);

    // Run immediately once, then set interval
    this.syncMarketCycle().catch(console.error);

    this.timer = setInterval(() => {
      this.syncMarketCycle().catch(console.error);
    }, intervalSeconds * 1000);
  }

  public stop(): void {
    this.isRunning = false;
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
    console.log('[MarketScheduler] Stopped.');
  }

  public getStatus(): { isRunning: boolean; isProcessing: boolean; lastRunAt: number; totalCycles: number } {
    return {
      isRunning: this.isRunning,
      isProcessing: this.isProcessing,
      lastRunAt: this.lastRunAt,
      totalCycles: this.totalCycles,
    };
  }

  public async syncMarketCycle(): Promise<void> {
    if (this.isProcessing) return;
    this.isProcessing = true;
    this.lastRunAt = Date.now();
    this.totalCycles++;
    this.pipelineStatus.lastFetchAttemptAt = this.lastRunAt;

    try {
      // 1. Stage: CONNECTING
      this.pipelineStatus.stage = 'CONNECTING';
      this.pipelineStatus.stageMessage = 'Connecting to market data feed...';
      this.pipelineStatus.stageMessageAr = 'جاري الاتصال بمصدر بيانات السوق...';

      // 2. Stage: FETCHING_MARKET
      this.pipelineStatus.stage = 'FETCHING_MARKET';
      this.pipelineStatus.stageMessage = 'Fetching live Solana trading pairs from DEX Screener...';
      this.pipelineStatus.stageMessageAr = 'جاري جلب أزواج تداول شبكة Solana الحية من DEX Screener...';

      const discoveryQueries = ['raydium', 'pump', 'solana', 'bonk', 'rif', 'uro'];
      const pairsMap = new Map<string, RawDexPair>();
      let overallFreshness: any = 'FRESH';
      let hadRateLimit = false;

      for (const q of discoveryQueries) {
        const { pairs: fetchedPairs, freshness } = await this.dexScreener.fetchSolanaPairs(q);
        if (freshness === 'RATE_LIMITED') hadRateLimit = true;
        if (freshness === 'STALE' || freshness === 'ERROR') {
          overallFreshness = freshness;
        }
        for (const p of fetchedPairs) {
          if (p.chainId === 'solana' && p.pairAddress && !pairsMap.has(p.pairAddress)) {
            pairsMap.set(p.pairAddress, p);
          }
        }
      }

      const dexStatus = this.dexScreener.getStatus();
      this.pipelineStatus.sourceStatus = dexStatus.status as any;

      if (hadRateLimit) {
        this.pipelineStatus.stage = 'RATE_LIMITED';
        this.pipelineStatus.stageMessage = 'Rate limit encountered on market source. Operating on cached pairs.';
        this.pipelineStatus.stageMessageAr = 'تم تجاوز حد الطلبات في مصدر السوق. يعمل النظام على الأزواج المحفوظة.';
      }

      const pairs = Array.from(pairsMap.values());
      this.pipelineStatus.pairsReceivedCount = pairs.length;

      if (pairs.length === 0) {
        if (hadRateLimit) {
          this.pipelineStatus.stage = 'RATE_LIMITED';
        } else if (dexStatus.status === 'DOWN') {
          this.pipelineStatus.stage = 'SOURCE_UNAVAILABLE';
          this.pipelineStatus.stageMessage = 'Market source unavailable. Connection retry scheduled.';
          this.pipelineStatus.stageMessageAr = 'مصدر بيانات السوق غير متاح حالياً. مجدول إعادة المحاولة.';
        } else {
          this.pipelineStatus.stage = 'NO_VALID_PAIRS';
          this.pipelineStatus.stageMessage = 'No valid Solana pairs found matching active market conditions.';
          this.pipelineStatus.stageMessageAr = 'لم يتم العثور على أزواج صالحة لشبكة Solana في هذه الدورة.';
        }
        this.isProcessing = false;
        return;
      }

      // 3. Stage: DATA_RECEIVED
      this.pipelineStatus.stage = 'DATA_RECEIVED';
      this.pipelineStatus.stageMessage = `Received ${pairs.length} Solana pairs. Normalizing and storing...`;
      this.pipelineStatus.stageMessageAr = `تم استلام ${pairs.length} زوج تداول لشبكة Solana. جاري التطبيع والحفظ...`;

      // 4. Stage: ANALYZING_PAIRS
      this.pipelineStatus.stage = 'ANALYZING_PAIRS';
      this.pipelineStatus.stageMessage = 'Auditing risk rules, mint authorities, and opportunity scores...';
      this.pipelineStatus.stageMessageAr = 'جاري تدقيق المخاطر وفحص سلطات الصك وحساب مؤشرات الفرص...';

      let normalizedCount = 0;
      let qualifiedCount = 0;
      let blockedCount = 0;
      let reviewCount = 0;
      let rpcCount = 0;
      const disqualificationReasons: string[] = [];
      const disqualificationReasonsAr: string[] = [];

      // Sort by highest liquidity & volume first to prioritize high-conviction pairs
      pairs.sort((a, b) => {
        const liqA = a.liquidity?.usd || 0;
        const liqB = b.liquidity?.usd || 0;
        return liqB - liqA;
      });

      for (const pair of pairs.slice(0, 45)) {
        const result = await this.processPair(pair, overallFreshness);
        if (result) {
          normalizedCount++;
          if (result.risk.status === 'PASS') {
            qualifiedCount++;
          } else if (result.risk.status === 'REVIEW') {
            reviewCount++;
            if (result.opportunity.overallScore >= 60) {
              qualifiedCount++;
            }
          } else if (result.risk.status === 'BLOCKED') {
            blockedCount++;
            disqualificationReasons.push(`${result.symbol}: ${result.risk.summary}`);
            disqualificationReasonsAr.push(`${result.symbol}: ${result.risk.summary}`);
          }

          if (result.risk.evaluations.some(e => e.ruleId === 'MINT_AUTHORITY_REVOCATION' && e.passed)) {
            rpcCount++;
          }
        }
      }

      // 5. Update paper trading positions with fresh prices & check stop losses
      const settings = this.db.getSettings();
      const solPriceUsd = settings.solPriceUsd;
      const allTokens = this.db.getAllTokens();
      for (const token of allTokens) {
        if (token.baseTokenPriceUsd > 0) {
          this.db.updatePositionPrice(token.address, token.baseTokenPriceUsd);
        }
      }

      this.paperTrading.checkAutomatedStops(solPriceUsd);

      // 6. Stage: COMPLETED
      this.pipelineStatus.stage = 'COMPLETED';
      this.pipelineStatus.lastSuccessfulFetchAt = Date.now();
      this.pipelineStatus.pairsNormalizedCount = normalizedCount;
      this.pipelineStatus.pairsQualifiedCount = qualifiedCount;
      this.pipelineStatus.pairsBlockedCount = blockedCount;
      this.pipelineStatus.pairsUnderReviewCount = reviewCount;
      this.pipelineStatus.rpcEnrichedCount = rpcCount;
      this.pipelineStatus.stageMessage = `Market cycle completed successfully: ${qualifiedCount} pairs qualified (${reviewCount} under review, ${blockedCount} blocked).`;
      this.pipelineStatus.stageMessageAr = `اكتملت دورة السوق بنجاح: تم تأهيل ${qualifiedCount} زوج (${reviewCount} قيد المراجعة، ${blockedCount} محظور أمنياً).`;
      if (disqualificationReasons.length > 0) {
        this.pipelineStatus.disqualificationReason = disqualificationReasons.slice(0, 3).join(' | ');
        this.pipelineStatus.disqualificationReasonAr = disqualificationReasonsAr.slice(0, 3).join(' | ');
      }
    } catch (err: any) {
      console.error('[MarketScheduler] Cycle error:', err);
      this.pipelineStatus.stage = 'ANALYSIS_ERROR';
      this.pipelineStatus.stageMessage = `Market analysis encountered an error: ${err?.message || 'Unknown error'}`;
      this.pipelineStatus.stageMessageAr = `حدث خطأ أثناء تحليل دورة السوق: ${err?.message || 'خطأ غير معروف'}`;
      this.pipelineStatus.lastError = err?.message || String(err);
    } finally {
      this.isProcessing = false;
    }
  }

  public async processPair(pair: RawDexPair, freshness: any): Promise<TokenIntelligence | null> {
    try {
      const address = pair.baseToken?.address;
      if (!address || typeof address !== 'string' || address.length < 32) {
        return null;
      }

      const symbol = pair.baseToken.symbol || 'UNKNOWN';
      const name = pair.baseToken.name || symbol;
      const priceUsd = Number(pair.priceUsd) || 0;
      const liquidityUsd = pair.liquidity?.usd || 0;
      const volume24hUsd = pair.volume?.h24 || 0;
      const volume1hUsd = pair.volume?.h1;
      const priceChange1h = pair.priceChange?.h1;
      const priceChange24h = pair.priceChange?.h24;
      const txnsBuys24h = pair.txns?.h24?.buys || 0;
      const txnsSells24h = pair.txns?.h24?.sells || 0;
      const now = Date.now();

      // Check existing token
      const existing = this.db.getToken(address);
      const firstSeenAt = existing ? existing.firstSeenAt : now;
      const isWatchlist = existing ? existing.isWatchlist : false;
      const previousSnapshots = existing ? existing.snapshots : [];

      // RPC Mint Check (cached or queried for high-value pairs)
      let mintInfo: TokenMintAccountInfo | undefined = undefined;
      if (liquidityUsd >= 5000) {
        mintInfo = await this.rpc.getMintAccountInfo(address);
      }

      // Science DeSci profile
      const scienceProfile = this.science.identifyDeSciToken(symbol, name);

      // Evaluate Risk
      const risk = RiskEngine.evaluate({
        address,
        symbol,
        liquidityUsd,
        volume24hUsd,
        priceUsd,
        pairCreatedAt: pair.pairCreatedAt,
        mintInfo,
        snapshots: previousSnapshots,
        freshness,
      });

      // Evaluate Opportunity
      const opportunity = OpportunityEngine.evaluate({
        address,
        symbol,
        name,
        priceUsd,
        liquidityUsd,
        volume24hUsd,
        volume1hUsd,
        priceChange1h,
        priceChange24h,
        txnsBuys24h,
        txnsSells24h,
        pairCreatedAt: pair.pairCreatedAt,
        snapshots: previousSnapshots,
        scienceData: scienceProfile || undefined,
        freshness,
      });

      // Tags
      const tags: string[] = [];
      if (scienceProfile?.isDeSci) tags.push('DeSci', 'Pump.science', 'Bio');
      if (liquidityUsd > 100000) tags.push('High-Liquidity');
      if (volume24hUsd > 500000) tags.push('Top-Volume');
      if (pair.pairCreatedAt && (now - pair.pairCreatedAt) < 3600 * 1000 * 12) tags.push('New-Pair');
      if (risk.status === 'PASS' && opportunity.overallScore >= 75) tags.push('Prime-Opportunity');

      // Determine Lifecycle Stage
      let lifecycleStage = existing ? existing.lifecycleStage : 'DISCOVERED';
      if (isWatchlist) {
        lifecycleStage = 'WATCHLIST';
      } else if (risk.status === 'BLOCKED') {
        lifecycleStage = 'REJECTED';
      } else if ((risk.status === 'PASS' || risk.status === 'REVIEW') && opportunity.overallScore >= 60) {
        lifecycleStage = 'QUALIFIED';
      } else if (existing) {
        lifecycleStage = 'MONITORING';
      }

      const tokenIntel: TokenIntelligence = {
        address,
        symbol,
        name,
        decimals: mintInfo?.decimals || 9,
        pairAddress: pair.pairAddress,
        dexId: pair.dexId,
        baseTokenPriceUsd: priceUsd,
        liquidityUsd,
        fdvUsd: pair.fdv,
        marketCapUsd: pair.marketCap,
        volume24hUsd,
        pairCreatedAt: pair.pairCreatedAt,
        firstSeenAt,
        lastSeenAt: now,
        lifecycleStage,
        isWatchlist,
        tags,
        risk,
        opportunity,
        snapshots: previousSnapshots,
        scienceData: scienceProfile || undefined,
        freshness,
      };

      this.db.upsertToken(tokenIntel);

      // Record snapshot
      const snapshot: MarketSnapshot = {
        tokenAddress: address,
        timestamp: now,
        priceUsd,
        liquidityUsd,
        volume24hUsd,
        volume1hUsd,
        priceChange5m: pair.priceChange?.m5,
        priceChange1h,
        priceChange24h,
        txns24hBuys: txnsBuys24h,
        txns24hSells: txnsSells24h,
        mode: 'LIVE',
      };
      this.db.recordSnapshot(snapshot);

      // Trigger Alerts for new discovery or high score
      if (!existing) {
        this.db.addAlert({
          type: 'DISCOVERY',
          title: `اكتشاف زوج جديد: ${symbol} (${name})`,
          message: `تم رصد زوج جديد على ${pair.dexId || 'Raydium'} بسيولة $${liquidityUsd.toLocaleString()} وسعر $${priceUsd.toFixed(6)}`,
          severity: 'INFO',
          tokenAddress: address,
        });
      } else if (opportunity.overallScore >= 80 && existing.opportunity.overallScore < 80) {
        this.db.addAlert({
          type: 'OPPORTUNITY_SPIKE',
          title: `ارتفاع قياسي في تقييم الفرصة: ${symbol} (${opportunity.overallScore}/100)`,
          message: `قفز مؤشر الفرصة إلى ${opportunity.overallScore} مدفوعاً بـ ${opportunity.positiveDrivers.slice(0, 2).join(' و ')}`,
          severity: 'SUCCESS',
          tokenAddress: address,
        });
      }

      return tokenIntel;
    } catch (err) {
      console.error('[MarketScheduler] Error processing pair:', err);
      return null;
    }
  }
}
