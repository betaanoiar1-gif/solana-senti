export type RiskStatus = 'PASS' | 'REVIEW' | 'BLOCKED' | 'UNKNOWN' | 'ERROR';
export type LifecycleStage = 'DISCOVERED' | 'WATCHLIST' | 'QUALIFIED' | 'REJECTED' | 'MONITORING' | 'EXPIRED';
export type DataFreshness = 'FRESH' | 'STALE' | 'UNKNOWN' | 'ERROR' | 'UNAVAILABLE';
export type OperationalMode = 'LIVE' | 'DEMO';

export interface MarketSnapshot {
  id?: string;
  tokenAddress: string;
  timestamp: number; // UTC ms
  priceUsd: number;
  liquidityUsd: number;
  volume24hUsd: number;
  volume1hUsd?: number;
  priceChange5m?: number;
  priceChange1h?: number;
  priceChange24h?: number;
  txns24hBuys: number;
  txns24hSells: number;
  mode: OperationalMode;
}

export interface RiskRuleEvaluation {
  ruleId: string;
  name: string;
  passed: boolean;
  severity: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW' | 'INFO';
  description: string;
  evidence: string;
}

export interface RiskAssessment {
  tokenAddress: string;
  status: RiskStatus;
  score: number; // 0 (safest) to 100 (extreme risk)
  level: 'LOW' | 'MEDIUM' | 'HIGH' | 'EXTREME' | 'UNKNOWN';
  evaluations: RiskRuleEvaluation[];
  missingData: string[];
  evaluatedAt: number; // UTC ms
  ruleVersion: string;
  summary: string;
}

export interface OpportunityFactorScore {
  factor: string;
  score: number;
  maxScore: number;
  weight: number;
  description: string;
  evidence: string;
  coverage: DataFreshness;
}

export interface OpportunityAssessment {
  tokenAddress: string;
  overallScore: number; // 0 to 100
  factors: OpportunityFactorScore[];
  confidence: number; // 0 to 100%
  missingData: string[];
  evaluatedAt: number; // UTC ms
  positiveDrivers: string[];
  negativeDrivers: string[];
}

export interface TokenIntelligence {
  address: string;
  symbol: string;
  name: string;
  decimals: number;
  pairAddress?: string;
  dexId?: string;
  baseTokenPriceUsd: number;
  liquidityUsd: number;
  fdvUsd?: number;
  marketCapUsd?: number;
  volume24hUsd: number;
  pairCreatedAt?: number; // UTC ms
  firstSeenAt: number; // UTC ms
  lastSeenAt: number; // UTC ms
  lifecycleStage: LifecycleStage;
  isWatchlist: boolean;
  tags: string[];
  // Risk & Opportunity
  risk: RiskAssessment;
  opportunity: OpportunityAssessment;
  // History snapshots
  snapshots: MarketSnapshot[];
  // DeSci & Bioscience specific metadata
  scienceData?: {
    isDeSci: boolean;
    compoundName?: string;
    pubchemCid?: number;
    smiles?: string;
    molecularFormula?: string;
    molecularWeight?: string;
    targetOrganism?: string;
    longevityTrial?: string;
    pubmedQuery?: string;
    pubmedArticles?: Array<{ title: string; pmid: string; url: string; year: string }>;
    linkSource?: string;
    confidenceLevel?: string;
    verificationDisclaimer?: string;
  };
  freshness: DataFreshness;
}

export interface PaperPortfolio {
  id: string;
  name: string;
  createdAt: number;
  updatedAt: number;
  solBalance: number; // In SOL
  usdcBalance: number; // In USDC
  initialSolBalance: number;
  initialUsdcBalance: number;
  totalRealizedPnlUsd: number;
  mode: OperationalMode;
}

export interface PaperPosition {
  id: string;
  portfolioId: string;
  tokenAddress: string;
  tokenSymbol: string;
  tokenName: string;
  amount: number;
  entryPriceUsd: number;
  currentPriceUsd: number;
  costBasisUsd: number;
  currentValueUsd: number;
  unrealizedPnlUsd: number;
  unrealizedPnlPercent: number;
  stopLossPriceUsd?: number;
  takeProfitPriceUsd?: number;
  openedAt: number;
  lastUpdatedAt: number;
  mode: OperationalMode;
}

export interface PaperOrder {
  id: string;
  idempotencyKey?: string;
  portfolioId: string;
  tokenAddress: string;
  tokenSymbol: string;
  orderType: 'BUY' | 'SELL';
  assetUsed: 'SOL' | 'USDC';
  amountIn: number;
  amountOut: number;
  executionPriceUsd: number;
  feeUsd: number;
  slippagePercent: number;
  status: 'FILLED' | 'REJECTED' | 'CANCELLED';
  rejectionReason?: string;
  createdAt: number;
  mode: OperationalMode;
}

export interface PaperTrade {
  id: string;
  orderId: string;
  portfolioId: string;
  tokenAddress: string;
  tokenSymbol: string;
  side: 'BUY' | 'SELL';
  amount: number;
  priceUsd: number;
  totalUsd: number;
  feeUsd: number;
  realizedPnlUsd?: number;
  timestamp: number;
  mode: OperationalMode;
}

export interface AlertNotification {
  id: string;
  type: 'DISCOVERY' | 'RISK_ALERT' | 'OPPORTUNITY_SPIKE' | 'TRADE_EXECUTED' | 'STOP_LOSS' | 'SYSTEM_ERROR' | 'LIQUIDITY_DRAIN';
  title: string;
  message: string;
  severity: 'INFO' | 'SUCCESS' | 'WARNING' | 'CRITICAL';
  tokenAddress?: string;
  createdAt: number;
  isRead: boolean;
}

export interface StrategyConfig {
  id: string;
  name: string;
  description: string;
  minOpportunityScore: number;
  maxRiskScore: number;
  allowedRiskStatuses: RiskStatus[];
  minLiquidityUsd: number;
  minVolume24hUsd: number;
  maxPairAgeHours: number;
  stopLossPercent: number; // e.g. 15 for -15%
  takeProfitPercent: number; // e.g. 35 for +35%
  maxHoldTimeHours: number;
  positionSizeUsd: number;
  slippageModelPercent: number;
  feeModelPercent: number;
  enabled: boolean;
}

export interface BacktestTrade {
  tokenAddress: string;
  tokenSymbol: string;
  entryTimestamp: number;
  exitTimestamp: number;
  entryPriceUsd: number;
  exitPriceUsd: number;
  sizeUsd: number;
  pnlUsd: number;
  pnlPercent: number;
  exitReason: 'TAKE_PROFIT' | 'STOP_LOSS' | 'MAX_HOLD' | 'END_OF_DATA';
}

export interface BacktestResult {
  runId: string;
  strategyId: string;
  strategyName: string;
  startedAt: number;
  completedAt: number;
  totalSnapshotsEvaluated: number;
  eligibleTokensFound: number;
  totalTrades: number;
  winningTrades: number;
  losingTrades: number;
  winRatePercent: number;
  initialCapitalUsd: number;
  finalCapitalUsd: number;
  netPnlUsd: number;
  totalReturnPercent: number;
  maxDrawdownPercent: number;
  profitFactor: number;
  avgHoldTimeMinutes: number;
  trades: BacktestTrade[];
  status: 'SUCCESS' | 'INSUFFICIENT_DATA' | 'ERROR';
  statusExplanation: string;
}

export type MarketPipelineStage =
  | 'IDLE'
  | 'CONNECTING'
  | 'FETCHING_MARKET'
  | 'DATA_RECEIVED'
  | 'ANALYZING_PAIRS'
  | 'COMPLETED'
  | 'NO_VALID_PAIRS'
  | 'SOURCE_UNAVAILABLE'
  | 'RATE_LIMITED'
  | 'DATABASE_ERROR'
  | 'ANALYSIS_ERROR';

export interface MarketPipelineStatus {
  stage: MarketPipelineStage;
  stageMessage: string;
  stageMessageAr: string;
  sourceStatus: 'HEALTHY' | 'CONNECTING' | 'RATE_LIMITED' | 'DOWN';
  lastFetchAttemptAt: number;
  lastSuccessfulFetchAt: number;
  pairsReceivedCount: number;
  pairsNormalizedCount: number;
  pairsQualifiedCount: number;
  pairsBlockedCount: number;
  pairsUnderReviewCount: number;
  rpcEnrichedCount: number;
  disqualificationReason?: string;
  disqualificationReasonAr?: string;
  lastError?: string;
}

export interface SystemHealthStatus {
  backend: 'HEALTHY' | 'DEGRADED' | 'DOWN';
  database: 'HEALTHY' | 'DEGRADED' | 'DOWN';
  dexScreener: 'HEALTHY' | 'RATE_LIMITED' | 'DOWN' | 'CACHED';
  solanaRpc: 'HEALTHY' | 'DEGRADED' | 'DOWN';
  scheduler: 'RUNNING' | 'STOPPED';
  pipeline: MarketPipelineStatus;
  uptimeSeconds: number;
  dbPath: string;
  lastSuccessfulSyncAt: number;
  totalTokensTracked: number;
  activeAlertsCount: number;
  version: string;
}

export interface SentinelSettings {
  language: 'ar' | 'en';
  timezone: string;
  operationalMode: OperationalMode;
  solPriceUsd: number;
  pollIntervalSeconds: number;
  riskThresholdBlocked: number;
  minLiquidityFilter: number;
  minVolumeFilter: number;
  autoPaperTradingEnabled: boolean;
}
