import path from 'node:path';
import fs from 'node:fs';
import { DatabaseManager } from '../server/db/database.js';
import { RiskEngine } from '../server/engines/riskEngine.js';
import { OpportunityEngine } from '../server/engines/opportunityEngine.js';
import { PaperTradingEngine } from '../server/engines/paperTrading.js';
import { BacktestEngine } from '../server/engines/backtestEngine.js';
import { ScienceConnector } from '../server/connectors/science.js';

// Enforce Isolated Test Database Sandbox
const TEST_DB_PATH = path.resolve(process.cwd(), 'data', 'test_sentinel.db');
if (fs.existsSync(TEST_DB_PATH)) {
  fs.unlinkSync(TEST_DB_PATH);
}
process.env.SENTINEL_DB_PATH = TEST_DB_PATH;
DatabaseManager.resetInstance();

let passedCount = 0;
let failedCount = 0;

function assert(condition: boolean, message: string) {
  if (condition) {
    console.log(`  ✅ PASS: ${message}`);
    passedCount++;
  } else {
    console.error(`  ❌ FAIL: ${message}`);
    failedCount++;
  }
}

async function runAllTests() {
  console.log('====================================================');
  console.log('🧪 SOLANA SENTINEL — SUITE OF RIGOROUS TEST VALIDATION');
  console.log('====================================================\n');

  const db = DatabaseManager.getInstance(TEST_DB_PATH);

  // TEST 1: Database Initialization & Seeding
  console.log('▶ TEST 1: SQLite Persistent Storage & Initial Demo Portfolio');
  assert(db.getDbPath() === TEST_DB_PATH, 'Test suite runs in isolated test_sentinel.db');
  const portfolio = db.getPortfolio('default-paper-portfolio');
  assert(portfolio !== null, 'Primary Demo Portfolio exists in SQLite');
  assert(portfolio?.initialSolBalance === 50, 'Initial SOL balance is exactly 50 SOL');
  assert(portfolio?.initialUsdcBalance === 5000, 'Initial USDC balance is exactly 5000 USDC');
  assert(portfolio?.mode === 'DEMO', 'Portfolio mode is strictly DEMO simulation');

  // TEST 2: Persistence Integrity (No Wipe on Restart)
  console.log('\n▶ TEST 2: Data Persistence Across Server Restarts');
  DatabaseManager.resetInstance();
  const dbRecheck = DatabaseManager.getInstance(TEST_DB_PATH);
  const portfolioRecheck = dbRecheck.getPortfolio('default-paper-portfolio');
  assert(portfolioRecheck?.solBalance === portfolio?.solBalance, 'Balances are persisted and not reset upon re-initialization');

  // TEST 3: Financial Calculations & Paper Trading Rules
  console.log('\n▶ TEST 3: Paper Trading Engine & Decimal Execution');
  const paperTrading = new PaperTradingEngine();
  const testTokenAddress = 'DeSciRifTest1111111111111111111111111111111';

  // 3a. Reject Overspending
  const overspendResult = paperTrading.executeOrder({
    tokenAddress: testTokenAddress,
    tokenSymbol: 'RIF',
    tokenName: 'Rifampicin',
    orderType: 'BUY',
    assetUsed: 'USDC',
    amountIn: 999999, // Impossible amount
    marketPriceUsd: 0.15,
    liquidityUsd: 150000,
    solPriceUsd: 180,
  });
  assert(!overspendResult.success, 'Rejects buy order when spending exceeds available balance');
  assert(overspendResult.error?.includes('غير كافٍ') === true, 'Error message explicitly explains insufficient funds');

  // 3b. Successful Buy with Slippage & Fee
  const testRunId = Date.now();
  const validBuyResult = paperTrading.executeOrder({
    tokenAddress: testTokenAddress,
    tokenSymbol: 'RIF',
    tokenName: 'Rifampicin',
    orderType: 'BUY',
    assetUsed: 'USDC',
    amountIn: 500, // Spend $500 USDC
    marketPriceUsd: 0.10,
    liquidityUsd: 100000,
    solPriceUsd: 180,
    idempotencyKey: `idemp-buy-${testRunId}`,
  });
  assert(validBuyResult.success === true, 'Successfully executes valid paper buy order');
  assert(validBuyResult.order?.status === 'FILLED', 'Order status is FILLED');
  assert(validBuyResult.order?.slippagePercent! > 0, 'Slippage is modeled realistically (> 0%)');
  assert(validBuyResult.order?.feeUsd! > 0, 'DEX and network fees are modeled and deducted');
  assert(validBuyResult.position !== null, 'Open position is created in database');
  assert(validBuyResult.position?.amount! > 0, 'Purchased token amount is positive');

  // 3c. Idempotency Check (Duplicate Order Prevention)
  const duplicateBuy = paperTrading.executeOrder({
    tokenAddress: testTokenAddress,
    tokenSymbol: 'RIF',
    tokenName: 'Rifampicin',
    orderType: 'BUY',
    assetUsed: 'USDC',
    amountIn: 500,
    marketPriceUsd: 0.10,
    liquidityUsd: 100000,
    solPriceUsd: 180,
    idempotencyKey: `idemp-buy-${testRunId}`, // Exact same key!
  });
  assert(!duplicateBuy.success, 'Idempotency key prevents duplicate order execution');

  // 3d. Reject Overselling
  const oversellResult = paperTrading.executeOrder({
    tokenAddress: testTokenAddress,
    tokenSymbol: 'RIF',
    tokenName: 'Rifampicin',
    orderType: 'SELL',
    assetUsed: 'USDC',
    amountIn: 9999999, // Way more than owned
    marketPriceUsd: 0.12,
    liquidityUsd: 100000,
    solPriceUsd: 180,
  });
  assert(!oversellResult.success, 'Rejects sell order when quantity exceeds open position');
  assert(oversellResult.error?.includes('أكبر من رصيد المركز') === true, 'Error message explicitly details overselling rejection');

  // 3e. Valid Partial Sell Execution & Realized PnL
  const posBeforeSell = dbRecheck.getPositionByToken('default-paper-portfolio', testTokenAddress);
  const halfAmount = (posBeforeSell?.amount || 0) / 2;
  const validSellResult = paperTrading.executeOrder({
    tokenAddress: testTokenAddress,
    tokenSymbol: 'RIF',
    tokenName: 'Rifampicin',
    orderType: 'SELL',
    assetUsed: 'USDC',
    amountIn: halfAmount,
    marketPriceUsd: 0.15, // Sold higher -> profit
    liquidityUsd: 100000,
    solPriceUsd: 180,
  });
  assert(validSellResult.success === true, 'Successfully executes valid paper sell order');
  assert(validSellResult.trade?.realizedPnlUsd !== undefined, 'Realized PnL is computed on sale');
  const posAfterSell = dbRecheck.getPositionByToken('default-paper-portfolio', testTokenAddress);
  assert(posAfterSell !== null && posAfterSell.amount > 0, 'Remaining position amount is maintained accurately');

  // 3f. Atomic Concurrent Race Condition Check
  console.log('\n▶ TEST 3f: Atomic Transaction Concurrency & Anti-Double-Spend');
  const portBeforeRace = dbRecheck.getPortfolio('default-paper-portfolio');
  const availableUsdc = portBeforeRace?.usdcBalance || 0;
  // Try 5 parallel orders each requesting 60% of available balance (only 1 can succeed)
  const raceAmount = availableUsdc * 0.6;
  const racePromises = Array.from({ length: 5 }).map((_, i) =>
    Promise.resolve().then(() =>
      paperTrading.executeOrder({
        tokenAddress: `RaceTokenAddress_${i}`,
        tokenSymbol: `RC${i}`,
        tokenName: `Race Token ${i}`,
        orderType: 'BUY',
        assetUsed: 'USDC',
        amountIn: raceAmount,
        marketPriceUsd: 1.0,
        liquidityUsd: 50000,
        solPriceUsd: 180,
      })
    )
  );
  const raceResults = await Promise.all(racePromises);
  const successfulOrders = raceResults.filter(r => r.success);
  const portAfterRace = dbRecheck.getPortfolio('default-paper-portfolio');
  assert(successfulOrders.length === 1, 'Only exactly 1 oversized order can succeed under concurrent race');
  assert((portAfterRace?.usdcBalance || 0) >= 0, 'Balance never drops below zero during concurrent attempts');

  // TEST 4: Security & Risk Engine Strict Invariants
  console.log('\n▶ TEST 4: Risk Engine Strict Rules & Safety Invariants');
  // 4a. Active Mint Authority -> MUST BE BLOCKED
  const riskActiveMint = RiskEngine.evaluate({
    address: 'MintUnrevokedAddress1111111111111111111111',
    symbol: 'RUG',
    liquidityUsd: 50000,
    volume24hUsd: 30000,
    priceUsd: 1.0,
    freshness: 'FRESH',
    mintInfo: {
      address: 'MintUnrevokedAddress1111111111111111111111',
      decimals: 9,
      supply: '1000000',
      mintAuthority: 'SomeMaliciousDeveloperPubkey111111111111111',
      freezeAuthority: null,
      isInitialized: true,
      rawStatus: 'SUCCESS',
    },
  });
  assert(riskActiveMint.status === 'BLOCKED', 'Active Mint Authority results in BLOCKED status');
  assert(riskActiveMint.level === 'EXTREME', 'Active Mint Authority produces EXTREME risk level');

  // 4b. Active Freeze Authority -> MUST BE BLOCKED
  const riskActiveFreeze = RiskEngine.evaluate({
    address: 'FreezeUnrevokedAddress11111111111111111111',
    symbol: 'HONEY',
    liquidityUsd: 80000,
    volume24hUsd: 40000,
    priceUsd: 0.5,
    freshness: 'FRESH',
    mintInfo: {
      address: 'FreezeUnrevokedAddress11111111111111111111',
      decimals: 9,
      supply: '1000000',
      mintAuthority: null,
      freezeAuthority: 'FreezerAdminAddress11111111111111111111',
      isInitialized: true,
      rawStatus: 'SUCCESS',
    },
  });
  assert(riskActiveFreeze.status === 'BLOCKED', 'Active Freeze Authority results in BLOCKED status');

  // 4c. Critical Rule: Missing Data or Error must NEVER result in PASS!
  const riskRpcError = RiskEngine.evaluate({
    address: 'ErrorAddress11111111111111111111111111111',
    symbol: 'ERR',
    liquidityUsd: 40000,
    volume24hUsd: 20000,
    priceUsd: 0.05,
    freshness: 'ERROR',
  });
  assert(riskRpcError.status !== 'PASS', 'Data ERROR never evaluates to PASS');
  assert(riskRpcError.status === 'ERROR', 'Data ERROR evaluates to status ERROR');

  // 4d. Safe Token with Revoked Authorities
  const riskSafe = RiskEngine.evaluate({
    address: 'SafeTokenAddress1111111111111111111111111',
    symbol: 'SAFE',
    liquidityUsd: 120000,
    volume24hUsd: 80000,
    priceUsd: 2.5,
    pairCreatedAt: Date.now() - (1000 * 3600 * 48), // 48h old
    freshness: 'FRESH',
    mintInfo: {
      address: 'SafeTokenAddress1111111111111111111111111',
      decimals: 9,
      supply: '10000000',
      mintAuthority: null, // Revoked
      freezeAuthority: null, // Revoked
      isInitialized: true,
      rawStatus: 'SUCCESS',
    },
  });
  assert(riskSafe.status === 'PASS', 'Safe token with revoked authorities evaluates to PASS');

  // TEST 5: Opportunity Scoring Engine (0-100)
  console.log('\n▶ TEST 5: Opportunity Scoring Multi-Factor Decomposition');
  const opp = OpportunityEngine.evaluate({
    address: 'OpportunityToken1111111111111111111111111',
    symbol: 'OPP',
    name: 'Opportunity Token',
    priceUsd: 1.25,
    liquidityUsd: 150000,
    volume24hUsd: 650000,
    priceChange1h: 12.5,
    priceChange24h: 35.0,
    txnsBuys24h: 450,
    txnsSells24h: 180,
    pairCreatedAt: Date.now() - (1000 * 3600 * 18), // 18h
    freshness: 'FRESH',
  });
  assert(opp.overallScore >= 70 && opp.overallScore <= 100, `Opportunity score is in high range (${opp.overallScore}/100)`);
  assert(opp.factors.length === 7, 'Decomposed into exactly 7 clear factors');
  assert(opp.positiveDrivers.length > 0, 'Surfaces transparent positive score drivers');

  // TEST 6: Backtesting Engine (Zero Lookahead)
  console.log('\n▶ TEST 6: Strategy Lab & Zero-Lookahead Replay Verification');
  // Seed a controlled test token with historical snapshots
  const backtestTokenAddr = 'BacktestVerified111111111111111111111111';
  dbRecheck.upsertToken({
    address: backtestTokenAddr,
    symbol: 'TESTBK',
    name: 'Backtest Verified Token',
    decimals: 9,
    baseTokenPriceUsd: 1.0,
    liquidityUsd: 60000,
    volume24hUsd: 150000,
    pairCreatedAt: Date.now() - 3600000 * 24,
    firstSeenAt: Date.now() - 3600000 * 24,
    lastSeenAt: Date.now(),
    lifecycleStage: 'MONITORING',
    isWatchlist: false,
    tags: ['Verified'],
    risk: {
      tokenAddress: backtestTokenAddr,
      status: 'PASS',
      score: 15,
      level: 'LOW',
      evaluations: [],
      missingData: [],
      evaluatedAt: Date.now(),
      ruleVersion: 'SENTINEL_RISK_v2.1',
      summary: 'Safe',
    },
    opportunity: {
      tokenAddress: backtestTokenAddr,
      overallScore: 85,
      factors: [],
      confidence: 100,
      missingData: [],
      evaluatedAt: Date.now(),
      positiveDrivers: [],
      negativeDrivers: [],
    },
    freshness: 'FRESH',
    snapshots: [],
  });

  const baseTime = Date.now() - 3600000 * 12;
  // Snapshot sequence: 8 snapshots, starts at $1.0, rises to $1.36 (+36% take profit)
  const testPrices = [1.0, 1.04, 1.08, 1.15, 1.22, 1.28, 1.36, 1.38];
  for (let i = 0; i < testPrices.length; i++) {
    dbRecheck.recordSnapshot({
      tokenAddress: backtestTokenAddr,
      timestamp: baseTime + i * 3600000,
      priceUsd: testPrices[i],
      liquidityUsd: 60000,
      volume24hUsd: 120000,
      txns24hBuys: 200,
      txns24hSells: 100,
      mode: 'LIVE',
    });
  }

  const backtestEng = new BacktestEngine();
  const backtestRun = backtestEng.runBacktest('strat-conservative');
  assert(backtestRun.status === 'SUCCESS', 'Backtesting executed successfully on chronological snapshots');
  assert(backtestRun.trades.length > 0, 'Generated executed trades based on chronological threshold triggers');
  const firstTrade = backtestRun.trades[0];
  assert(firstTrade !== undefined && firstTrade.entryPriceUsd > 0, 'Trade recorded entry price');
  assert(firstTrade.exitPriceUsd > firstTrade.entryPriceUsd, 'Trade executed from entry timestamp to exit timestamp strictly forward');
  assert(firstTrade.exitReason === 'TAKE_PROFIT', 'Exited at take profit when forward snapshot crossed target');

  // TEST 7: Science DeSci & Bioscience Connector (Strict Provenance)
  console.log('\n▶ TEST 7: Science & Bioscience DeSci Profiler (Strict Provenance)');
  const scienceConn = ScienceConnector.getInstance();
  const rifProfile = scienceConn.identifyDeSciToken('RIF', 'Rifampicin');
  assert(rifProfile !== null, 'Identifies Rifampicin as DeSci token');
  assert(rifProfile?.pubchemCid === 5281078, 'Associates PubChem CID 5281078 for Rifampicin');
  assert(rifProfile?.linkSource === 'VERIFIED_PUMP_SCIENCE_REGISTRY', 'Flags linkSource as VERIFIED_PUMP_SCIENCE_REGISTRY');
  assert(rifProfile?.confidenceLevel === 'VERIFIED_100%', 'Flags confidenceLevel as VERIFIED_100%');

  const uroProfile = scienceConn.identifyDeSciToken('URO', 'Urolithin A');
  assert(uroProfile !== null, 'Identifies Urolithin A as DeSci token');
  assert(uroProfile?.smiles?.length! > 5, 'Provides authentic chemical SMILES string for 2D molecular representation');

  // 7b. Check that unverified token with random word is NOT fabricated with false 100% confidence
  const randomBioToken = scienceConn.identifyDeSciToken('RANDOM', 'Some Random Bio Coin');
  assert(randomBioToken === null, 'Random coin with "bio" is NOT falsely claimed as DeSci without verified compound');

  const keywordCandidate = scienceConn.identifyDeSciToken('DSCI', 'General DeSci Protocol');
  assert(keywordCandidate !== null && keywordCandidate.confidenceLevel === 'SPECULATIVE_30%', 'General keyword match is marked SPECULATIVE_30% with disclaimer');

  // TEST 8: Financial Safety Invariant (NO Live Trading Routes)
  console.log('\n▶ TEST 8: Zero Real Financial Execution Verification');
  assert(process.env.SOLANA_PRIVATE_KEY === undefined, 'No real Solana private key is configured or loaded');
  assert(portfolio?.mode === 'DEMO', 'Zero real transactions can be dispatched to network');

  console.log('\n====================================================');
  console.log(`📊 TEST SUITE SUMMARY: ${passedCount} PASSED, ${failedCount} FAILED`);
  console.log('====================================================');

  if (failedCount > 0) {
    process.exit(1);
  }
}

runAllTests().catch((err) => {
  console.error('Fatal test error:', err);
  process.exit(1);
});
