import { Router, Request, Response } from 'express';
import { DatabaseManager } from '../db/database.js';
import { DexScreenerConnector } from '../connectors/dexscreener.js';
import { SolanaRpcConnector } from '../connectors/solanaRpc.js';
import { PaperTradingEngine } from '../engines/paperTrading.js';
import { BacktestEngine } from '../engines/backtestEngine.js';
import { MarketScheduler } from '../engines/scheduler.js';
import { SystemHealthStatus } from '../types/index.js';

export const apiRouter = Router();

const db = DatabaseManager.getInstance();
const dexConnector = DexScreenerConnector.getInstance();
const rpcConnector = SolanaRpcConnector.getInstance();
const paperTrading = new PaperTradingEngine();
const backtestEngine = new BacktestEngine();
const scheduler = MarketScheduler.getInstance();
const startTime = Date.now();

// 1. Health & System Status
apiRouter.get('/health', (_req: Request, res: Response) => {
  const dexStatus = dexConnector.getStatus();
  const rpcStatus = rpcConnector.getStatus();
  const schedulerStatus = scheduler.getStatus();
  const tokens = db.getAllTokens();
  const alerts = db.getAlerts();
  const pipeline = scheduler.getPipelineStatus();

  const health: SystemHealthStatus = {
    backend: 'HEALTHY',
    database: 'HEALTHY',
    dexScreener: dexStatus.status,
    solanaRpc: rpcStatus.status,
    scheduler: schedulerStatus.isRunning ? 'RUNNING' : 'STOPPED',
    pipeline,
    uptimeSeconds: Math.floor((Date.now() - startTime) / 1000),
    dbPath: db.getDbPath(),
    lastSuccessfulSyncAt: pipeline.lastSuccessfulFetchAt || dexStatus.lastSuccess,
    totalTokensTracked: tokens.length,
    activeAlertsCount: alerts.filter(a => !a.isRead).length,
    version: '2.5.0-SENTINEL',
  };

  res.json(health);
});

apiRouter.get('/market/pipeline-status', (_req: Request, res: Response) => {
  res.json(scheduler.getPipelineStatus());
});

// 2. Market Overview & Dashboard Metrics
apiRouter.get('/market/overview', (_req: Request, res: Response) => {
  const tokens = db.getAllTokens();
  const portfolio = db.getPortfolio('default-paper-portfolio');
  const positions = db.getPositions('default-paper-portfolio');
  const settings = db.getSettings();
  const alerts = db.getAlerts(10);
  const backtests = db.getBacktestRuns(5);

  const solPriceUsd = settings.solPriceUsd;

  // Calculate portfolio total value
  const solValueUsd = (portfolio?.solBalance || 0) * solPriceUsd;
  const usdcValueUsd = portfolio?.usdcBalance || 0;
  const positionsValueUsd = positions.reduce((acc, p) => acc + p.currentValueUsd, 0);
  const totalPortfolioValueUsd = solValueUsd + usdcValueUsd + positionsValueUsd;
  const totalUnrealizedPnlUsd = positions.reduce((acc, p) => acc + p.unrealizedPnlUsd, 0);

  // Risk distribution
  const riskDistribution = {
    PASS: tokens.filter(t => t.risk.status === 'PASS').length,
    REVIEW: tokens.filter(t => t.risk.status === 'REVIEW').length,
    BLOCKED: tokens.filter(t => t.risk.status === 'BLOCKED').length,
    UNKNOWN: tokens.filter(t => t.risk.status === 'UNKNOWN').length,
    ERROR: tokens.filter(t => t.risk.status === 'ERROR').length,
  };

  // Top Qualified Opportunities
  const topOpportunities = tokens
    .filter(t => t.risk.status === 'PASS' || t.risk.status === 'REVIEW')
    .sort((a, b) => b.opportunity.overallScore - a.opportunity.overallScore)
    .slice(0, 6);

  // DeSci Tokens
  const desciTokens = tokens.filter(t => t.scienceData?.isDeSci);

  res.json({
    totalTokens: tokens.length,
    watchlistCount: tokens.filter(t => t.isWatchlist).length,
    riskDistribution,
    topOpportunities,
    desciTokens,
    portfolio: {
      ...portfolio,
      totalPortfolioValueUsd,
      positionsValueUsd,
      totalUnrealizedPnlUsd,
      openPositionsCount: positions.length,
    },
    recentAlerts: alerts,
    recentBacktests: backtests,
    operationalMode: settings.operationalMode,
    pipeline: scheduler.getPipelineStatus(),
  });
});

// 3. Tokens List with Advanced Filtering
apiRouter.get('/tokens', (req: Request, res: Response) => {
  const { search, riskStatus, minLiquidity, minVolume, watchlistOnly, tag, sort, order } = req.query;
  let tokens = db.getAllTokens();

  if (search && typeof search === 'string') {
    const q = search.toLowerCase();
    tokens = tokens.filter(t =>
      t.symbol.toLowerCase().includes(q) ||
      t.name.toLowerCase().includes(q) ||
      t.address.toLowerCase().includes(q)
    );
  }

  if (riskStatus && typeof riskStatus === 'string') {
    tokens = tokens.filter(t => t.risk.status === riskStatus);
  }

  if (minLiquidity) {
    const minL = Number(minLiquidity);
    if (!isNaN(minL)) tokens = tokens.filter(t => t.liquidityUsd >= minL);
  }

  if (minVolume) {
    const minV = Number(minVolume);
    if (!isNaN(minV)) tokens = tokens.filter(t => t.volume24hUsd >= minV);
  }

  if (watchlistOnly === 'true') {
    tokens = tokens.filter(t => t.isWatchlist);
  }

  if (tag && typeof tag === 'string') {
    tokens = tokens.filter(t => t.tags.includes(tag) || (tag === 'DeSci' && t.scienceData?.isDeSci));
  }

  // Sort
  const sortKey = (sort as string) || 'opportunity';
  const sortOrder = (order as string) === 'asc' ? 1 : -1;

  tokens.sort((a, b) => {
    if (sortKey === 'liquidity') return (a.liquidityUsd - b.liquidityUsd) * sortOrder;
    if (sortKey === 'volume') return (a.volume24hUsd - b.volume24hUsd) * sortOrder;
    if (sortKey === 'price') return (a.baseTokenPriceUsd - b.baseTokenPriceUsd) * sortOrder;
    if (sortKey === 'risk') return (a.risk.score - b.risk.score) * sortOrder;
    return (a.opportunity.overallScore - b.opportunity.overallScore) * sortOrder;
  });

  res.json({
    total: tokens.length,
    tokens,
  });
});

// 4. Token Details & Intelligence Dossier
apiRouter.get('/tokens/:address', (req: Request, res: Response) => {
  const { address } = req.params;
  const token = db.getToken(address);
  if (!token) {
    return res.status(404).json({ error: 'Token not found' });
  }
  res.json(token);
});

// 5. Watchlist Toggle
apiRouter.post('/tokens/:address/watchlist', (req: Request, res: Response) => {
  const { address } = req.params;
  const isWatchlist = db.toggleWatchlist(address);
  res.json({ address, isWatchlist });
});

// 6. Portfolio & Positions
apiRouter.get('/portfolio', (_req: Request, res: Response) => {
  const portfolio = db.getPortfolio('default-paper-portfolio');
  const positions = db.getPositions('default-paper-portfolio');
  const trades = db.getTrades('default-paper-portfolio', 30);
  const settings = db.getSettings();

  const solPriceUsd = settings.solPriceUsd;
  const solValueUsd = (portfolio?.solBalance || 0) * solPriceUsd;
  const usdcValueUsd = portfolio?.usdcBalance || 0;
  const positionsValueUsd = positions.reduce((acc, p) => acc + p.currentValueUsd, 0);
  const totalPortfolioValueUsd = solValueUsd + usdcValueUsd + positionsValueUsd;
  const totalUnrealizedPnlUsd = positions.reduce((acc, p) => acc + p.unrealizedPnlUsd, 0);

  res.json({
    portfolio,
    positions,
    trades,
    summary: {
      solValueUsd,
      usdcValueUsd,
      positionsValueUsd,
      totalPortfolioValueUsd,
      totalUnrealizedPnlUsd,
      totalRealizedPnlUsd: portfolio?.totalRealizedPnlUsd || 0,
      openPositionsCount: positions.length,
    },
  });
});

// 7. Paper Trading Orders
apiRouter.post('/paper-trading/order', (req: Request, res: Response) => {
  const {
    tokenAddress,
    tokenSymbol,
    tokenName,
    orderType,
    assetUsed,
    amountIn,
    marketPriceUsd,
    liquidityUsd,
    stopLossPercent,
    takeProfitPercent,
    idempotencyKey,
  } = req.body;

  const settings = db.getSettings();

  const result = paperTrading.executeOrder({
    tokenAddress,
    tokenSymbol: tokenSymbol || 'TOKEN',
    tokenName: tokenName || tokenSymbol || 'Token',
    orderType,
    assetUsed: assetUsed || 'USDC',
    amountIn: Number(amountIn),
    marketPriceUsd: Number(marketPriceUsd),
    liquidityUsd: Number(liquidityUsd) || 50000,
    solPriceUsd: settings.solPriceUsd,
    stopLossPercent: stopLossPercent ? Number(stopLossPercent) : undefined,
    takeProfitPercent: takeProfitPercent ? Number(takeProfitPercent) : undefined,
    idempotencyKey,
    mode: settings.operationalMode,
  });

  if (!result.success) {
    return res.status(400).json(result);
  }

  res.json(result);
});

// Close Position
apiRouter.post('/paper-trading/close-position', (req: Request, res: Response) => {
  const { tokenAddress } = req.body;
  if (!tokenAddress) return res.status(400).json({ error: 'tokenAddress is required' });

  const position = db.getPositionByToken('default-paper-portfolio', tokenAddress);
  if (!position) return res.status(404).json({ error: 'No open position found for token' });

  const settings = db.getSettings();
  const token = db.getToken(tokenAddress);
  const currentPrice = token?.baseTokenPriceUsd || position.currentPriceUsd;

  const result = paperTrading.executeOrder({
    tokenAddress: position.tokenAddress,
    tokenSymbol: position.tokenSymbol,
    tokenName: position.tokenName,
    orderType: 'SELL',
    assetUsed: 'USDC',
    amountIn: position.amount,
    marketPriceUsd: currentPrice,
    liquidityUsd: token?.liquidityUsd || 50000,
    solPriceUsd: settings.solPriceUsd,
    mode: settings.operationalMode,
  });

  res.json(result);
});

// Reset Portfolio (Explicit user request)
apiRouter.post('/paper-trading/reset', (_req: Request, res: Response) => {
  db.resetPortfolio('default-paper-portfolio');
  res.json({ success: true, message: 'تمت استعادة المحفظة الافتراضية إلى الرصيد الابتدائي (50 SOL و 5000 USDC).' });
});

// 8. Public Wallet Intelligence
apiRouter.get('/wallets/analyze', async (req: Request, res: Response) => {
  const { address } = req.query;
  if (!address || typeof address !== 'string') {
    return res.status(400).json({ error: 'Wallet address query is required' });
  }

  const overview = await rpcConnector.getWalletOverview(address);
  res.json(overview);
});

// 9. Strategies & Backtesting
apiRouter.get('/strategies', (_req: Request, res: Response) => {
  const strategies = db.getStrategies();
  res.json(strategies);
});

apiRouter.post('/backtests/run', (req: Request, res: Response) => {
  const { strategyId, initialCapitalUsd } = req.body;
  if (!strategyId) return res.status(400).json({ error: 'strategyId is required' });

  const result = backtestEngine.runBacktest(strategyId, Number(initialCapitalUsd) || 10000);
  res.json(result);
});

apiRouter.get('/backtests/history', (_req: Request, res: Response) => {
  const runs = db.getBacktestRuns();
  res.json(runs);
});

// 10. Alerts
apiRouter.get('/alerts', (_req: Request, res: Response) => {
  const alerts = db.getAlerts(50);
  res.json(alerts);
});

apiRouter.post('/alerts/:id/read', (req: Request, res: Response) => {
  db.markAlertAsRead(req.params.id);
  res.json({ success: true });
});

apiRouter.post('/alerts/clear', (_req: Request, res: Response) => {
  db.clearAllAlerts();
  res.json({ success: true });
});

// 11. Settings
apiRouter.get('/settings', (_req: Request, res: Response) => {
  res.json(db.getSettings());
});

apiRouter.post('/settings', (req: Request, res: Response) => {
  const updated = db.updateSettings(req.body);
  res.json(updated);
});

// 12. Manual Immediate Sync Trigger
apiRouter.post('/market/sync', async (_req: Request, res: Response) => {
  await scheduler.syncMarketCycle();
  res.json({ success: true, timestamp: Date.now() });
});
