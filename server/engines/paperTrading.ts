import { DatabaseManager } from '../db/database.js';
import {
  OperationalMode,
  PaperOrder,
  PaperPosition,
  PaperTrade,
} from '../types/index.js';

export interface ExecuteOrderInput {
  portfolioId?: string;
  idempotencyKey?: string;
  tokenAddress: string;
  tokenSymbol: string;
  tokenName: string;
  orderType: 'BUY' | 'SELL';
  assetUsed: 'SOL' | 'USDC';
  amountIn: number; // For BUY: amount of SOL or USDC to spend. For SELL: amount of tokens to sell
  marketPriceUsd: number;
  liquidityUsd: number;
  solPriceUsd: number;
  stopLossPercent?: number; // e.g. 15 for -15%
  takeProfitPercent?: number; // e.g. 35 for +35%
  mode?: OperationalMode;
}

export interface OrderExecutionResult {
  success: boolean;
  order?: PaperOrder;
  trade?: PaperTrade;
  position?: PaperPosition | null;
  error?: string;
}

export class PaperTradingEngine {
  private db: DatabaseManager;

  constructor() {
    this.db = DatabaseManager.getInstance();
  }

  public executeOrder(input: ExecuteOrderInput): OrderExecutionResult {
    const portfolioId = input.portfolioId || 'default-paper-portfolio';
    const mode = input.mode || 'DEMO';

    // 1. Idempotency Check
    if (input.idempotencyKey && this.db.isIdempotencyKeyUsed(input.idempotencyKey)) {
      return {
        success: false,
        error: `طلب مكرر: مفتاح Idempotency (${input.idempotencyKey}) تم تنفيذه مسبقاً.`,
      };
    }

    if (input.marketPriceUsd <= 0) {
      return {
        success: false,
        error: 'سعر السوق غير صالح (يجب أن يكون أكبر من الصفر).',
      };
    }

    if (input.amountIn <= 0) {
      return {
        success: false,
        error: 'كمية الطلب المدخلة يجب أن تكون أكبر من الصفر.',
      };
    }

    return this.db.transaction<OrderExecutionResult>(() => {
      const portfolio = this.db.getPortfolio(portfolioId);
      if (!portfolio) {
        return { success: false, error: 'المحفظة الافتراضية غير موجودة.' };
      }

      const orderId = `order-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
      const tradeId = `trade-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
      const now = Date.now();

      // BUY EXECUTION
      if (input.orderType === 'BUY') {
        const spendUsd = input.assetUsed === 'SOL'
          ? input.amountIn * input.solPriceUsd
          : input.amountIn;

        // Check sufficient cash
        if (input.assetUsed === 'SOL' && portfolio.solBalance < input.amountIn) {
          const rejectedOrder: PaperOrder = {
            id: orderId,
            idempotencyKey: input.idempotencyKey,
            portfolioId,
            tokenAddress: input.tokenAddress,
            tokenSymbol: input.tokenSymbol,
            orderType: 'BUY',
            assetUsed: 'SOL',
            amountIn: input.amountIn,
            amountOut: 0,
            executionPriceUsd: input.marketPriceUsd,
            feeUsd: 0,
            slippagePercent: 0,
            status: 'REJECTED',
            rejectionReason: `رصيد SOL غير كافٍ. المتاح: ${portfolio.solBalance.toFixed(4)} SOL، المطلوب: ${input.amountIn.toFixed(4)} SOL`,
            createdAt: now,
            mode,
          };
          this.db.recordOrder(rejectedOrder);
          return { success: false, error: rejectedOrder.rejectionReason, order: rejectedOrder };
        }

        if (input.assetUsed === 'USDC' && portfolio.usdcBalance < input.amountIn) {
          const rejectedOrder: PaperOrder = {
            id: orderId,
            idempotencyKey: input.idempotencyKey,
            portfolioId,
            tokenAddress: input.tokenAddress,
            tokenSymbol: input.tokenSymbol,
            orderType: 'BUY',
            assetUsed: 'USDC',
            amountIn: input.amountIn,
            amountOut: 0,
            executionPriceUsd: input.marketPriceUsd,
            feeUsd: 0,
            slippagePercent: 0,
            status: 'REJECTED',
            rejectionReason: `رصيد USDC غير كافٍ. المتاح: $${portfolio.usdcBalance.toFixed(2)}، المطلوب: $${input.amountIn.toFixed(2)}`,
            createdAt: now,
            mode,
          };
          this.db.recordOrder(rejectedOrder);
          return { success: false, error: rejectedOrder.rejectionReason, order: rejectedOrder };
        }

        // Realistic Slippage Modeling: Impact = (orderSizeUsd / max(5000, liquidityUsd)) * 80
        const slippagePercent = Math.min(
          6.0,
          Math.max(0.15, (spendUsd / Math.max(5000, input.liquidityUsd)) * 80)
        );
        const executionPriceUsd = input.marketPriceUsd * (1 + slippagePercent / 100);

        // Fees: 0.25% DEX fee + 0.0005 SOL base gas
        const dexTradingFeeUsd = spendUsd * 0.0025;
        const gasFeeUsd = 0.0005 * input.solPriceUsd;
        const totalFeeUsd = dexTradingFeeUsd + gasFeeUsd;

        const effectiveSpendUsd = spendUsd - totalFeeUsd;
        if (effectiveSpendUsd <= 0) {
          return { success: false, error: 'قيمة الأمر صغيرة جداً بحيث تستهلكها الرسوم بالكامل.' };
        }

        const tokensBought = effectiveSpendUsd / executionPriceUsd;

        // Deduct balance
        const newSolBalance = input.assetUsed === 'SOL'
          ? Math.max(0, portfolio.solBalance - input.amountIn)
          : portfolio.solBalance;
        const newUsdcBalance = input.assetUsed === 'USDC'
          ? Math.max(0, portfolio.usdcBalance - input.amountIn)
          : portfolio.usdcBalance;
        this.db.updatePortfolioBalances(portfolioId, newSolBalance, newUsdcBalance, 0);

        // Update or create position
        const existingPos = this.db.getPositionByToken(portfolioId, input.tokenAddress);
        let updatedPosition: PaperPosition;

        const stopLossPrice = input.stopLossPercent
          ? executionPriceUsd * (1 - input.stopLossPercent / 100)
          : existingPos?.stopLossPriceUsd;
        const takeProfitPrice = input.takeProfitPercent
          ? executionPriceUsd * (1 + input.takeProfitPercent / 100)
          : existingPos?.takeProfitPriceUsd;

        if (existingPos) {
          const newAmount = existingPos.amount + tokensBought;
          const newCostBasis = existingPos.costBasisUsd + effectiveSpendUsd;
          const avgEntryPrice = newAmount > 0 ? newCostBasis / newAmount : executionPriceUsd;

          updatedPosition = {
            id: existingPos.id,
            portfolioId,
            tokenAddress: input.tokenAddress,
            tokenSymbol: input.tokenSymbol,
            tokenName: input.tokenName,
            amount: newAmount,
            entryPriceUsd: avgEntryPrice,
            currentPriceUsd: input.marketPriceUsd,
            costBasisUsd: newCostBasis,
            currentValueUsd: newAmount * input.marketPriceUsd,
            unrealizedPnlUsd: (newAmount * input.marketPriceUsd) - newCostBasis,
            unrealizedPnlPercent: newCostBasis > 0 ? (((newAmount * input.marketPriceUsd) - newCostBasis) / newCostBasis) * 100 : 0,
            stopLossPriceUsd: stopLossPrice,
            takeProfitPriceUsd: takeProfitPrice,
            openedAt: existingPos.openedAt,
            lastUpdatedAt: now,
            mode,
          };
        } else {
          updatedPosition = {
            id: `pos-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
            portfolioId,
            tokenAddress: input.tokenAddress,
            tokenSymbol: input.tokenSymbol,
            tokenName: input.tokenName,
            amount: tokensBought,
            entryPriceUsd: executionPriceUsd,
            currentPriceUsd: input.marketPriceUsd,
            costBasisUsd: effectiveSpendUsd,
            currentValueUsd: tokensBought * input.marketPriceUsd,
            unrealizedPnlUsd: 0,
            unrealizedPnlPercent: 0,
            stopLossPriceUsd: stopLossPrice,
            takeProfitPriceUsd: takeProfitPrice,
            openedAt: now,
            lastUpdatedAt: now,
            mode,
          };
        }
        this.db.upsertPosition(updatedPosition);

        const order: PaperOrder = {
          id: orderId,
          idempotencyKey: input.idempotencyKey,
          portfolioId,
          tokenAddress: input.tokenAddress,
          tokenSymbol: input.tokenSymbol,
          orderType: 'BUY',
          assetUsed: input.assetUsed,
          amountIn: input.amountIn,
          amountOut: tokensBought,
          executionPriceUsd,
          feeUsd: totalFeeUsd,
          slippagePercent,
          status: 'FILLED',
          createdAt: now,
          mode,
        };
        this.db.recordOrder(order);

        const trade: PaperTrade = {
          id: tradeId,
          orderId,
          portfolioId,
          tokenAddress: input.tokenAddress,
          tokenSymbol: input.tokenSymbol,
          side: 'BUY',
          amount: tokensBought,
          priceUsd: executionPriceUsd,
          totalUsd: spendUsd,
          feeUsd: totalFeeUsd,
          timestamp: now,
          mode,
        };
        this.db.recordTrade(trade);

        this.db.addAlert({
          type: 'TRADE_EXECUTED',
          title: `تم تنفيذ أمر شراء افتراضي (${input.tokenSymbol})`,
          message: `تم شراء ${tokensBought.toFixed(2)} ${input.tokenSymbol} بسعر $${executionPriceUsd.toFixed(6)} بانزلاق ${slippagePercent.toFixed(2)}%`,
          severity: 'SUCCESS',
          tokenAddress: input.tokenAddress,
        });

        return { success: true, order, trade, position: updatedPosition };
      }

      // SELL EXECUTION
      if (input.orderType === 'SELL') {
        const existingPos = this.db.getPositionByToken(portfolioId, input.tokenAddress);
        if (!existingPos || existingPos.amount <= 0) {
          return { success: false, error: 'لا يوجد مركز مفتوح لهذه العملة للبيع.' };
        }

        if (input.amountIn > existingPos.amount) {
          return {
            success: false,
            error: `الكمية المطلوبة للبيع (${input.amountIn}) أكبر من رصيد المركز المفتوح المتاح (${existingPos.amount}).`,
          };
        }

        const sellAmount = input.amountIn;
        if (sellAmount <= 0) {
          return { success: false, error: 'كمية البيع المطلوبة يجب أن تكون أكبر من الصفر.' };
        }

        const grossUsdValue = sellAmount * input.marketPriceUsd;
        const slippagePercent = Math.min(
          6.0,
          Math.max(0.15, (grossUsdValue / Math.max(5000, input.liquidityUsd)) * 80)
        );
        const executionPriceUsd = input.marketPriceUsd * (1 - slippagePercent / 100);

        const dexTradingFeeUsd = grossUsdValue * 0.0025;
        const gasFeeUsd = 0.0005 * input.solPriceUsd;
        const totalFeeUsd = dexTradingFeeUsd + gasFeeUsd;

        const netProceedsUsd = (sellAmount * executionPriceUsd) - totalFeeUsd;
        const costBasisPortion = (sellAmount / existingPos.amount) * existingPos.costBasisUsd;
        const realizedPnlUsd = netProceedsUsd - costBasisPortion;

        // Credit to USDC or SOL
        let newSolBalance = portfolio.solBalance;
        let newUsdcBalance = portfolio.usdcBalance;

        if (input.assetUsed === 'SOL') {
          const solProceeds = Math.max(0, netProceedsUsd / input.solPriceUsd);
          newSolBalance += solProceeds;
        } else {
          newUsdcBalance += Math.max(0, netProceedsUsd);
        }

        this.db.updatePortfolioBalances(portfolioId, newSolBalance, newUsdcBalance, realizedPnlUsd);

        // Update or delete position
        const remainingAmount = existingPos.amount - sellAmount;
        let positionAfterSell: PaperPosition | null = null;

        if (remainingAmount <= 0.000001) {
          this.db.deletePosition(existingPos.id);
        } else {
          const remainingCostBasis = existingPos.costBasisUsd - costBasisPortion;
          positionAfterSell = {
            ...existingPos,
            amount: remainingAmount,
            costBasisUsd: remainingCostBasis,
            currentValueUsd: remainingAmount * input.marketPriceUsd,
            unrealizedPnlUsd: (remainingAmount * input.marketPriceUsd) - remainingCostBasis,
            unrealizedPnlPercent: remainingCostBasis > 0 ? (((remainingAmount * input.marketPriceUsd) - remainingCostBasis) / remainingCostBasis) * 100 : 0,
            lastUpdatedAt: now,
          };
          this.db.upsertPosition(positionAfterSell);
        }

        const order: PaperOrder = {
          id: orderId,
          idempotencyKey: input.idempotencyKey,
          portfolioId,
          tokenAddress: input.tokenAddress,
          tokenSymbol: input.tokenSymbol,
          orderType: 'SELL',
          assetUsed: input.assetUsed,
          amountIn: sellAmount,
          amountOut: netProceedsUsd,
          executionPriceUsd,
          feeUsd: totalFeeUsd,
          slippagePercent,
          status: 'FILLED',
          createdAt: now,
          mode,
        };
        this.db.recordOrder(order);

        const trade: PaperTrade = {
          id: tradeId,
          orderId,
          portfolioId,
          tokenAddress: input.tokenAddress,
          tokenSymbol: input.tokenSymbol,
          side: 'SELL',
          amount: sellAmount,
          priceUsd: executionPriceUsd,
          totalUsd: netProceedsUsd,
          feeUsd: totalFeeUsd,
          realizedPnlUsd,
          timestamp: now,
          mode,
        };
        this.db.recordTrade(trade);

        const pnlSign = realizedPnlUsd >= 0 ? '+' : '';
        this.db.addAlert({
          type: 'TRADE_EXECUTED',
          title: `تم تنفيذ أمر بيع افتراضي (${input.tokenSymbol})`,
          message: `تم بيع ${sellAmount.toFixed(2)} ${input.tokenSymbol} بصافي عائد $${netProceedsUsd.toFixed(2)} (ربح/خسارة محققة: ${pnlSign}$${realizedPnlUsd.toFixed(2)})`,
          severity: realizedPnlUsd >= 0 ? 'SUCCESS' : 'WARNING',
          tokenAddress: input.tokenAddress,
        });

        return { success: true, order, trade, position: positionAfterSell };
      }

      return { success: false, error: 'نوع الأمر غير مدعوم.' };
    });
  }

  public checkAutomatedStops(solPriceUsd: number): void {
    const positions = this.db.getPositions('default-paper-portfolio');
    for (const pos of positions) {
      if (pos.stopLossPriceUsd && pos.currentPriceUsd <= pos.stopLossPriceUsd) {
        // Trigger Stop Loss
        this.executeOrder({
          tokenAddress: pos.tokenAddress,
          tokenSymbol: pos.tokenSymbol,
          tokenName: pos.tokenName,
          orderType: 'SELL',
          assetUsed: 'USDC',
          amountIn: pos.amount,
          marketPriceUsd: pos.currentPriceUsd,
          liquidityUsd: 50000,
          solPriceUsd,
          mode: pos.mode,
        });
        this.db.addAlert({
          type: 'STOP_LOSS',
          title: `تفعيل وقف الخسارة الآلي: ${pos.tokenSymbol}`,
          message: `انخفض السعر إلى $${pos.currentPriceUsd.toFixed(6)} دون حد الوقف المحدد ($${pos.stopLossPriceUsd.toFixed(6)}). تم إغلاق المركز افتراضياً.`,
          severity: 'CRITICAL',
          tokenAddress: pos.tokenAddress,
        });
      } else if (pos.takeProfitPriceUsd && pos.currentPriceUsd >= pos.takeProfitPriceUsd) {
        // Trigger Take Profit
        this.executeOrder({
          tokenAddress: pos.tokenAddress,
          tokenSymbol: pos.tokenSymbol,
          tokenName: pos.tokenName,
          orderType: 'SELL',
          assetUsed: 'USDC',
          amountIn: pos.amount,
          marketPriceUsd: pos.currentPriceUsd,
          liquidityUsd: 50000,
          solPriceUsd,
          mode: pos.mode,
        });
        this.db.addAlert({
          type: 'TRADE_EXECUTED',
          title: `جني أرباح آلي: ${pos.tokenSymbol}`,
          message: `وصل السعر إلى هدف جني الأرباح ($${pos.currentPriceUsd.toFixed(6)}). تم إغلاق المركز وتأمين العائد.`,
          severity: 'SUCCESS',
          tokenAddress: pos.tokenAddress,
        });
      }
    }
  }
}
