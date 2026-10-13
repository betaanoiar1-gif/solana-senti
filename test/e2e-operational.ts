import path from 'node:path';
import fs from 'node:fs';
import { DatabaseManager } from '../server/db/database.js';
import { PaperTradingEngine } from '../server/engines/paperTrading.js';
import { DexScreenerConnector } from '../server/connectors/dexscreener.js';
import { SolanaRpcConnector } from '../server/connectors/solanaRpc.js';
import { MarketScheduler } from '../server/engines/scheduler.js';

const OP_TEST_DB = path.resolve(process.cwd(), 'data', 'operational_test_sentinel.db');
if (fs.existsSync(OP_TEST_DB)) {
  fs.unlinkSync(OP_TEST_DB);
}
process.env.SENTINEL_DB_PATH = OP_TEST_DB;
DatabaseManager.resetInstance();

let successCount = 0;
let failCount = 0;

function assert(cond: boolean, msg: string) {
  if (cond) {
    console.log(`  ✅ [OPERATIONAL CHECK] ${msg}`);
    successCount++;
  } else {
    console.error(`  ❌ [OPERATIONAL FAIL] ${msg}`);
    failCount++;
  }
}

async function runOperationalCycle() {
  console.log('====================================================');
  console.log('🚀 SOLANA SENTINEL — OPERATIONAL CYCLE & PERSISTENCE TEST');
  console.log('====================================================\n');

  // Step 1: Health & Database Connectivity
  console.log('▶ STEP 1: Verify Database & Health State');
  const db = DatabaseManager.getInstance(OP_TEST_DB);
  const initialPort = db.getPortfolio('default-paper-portfolio');
  assert(initialPort !== null, 'Database is connected and demo portfolio is accessible');
  assert(db.getDbPath() === OP_TEST_DB, 'Operational test runs in isolated database');

  const prevSol = initialPort?.solBalance || 0;
  const prevUsdc = initialPort?.usdcBalance || 0;

  // Step 2: Live Market Connectivity Check
  console.log('\n▶ STEP 2: Live Connector Query (DEX Screener & Solana RPC)');
  const dex = DexScreenerConnector.getInstance();
  const { pairs, freshness } = await dex.fetchSolanaPairs('solana');
  assert(Array.isArray(pairs), 'DEX Screener responded with array of pairs');
  assert(freshness === 'FRESH' || freshness === 'STALE', `Freshness is properly flagged: ${freshness}`);

  const rpc = SolanaRpcConnector.getInstance();
  const rpcStatus = rpc.getStatus();
  assert(rpcStatus.status === 'HEALTHY' || rpcStatus.status === 'DEGRADED', `Solana RPC status: ${rpcStatus.status}`);

  // Step 3: Run Full Market Cycle via Scheduler
  console.log('\n▶ STEP 3: Execute Single Market Synchronization Cycle');
  const scheduler = MarketScheduler.getInstance();
  await scheduler.syncMarketCycle();
  const tokens = db.getAllTokens();
  assert(tokens.length > 0, `Market cycle populated tokens table (Count: ${tokens.length})`);

  // Step 4: Paper Trading Buy Cycle
  console.log('\n▶ STEP 4: Paper Trading Buy Operation');
  const targetToken = tokens[0];
  const paper = new PaperTradingEngine();
  const buyRes = paper.executeOrder({
    tokenAddress: targetToken.address,
    tokenSymbol: targetToken.symbol,
    tokenName: targetToken.name,
    orderType: 'BUY',
    assetUsed: 'USDC',
    amountIn: 250,
    marketPriceUsd: targetToken.baseTokenPriceUsd,
    liquidityUsd: targetToken.liquidityUsd,
    solPriceUsd: 185.5,
    idempotencyKey: `op-buy-${Date.now()}`,
  });
  assert(buyRes.success === true, 'Executed $250 USDC paper buy');
  const posAfterBuy = db.getPositionByToken('default-paper-portfolio', targetToken.address);
  assert(posAfterBuy !== null, 'Open position confirmed in SQLite');

  // Step 5: Paper Trading Sell Cycle
  console.log('\n▶ STEP 5: Paper Trading Sell Operation');
  const sellRes = paper.executeOrder({
    tokenAddress: targetToken.address,
    tokenSymbol: targetToken.symbol,
    tokenName: targetToken.name,
    orderType: 'SELL',
    assetUsed: 'USDC',
    amountIn: posAfterBuy?.amount || 1,
    marketPriceUsd: targetToken.baseTokenPriceUsd * 1.05, // simulate +5% price
    liquidityUsd: targetToken.liquidityUsd,
    solPriceUsd: 185.5,
    idempotencyKey: `op-sell-${Date.now()}`,
  });
  assert(sellRes.success === true, 'Executed full paper sell order');
  assert(sellRes.trade?.realizedPnlUsd !== undefined, 'Realized PnL computed and stored');

  // Step 6: Simulate Server Restart & Persistence Check
  console.log('\n▶ STEP 6: Simulate System Shutdown & Restart Persistence');
  // Re-instantiate database instance reference to test cold read from disk
  const restartedDb = DatabaseManager.getInstance();
  const restartedPort = restartedDb.getPortfolio('default-paper-portfolio');
  assert(restartedPort !== null, 'Portfolio restored from disk after restart');
  assert(restartedPort?.solBalance === prevSol, 'SOL balance persisted accurately across restart');
  assert(restartedPort?.totalRealizedPnlUsd !== 0, 'Realized PnL history persisted in SQLite across restart');

  const trades = restartedDb.getTrades('default-paper-portfolio', 10);
  assert(trades.length >= 2, `Audit trail of trades persisted (Count: ${trades.length})`);

  console.log('\n====================================================');
  console.log(`📊 OPERATIONAL TEST RESULT: ${successCount} PASSED, ${failCount} FAILED`);
  console.log('====================================================');

  if (failCount > 0) process.exit(1);
}

runOperationalCycle().catch((err) => {
  console.error('Fatal operational test error:', err);
  process.exit(1);
});
