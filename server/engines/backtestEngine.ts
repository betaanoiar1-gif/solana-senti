import { DatabaseManager } from '../db/database.js';
import {
  BacktestResult,
  BacktestTrade,
  MarketSnapshot,
  StrategyConfig,
  TokenIntelligence,
} from '../types/index.js';

export class BacktestEngine {
  private db: DatabaseManager;

  constructor() {
    this.db = DatabaseManager.getInstance();
  }

  public runBacktest(strategyId: string, initialCapitalUsd = 10000): BacktestResult {
    const startedAt = Date.now();
    const runId = `backtest-${startedAt}-${Math.random().toString(36).substring(2, 7)}`;
    const strategy = this.db.getStrategy(strategyId);

    if (!strategy) {
      return {
        runId,
        strategyId,
        strategyName: 'Unknown Strategy',
        startedAt,
        completedAt: Date.now(),
        totalSnapshotsEvaluated: 0,
        eligibleTokensFound: 0,
        totalTrades: 0,
        winningTrades: 0,
        losingTrades: 0,
        winRatePercent: 0,
        initialCapitalUsd,
        finalCapitalUsd: initialCapitalUsd,
        netPnlUsd: 0,
        totalReturnPercent: 0,
        maxDrawdownPercent: 0,
        profitFactor: 0,
        avgHoldTimeMinutes: 0,
        trades: [],
        status: 'ERROR',
        statusExplanation: 'الاستراتيجية المحددة غير موجودة في قاعدة البيانات.',
      };
    }

    const allTokens = this.db.getAllTokens();
    let totalSnapshots = 0;
    const tokensWithSnapshots: Array<{ token: TokenIntelligence; snapshots: MarketSnapshot[] }> = [];

    for (const token of allTokens) {
      const snaps = this.db.getHistoricalSnapshots(token.address, 200);
      if (snaps.length >= 2) {
        // Ensure chronological order (oldest to newest)
        snaps.sort((a, b) => a.timestamp - b.timestamp);
        tokensWithSnapshots.push({ token, snapshots: snaps });
        totalSnapshots += snaps.length;
      }
    }

    // Check if sufficient historical data exists
    if (tokensWithSnapshots.length === 0 || totalSnapshots < 6) {
      const insResult: BacktestResult = {
        runId,
        strategyId: strategy.id,
        strategyName: strategy.name,
        startedAt,
        completedAt: Date.now(),
        totalSnapshotsEvaluated: totalSnapshots,
        eligibleTokensFound: 0,
        totalTrades: 0,
        winningTrades: 0,
        losingTrades: 0,
        winRatePercent: 0,
        initialCapitalUsd,
        finalCapitalUsd: initialCapitalUsd,
        netPnlUsd: 0,
        totalReturnPercent: 0,
        maxDrawdownPercent: 0,
        profitFactor: 0,
        avgHoldTimeMinutes: 0,
        trades: [],
        status: 'INSUFFICIENT_DATA',
        statusExplanation: 'لا توجد لقطات تاريخية زمنية كافية (الحد الأدنى 6 لقطات عبر الأزواج). دع النظام يعمل لبضع دقائق لتجميع لقطات حية إضافية عبر المجدول.',
      };
      this.db.saveBacktestRun(insResult);
      return insResult;
    }

    // Chronological multi-token simulation
    let currentCapital = initialCapitalUsd;
    let peakCapital = initialCapitalUsd;
    let maxDrawdownUsd = 0;
    const trades: BacktestTrade[] = [];
    let grossProfit = 0;
    let grossLoss = 0;
    let eligibleTokens = 0;

    for (const { token, snapshots } of tokensWithSnapshots) {
      let inPosition = false;
      let entryIndex = -1;
      let entryPrice = 0;
      let tokenAmount = 0;
      let positionSizeUsd = 0;
      let takeProfitPrice = 0;
      let stopLossPrice = 0;
      const maxHoldMs = strategy.maxHoldTimeHours * 3600 * 1000;

      for (let i = 0; i < snapshots.length; i++) {
        const snap = snapshots[i];

        if (!inPosition) {
          // Point-in-time evaluation at timestamp t_i (ZERO FUTURE LOOKAHEAD)
          const liqOk = snap.liquidityUsd >= strategy.minLiquidityUsd;
          const volOk = snap.volume24hUsd >= strategy.minVolume24hUsd;
          const pairAgeHours = token.pairCreatedAt ? (snap.timestamp - token.pairCreatedAt) / 3600000 : 24;
          const ageOk = pairAgeHours <= strategy.maxPairAgeHours;

          // Estimate point-in-time momentum & opportunity using only data available up to t_i
          let prevPrice = i > 0 ? snapshots[i - 1].priceUsd : snap.priceUsd;
          let priceChangePct = prevPrice > 0 ? ((snap.priceUsd - prevPrice) / prevPrice) * 100 : 0;
          
          // Point-in-time score: weighted composite of liquidity depth, volume, and buy txns at t_i
          let pitScore = 50;
          if (snap.liquidityUsd >= 50000) pitScore += 15;
          if (snap.volume24hUsd >= 100000) pitScore += 15;
          if (snap.txns24hBuys > snap.txns24hSells) pitScore += 10;
          if (priceChangePct > 0 && priceChangePct < 25) pitScore += 10;
          pitScore = Math.min(100, Math.max(0, pitScore));

          // Check if entry conditions held strictly at t_i
          if (liqOk && volOk && ageOk && pitScore >= strategy.minOpportunityScore) {
            inPosition = true;
            entryIndex = i;
            entryPrice = snap.priceUsd * (1 + strategy.slippageModelPercent / 100);
            positionSizeUsd = Math.min(strategy.positionSizeUsd, currentCapital * 0.2); // max 20% equity per trade
            if (positionSizeUsd <= 10) {
              inPosition = false;
              continue;
            }

            tokenAmount = (positionSizeUsd * (1 - strategy.feeModelPercent / 100)) / entryPrice;
            takeProfitPrice = entryPrice * (1 + strategy.takeProfitPercent / 100);
            stopLossPrice = entryPrice * (1 - strategy.stopLossPercent / 100);
            eligibleTokens++;
          }
        } else {
          // Currently in position: check exit conditions at t_i
          const entrySnap = snapshots[entryIndex];
          const elapsed = snap.timestamp - entrySnap.timestamp;
          let shouldExit = false;
          let exitReason: BacktestTrade['exitReason'] = 'END_OF_DATA';

          if (snap.priceUsd >= takeProfitPrice) {
            shouldExit = true;
            exitReason = 'TAKE_PROFIT';
          } else if (snap.priceUsd <= stopLossPrice) {
            shouldExit = true;
            exitReason = 'STOP_LOSS';
          } else if (elapsed >= maxHoldMs) {
            shouldExit = true;
            exitReason = 'MAX_HOLD';
          } else if (i === snapshots.length - 1) {
            shouldExit = true;
            exitReason = 'END_OF_DATA';
          }

          if (shouldExit) {
            const exitPrice = snap.priceUsd * (1 - strategy.slippageModelPercent / 100);
            const grossProceeds = tokenAmount * exitPrice;
            const netProceeds = grossProceeds * (1 - strategy.feeModelPercent / 100);
            const pnlUsd = netProceeds - positionSizeUsd;
            const pnlPercent = (pnlUsd / positionSizeUsd) * 100;

            trades.push({
              tokenAddress: token.address,
              tokenSymbol: token.symbol,
              entryTimestamp: entrySnap.timestamp,
              exitTimestamp: snap.timestamp,
              entryPriceUsd: entryPrice,
              exitPriceUsd: exitPrice,
              sizeUsd: positionSizeUsd,
              pnlUsd,
              pnlPercent,
              exitReason,
            });

            currentCapital += pnlUsd;
            if (pnlUsd > 0) grossProfit += pnlUsd; else grossLoss += Math.abs(pnlUsd);

            inPosition = false;
            entryIndex = -1;
          }
        }
      }

      // Track peak capital and drawdown
      if (currentCapital > peakCapital) {
        peakCapital = currentCapital;
      } else {
        const dd = peakCapital - currentCapital;
        if (dd > maxDrawdownUsd) maxDrawdownUsd = dd;
      }
    }

    const winningTrades = trades.filter(t => t.pnlUsd > 0).length;
    const losingTrades = trades.filter(t => t.pnlUsd <= 0).length;
    const totalTrades = trades.length;
    const winRatePercent = totalTrades > 0 ? (winningTrades / totalTrades) * 100 : 0;
    const netPnlUsd = currentCapital - initialCapitalUsd;
    const totalReturnPercent = (netPnlUsd / initialCapitalUsd) * 100;
    const maxDrawdownPercent = peakCapital > 0 ? (maxDrawdownUsd / peakCapital) * 100 : 0;
    const profitFactor = grossLoss > 0 ? grossProfit / grossLoss : (grossProfit > 0 ? 99.9 : 1.0);

    const totalHoldTimeMinutes = trades.reduce((acc, t) => acc + ((t.exitTimestamp - t.entryTimestamp) / 60000), 0);
    const avgHoldTimeMinutes = totalTrades > 0 ? totalHoldTimeMinutes / totalTrades : 0;

    const result: BacktestResult = {
      runId,
      strategyId: strategy.id,
      strategyName: strategy.name,
      startedAt,
      completedAt: Date.now(),
      totalSnapshotsEvaluated: totalSnapshots,
      eligibleTokensFound: eligibleTokens,
      totalTrades,
      winningTrades,
      losingTrades,
      winRatePercent,
      initialCapitalUsd,
      finalCapitalUsd: currentCapital,
      netPnlUsd,
      totalReturnPercent,
      maxDrawdownPercent,
      profitFactor,
      avgHoldTimeMinutes,
      trades,
      status: 'SUCCESS',
      statusExplanation: `تم إكمال الاختبار التاريخي بنجاح على ${totalTrades} صفقة دون أي تسريب لبيانات مستقبلية.`,
    };

    this.db.saveBacktestRun(result);
    return result;
  }
}
