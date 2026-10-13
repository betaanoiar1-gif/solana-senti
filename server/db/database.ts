import fs from 'node:fs';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import {
  AlertNotification,
  BacktestResult,
  MarketSnapshot,
  OperationalMode,
  PaperOrder,
  PaperPortfolio,
  PaperPosition,
  PaperTrade,
  SentinelSettings,
  StrategyConfig,
  TokenIntelligence,
} from '../types/index.js';

const DATA_DIR = path.resolve(process.cwd(), 'data');

export class DatabaseManager {
  private static instance: DatabaseManager | null = null;
  private db: DatabaseSync;
  private currentDbPath: string;

  private constructor(customPath?: string) {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
    this.currentDbPath = customPath || process.env.SENTINEL_DB_PATH || path.join(DATA_DIR, 'sentinel.db');
    this.db = new DatabaseSync(this.currentDbPath);
    this.initPragmas();
    this.runMigrations();
    this.seedDefaults();
  }

  public static getInstance(customPath?: string): DatabaseManager {
    if (!DatabaseManager.instance || (customPath && DatabaseManager.instance.currentDbPath !== customPath)) {
      DatabaseManager.instance = new DatabaseManager(customPath);
    }
    return DatabaseManager.instance;
  }

  public static resetInstance(): void {
    DatabaseManager.instance = null;
  }

  public getDbPath(): string {
    return this.currentDbPath;
  }

  private initPragmas() {
    this.db.exec(`
      PRAGMA journal_mode = WAL;
      PRAGMA synchronous = NORMAL;
      PRAGMA foreign_keys = ON;
    `);
  }

  private runMigrations() {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS schema_migrations (
        version INTEGER PRIMARY KEY,
        applied_at INTEGER NOT NULL
      );

      CREATE TABLE IF NOT EXISTS tokens (
        address TEXT PRIMARY KEY,
        symbol TEXT NOT NULL,
        name TEXT NOT NULL,
        decimals INTEGER NOT NULL DEFAULT 9,
        pair_address TEXT,
        dex_id TEXT,
        base_price_usd REAL NOT NULL DEFAULT 0,
        liquidity_usd REAL NOT NULL DEFAULT 0,
        fdv_usd REAL,
        volume_24h_usd REAL NOT NULL DEFAULT 0,
        pair_created_at INTEGER,
        first_seen_at INTEGER NOT NULL,
        last_seen_at INTEGER NOT NULL,
        lifecycle_stage TEXT NOT NULL DEFAULT 'DISCOVERED',
        is_watchlist INTEGER NOT NULL DEFAULT 0,
        tags_json TEXT NOT NULL DEFAULT '[]',
        risk_json TEXT NOT NULL,
        opportunity_json TEXT NOT NULL,
        science_data_json TEXT,
        freshness TEXT NOT NULL DEFAULT 'FRESH'
      );

      CREATE INDEX IF NOT EXISTS idx_tokens_watchlist ON tokens(is_watchlist);
      CREATE INDEX IF NOT EXISTS idx_tokens_lifecycle ON tokens(lifecycle_stage);
      CREATE INDEX IF NOT EXISTS idx_tokens_liquidity ON tokens(liquidity_usd);

      CREATE TABLE IF NOT EXISTS market_snapshots (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        token_address TEXT NOT NULL,
        timestamp INTEGER NOT NULL,
        price_usd REAL NOT NULL,
        liquidity_usd REAL NOT NULL,
        volume_24h_usd REAL NOT NULL,
        volume_1h_usd REAL,
        price_change_5m REAL,
        price_change_1h REAL,
        price_change_24h REAL,
        txns_24h_buys INTEGER NOT NULL DEFAULT 0,
        txns_24h_sells INTEGER NOT NULL DEFAULT 0,
        mode TEXT NOT NULL DEFAULT 'LIVE',
        FOREIGN KEY (token_address) REFERENCES tokens(address) ON DELETE CASCADE
      );

      CREATE INDEX IF NOT EXISTS idx_snapshots_token_time ON market_snapshots(token_address, timestamp);

      CREATE TABLE IF NOT EXISTS portfolios (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL,
        sol_balance REAL NOT NULL,
        usdc_balance REAL NOT NULL,
        initial_sol_balance REAL NOT NULL,
        initial_usdc_balance REAL NOT NULL,
        total_realized_pnl_usd REAL NOT NULL DEFAULT 0,
        mode TEXT NOT NULL DEFAULT 'DEMO'
      );

      CREATE TABLE IF NOT EXISTS positions (
        id TEXT PRIMARY KEY,
        portfolio_id TEXT NOT NULL,
        token_address TEXT NOT NULL,
        token_symbol TEXT NOT NULL,
        token_name TEXT NOT NULL,
        amount REAL NOT NULL,
        entry_price_usd REAL NOT NULL,
        current_price_usd REAL NOT NULL,
        cost_basis_usd REAL NOT NULL,
        stop_loss_price_usd REAL,
        take_profit_price_usd REAL,
        opened_at INTEGER NOT NULL,
        last_updated_at INTEGER NOT NULL,
        mode TEXT NOT NULL DEFAULT 'DEMO',
        FOREIGN KEY (portfolio_id) REFERENCES portfolios(id) ON DELETE CASCADE
      );

      CREATE INDEX IF NOT EXISTS idx_positions_portfolio ON positions(portfolio_id);

      CREATE TABLE IF NOT EXISTS orders (
        id TEXT PRIMARY KEY,
        idempotency_key TEXT UNIQUE,
        portfolio_id TEXT NOT NULL,
        token_address TEXT NOT NULL,
        token_symbol TEXT NOT NULL,
        order_type TEXT NOT NULL,
        asset_used TEXT NOT NULL,
        amount_in REAL NOT NULL,
        amount_out REAL NOT NULL,
        execution_price_usd REAL NOT NULL,
        fee_usd REAL NOT NULL,
        slippage_percent REAL NOT NULL,
        status TEXT NOT NULL,
        rejection_reason TEXT,
        created_at INTEGER NOT NULL,
        mode TEXT NOT NULL DEFAULT 'DEMO',
        FOREIGN KEY (portfolio_id) REFERENCES portfolios(id) ON DELETE CASCADE
      );

      CREATE INDEX IF NOT EXISTS idx_orders_idempotency ON orders(idempotency_key);

      CREATE TABLE IF NOT EXISTS trades (
        id TEXT PRIMARY KEY,
        order_id TEXT NOT NULL,
        portfolio_id TEXT NOT NULL,
        token_address TEXT NOT NULL,
        token_symbol TEXT NOT NULL,
        side TEXT NOT NULL,
        amount REAL NOT NULL,
        price_usd REAL NOT NULL,
        total_usd REAL NOT NULL,
        fee_usd REAL NOT NULL,
        realized_pnl_usd REAL,
        timestamp INTEGER NOT NULL,
        mode TEXT NOT NULL DEFAULT 'DEMO',
        FOREIGN KEY (portfolio_id) REFERENCES portfolios(id) ON DELETE CASCADE
      );

      CREATE INDEX IF NOT EXISTS idx_trades_portfolio ON trades(portfolio_id);
      CREATE INDEX IF NOT EXISTS idx_trades_time ON trades(timestamp);

      CREATE TABLE IF NOT EXISTS alerts (
        id TEXT PRIMARY KEY,
        type TEXT NOT NULL,
        title TEXT NOT NULL,
        message TEXT NOT NULL,
        severity TEXT NOT NULL,
        token_address TEXT,
        created_at INTEGER NOT NULL,
        is_read INTEGER NOT NULL DEFAULT 0
      );

      CREATE INDEX IF NOT EXISTS idx_alerts_read_time ON alerts(is_read, created_at);

      CREATE TABLE IF NOT EXISTS settings (
        key TEXT PRIMARY KEY,
        value_json TEXT NOT NULL,
        updated_at INTEGER NOT NULL
      );

      CREATE TABLE IF NOT EXISTS strategies (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        description TEXT NOT NULL,
        config_json TEXT NOT NULL,
        enabled INTEGER NOT NULL DEFAULT 1,
        updated_at INTEGER NOT NULL
      );

      CREATE TABLE IF NOT EXISTS backtest_runs (
        run_id TEXT PRIMARY KEY,
        strategy_id TEXT NOT NULL,
        strategy_name TEXT NOT NULL,
        started_at INTEGER NOT NULL,
        completed_at INTEGER NOT NULL,
        result_json TEXT NOT NULL,
        status TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS system_logs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        timestamp INTEGER NOT NULL,
        level TEXT NOT NULL,
        module TEXT NOT NULL,
        message TEXT NOT NULL,
        meta_json TEXT
      );
    `);
  }

  private seedDefaults() {
    // 1. Seed Default Demo Portfolio: 50 SOL and 5000 USDC (Only if not existing!)
    const existingPortfolio = this.db.prepare('SELECT id FROM portfolios WHERE id = ?').get('default-paper-portfolio');
    if (!existingPortfolio) {
      const now = Date.now();
      const stmt = this.db.prepare(`
        INSERT INTO portfolios (
          id, name, created_at, updated_at, sol_balance, usdc_balance,
          initial_sol_balance, initial_usdc_balance, total_realized_pnl_usd, mode
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);
      stmt.run(
        'default-paper-portfolio',
        'Primary Demo Portfolio',
        now,
        now,
        50.0, // 50 SOL
        5000.0, // 5000 USDC
        50.0,
        5000.0,
        0.0,
        'DEMO'
      );
    }

    // 2. Seed Default Settings
    const existingSettings = this.db.prepare('SELECT key FROM settings WHERE key = ?').get('app_settings');
    if (!existingSettings) {
      const defaultSettings: SentinelSettings = {
        language: 'ar',
        timezone: 'UTC',
        operationalMode: 'LIVE',
        solPriceUsd: 185.5,
        pollIntervalSeconds: 15,
        riskThresholdBlocked: 60,
        minLiquidityFilter: 5000,
        minVolumeFilter: 2000,
        autoPaperTradingEnabled: false,
      };
      const stmt = this.db.prepare('INSERT INTO settings (key, value_json, updated_at) VALUES (?, ?, ?)');
      stmt.run('app_settings', JSON.stringify(defaultSettings), Date.now());
    }

    // 3. Seed Default Strategies
    const defaultStrategies: StrategyConfig[] = [
      {
        id: 'strat-conservative',
        name: 'Conservative Sentinel',
        description: 'ينتقي العملات ذات السيولة العالية (> $50,000) وتقييم مخاطر PASS حصراً مع جني أرباح عند +25% ووقف خسارة -10%',
        minOpportunityScore: 75,
        maxRiskScore: 35,
        allowedRiskStatuses: ['PASS'],
        minLiquidityUsd: 50000,
        minVolume24hUsd: 25000,
        maxPairAgeHours: 168,
        stopLossPercent: 10,
        takeProfitPercent: 25,
        maxHoldTimeHours: 48,
        positionSizeUsd: 250,
        slippageModelPercent: 0.5,
        feeModelPercent: 0.25,
        enabled: true,
      },
      {
        id: 'strat-momentum',
        name: 'Momentum Breakout',
        description: 'يستهدف الزخم السريع للأزواج حديثة الإطلاق ذات تسارع حجم التداول (> $100,000) مع حماية ضد السحب المفاجئ',
        minOpportunityScore: 82,
        maxRiskScore: 45,
        allowedRiskStatuses: ['PASS', 'REVIEW'],
        minLiquidityUsd: 20000,
        minVolume24hUsd: 100000,
        maxPairAgeHours: 24,
        stopLossPercent: 15,
        takeProfitPercent: 45,
        maxHoldTimeHours: 12,
        positionSizeUsd: 150,
        slippageModelPercent: 1.0,
        feeModelPercent: 0.25,
        enabled: true,
      },
      {
        id: 'strat-desci-longevity',
        name: 'DeSci Longevity Scout',
        description: 'استراتيجية علمية متخصصة في توكنات Pump.science وDeSci المرتبطة بأبحاث إطالة العمر والتجارب الحيوية الموثقة',
        minOpportunityScore: 70,
        maxRiskScore: 40,
        allowedRiskStatuses: ['PASS', 'REVIEW'],
        minLiquidityUsd: 15000,
        minVolume24hUsd: 10000,
        maxPairAgeHours: 720,
        stopLossPercent: 12,
        takeProfitPercent: 35,
        maxHoldTimeHours: 72,
        positionSizeUsd: 200,
        slippageModelPercent: 0.75,
        feeModelPercent: 0.25,
        enabled: true,
      },
    ];

    for (const strat of defaultStrategies) {
      const exists = this.db.prepare('SELECT id FROM strategies WHERE id = ?').get(strat.id);
      if (!exists) {
        const stmt = this.db.prepare('INSERT INTO strategies (id, name, description, config_json, enabled, updated_at) VALUES (?, ?, ?, ?, ?, ?)');
        stmt.run(strat.id, strat.name, strat.description, JSON.stringify(strat), strat.enabled ? 1 : 0, Date.now());
      }
    }
  }

  // --- Transactional execution ---
  public transaction<T>(callback: () => T): T {
    this.db.exec('BEGIN IMMEDIATE;');
    try {
      const result = callback();
      this.db.exec('COMMIT;');
      return result;
    } catch (err) {
      this.db.exec('ROLLBACK;');
      throw err;
    }
  }

  // --- Tokens CRUD ---
  public upsertToken(token: TokenIntelligence): void {
    const stmt = this.db.prepare(`
      INSERT INTO tokens (
        address, symbol, name, decimals, pair_address, dex_id,
        base_price_usd, liquidity_usd, fdv_usd, volume_24h_usd,
        pair_created_at, first_seen_at, last_seen_at, lifecycle_stage,
        is_watchlist, tags_json, risk_json, opportunity_json, science_data_json, freshness
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(address) DO UPDATE SET
        symbol = excluded.symbol,
        name = excluded.name,
        pair_address = excluded.pair_address,
        dex_id = excluded.dex_id,
        base_price_usd = excluded.base_price_usd,
        liquidity_usd = excluded.liquidity_usd,
        fdv_usd = excluded.fdv_usd,
        volume_24h_usd = excluded.volume_24h_usd,
        last_seen_at = excluded.last_seen_at,
        lifecycle_stage = excluded.lifecycle_stage,
        tags_json = excluded.tags_json,
        risk_json = excluded.risk_json,
        opportunity_json = excluded.opportunity_json,
        science_data_json = excluded.science_data_json,
        freshness = excluded.freshness
    `);

    stmt.run(
      token.address,
      token.symbol,
      token.name,
      token.decimals,
      token.pairAddress || null,
      token.dexId || null,
      token.baseTokenPriceUsd,
      token.liquidityUsd,
      token.fdvUsd || null,
      token.volume24hUsd,
      token.pairCreatedAt || null,
      token.firstSeenAt,
      token.lastSeenAt,
      token.lifecycleStage,
      token.isWatchlist ? 1 : 0,
      JSON.stringify(token.tags || []),
      JSON.stringify(token.risk),
      JSON.stringify(token.opportunity),
      token.scienceData ? JSON.stringify(token.scienceData) : null,
      token.freshness
    );
  }

  public getAllTokens(): TokenIntelligence[] {
    const rows = this.db.prepare('SELECT * FROM tokens ORDER BY liquidity_usd DESC').all() as any[];
    return rows.map(r => this.mapRowToToken(r));
  }

  public getToken(address: string): TokenIntelligence | null {
    const row = this.db.prepare('SELECT * FROM tokens WHERE address = ?').get(address) as any;
    if (!row) return null;
    return this.mapRowToToken(row);
  }

  public toggleWatchlist(address: string): boolean {
    const token = this.getToken(address);
    if (!token) return false;
    const newState = !token.isWatchlist;
    const newStage = newState ? 'WATCHLIST' : (token.lifecycleStage === 'WATCHLIST' ? 'DISCOVERED' : token.lifecycleStage);
    this.db.prepare('UPDATE tokens SET is_watchlist = ?, lifecycle_stage = ? WHERE address = ?').run(
      newState ? 1 : 0,
      newStage,
      address
    );
    return newState;
  }

  private mapRowToToken(r: any): TokenIntelligence {
    let snapshots: MarketSnapshot[] = [];
    try {
      const snapRows = this.db.prepare(`
        SELECT * FROM market_snapshots WHERE token_address = ? ORDER BY timestamp DESC LIMIT 100
      `).all(r.address) as any[];
      snapshots = snapRows.reverse().map(s => ({
        id: s.id.toString(),
        tokenAddress: s.token_address,
        timestamp: s.timestamp,
        priceUsd: s.price_usd,
        liquidityUsd: s.liquidity_usd,
        volume24hUsd: s.volume_24h_usd,
        volume1hUsd: s.volume_1h_usd ?? undefined,
        priceChange5m: s.price_change_5m ?? undefined,
        priceChange1h: s.price_change_1h ?? undefined,
        priceChange24h: s.price_change_24h ?? undefined,
        txns24hBuys: s.txns_24h_buys,
        txns24hSells: s.txns_24h_sells,
        mode: s.mode as OperationalMode,
      }));
    } catch {
      snapshots = [];
    }

    return {
      address: r.address,
      symbol: r.symbol,
      name: r.name,
      decimals: r.decimals,
      pairAddress: r.pair_address || undefined,
      dexId: r.dex_id || undefined,
      baseTokenPriceUsd: r.base_price_usd,
      liquidityUsd: r.liquidity_usd,
      fdvUsd: r.fdv_usd || undefined,
      volume24hUsd: r.volume_24h_usd,
      pairCreatedAt: r.pair_created_at || undefined,
      firstSeenAt: r.first_seen_at,
      lastSeenAt: r.last_seen_at,
      lifecycleStage: r.lifecycle_stage,
      isWatchlist: Boolean(r.is_watchlist),
      tags: JSON.parse(r.tags_json || '[]'),
      risk: JSON.parse(r.risk_json),
      opportunity: JSON.parse(r.opportunity_json),
      scienceData: r.science_data_json ? JSON.parse(r.science_data_json) : undefined,
      freshness: r.freshness,
      snapshots,
    };
  }

  // --- Snapshots ---
  public recordSnapshot(snap: MarketSnapshot): void {
    const stmt = this.db.prepare(`
      INSERT INTO market_snapshots (
        token_address, timestamp, price_usd, liquidity_usd,
        volume_24h_usd, volume_1h_usd, price_change_5m,
        price_change_1h, price_change_24h, txns_24h_buys, txns_24h_sells, mode
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    stmt.run(
      snap.tokenAddress,
      snap.timestamp,
      snap.priceUsd,
      snap.liquidityUsd,
      snap.volume24hUsd,
      snap.volume1hUsd || null,
      snap.priceChange5m || null,
      snap.priceChange1h || null,
      snap.priceChange24h || null,
      snap.txns24hBuys || 0,
      snap.txns24hSells || 0,
      snap.mode
    );
  }

  public getHistoricalSnapshots(tokenAddress: string, limit = 100): MarketSnapshot[] {
    const rows = this.db.prepare(`
      SELECT * FROM market_snapshots WHERE token_address = ? ORDER BY timestamp DESC LIMIT ?
    `).all(tokenAddress, limit) as any[];
    return rows.reverse().map(s => ({
      id: s.id.toString(),
      tokenAddress: s.token_address,
      timestamp: s.timestamp,
      priceUsd: s.price_usd,
      liquidityUsd: s.liquidity_usd,
      volume24hUsd: s.volume_24h_usd,
      volume1hUsd: s.volume_1h_usd ?? undefined,
      priceChange5m: s.price_change_5m ?? undefined,
      priceChange1h: s.price_change_1h ?? undefined,
      priceChange24h: s.price_change_24h ?? undefined,
      txns24hBuys: s.txns_24h_buys,
      txns24hSells: s.txns_24h_sells,
      mode: s.mode as OperationalMode,
    }));
  }

  // --- Portfolio & Paper Trading ---
  public getPortfolio(id = 'default-paper-portfolio'): PaperPortfolio | null {
    const row = this.db.prepare('SELECT * FROM portfolios WHERE id = ?').get(id) as any;
    if (!row) return null;
    return {
      id: row.id,
      name: row.name,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      solBalance: row.sol_balance,
      usdcBalance: row.usdc_balance,
      initialSolBalance: row.initial_sol_balance,
      initialUsdcBalance: row.initial_usdc_balance,
      totalRealizedPnlUsd: row.total_realized_pnl_usd,
      mode: row.mode as OperationalMode,
    };
  }

  public updatePortfolioBalances(id: string, sol: number, usdc: number, realizedPnlUsdDelta = 0): void {
    const stmt = this.db.prepare(`
      UPDATE portfolios
      SET sol_balance = ?, usdc_balance = ?, total_realized_pnl_usd = total_realized_pnl_usd + ?, updated_at = ?
      WHERE id = ?
    `);
    stmt.run(sol, usdc, realizedPnlUsdDelta, Date.now(), id);
  }

  public resetPortfolio(id = 'default-paper-portfolio'): void {
    this.transaction(() => {
      const now = Date.now();
      this.db.prepare(`
        UPDATE portfolios
        SET sol_balance = initial_sol_balance, usdc_balance = initial_usdc_balance,
            total_realized_pnl_usd = 0, updated_at = ?
        WHERE id = ?
      `).run(now, id);
      this.db.prepare('DELETE FROM positions WHERE portfolio_id = ?').run(id);
      this.db.prepare('DELETE FROM orders WHERE portfolio_id = ?').run(id);
      this.db.prepare('DELETE FROM trades WHERE portfolio_id = ?').run(id);
    });
  }

  public getPositions(portfolioId = 'default-paper-portfolio'): PaperPosition[] {
    const rows = this.db.prepare('SELECT * FROM positions WHERE portfolio_id = ?').all(portfolioId) as any[];
    return rows.map(r => {
      const currentValueUsd = r.amount * r.current_price_usd;
      const unrealizedPnlUsd = currentValueUsd - r.cost_basis_usd;
      const unrealizedPnlPercent = r.cost_basis_usd > 0 ? (unrealizedPnlUsd / r.cost_basis_usd) * 100 : 0;
      return {
        id: r.id,
        portfolioId: r.portfolio_id,
        tokenAddress: r.token_address,
        tokenSymbol: r.token_symbol,
        tokenName: r.token_name,
        amount: r.amount,
        entryPriceUsd: r.entry_price_usd,
        currentPriceUsd: r.current_price_usd,
        costBasisUsd: r.cost_basis_usd,
        currentValueUsd,
        unrealizedPnlUsd,
        unrealizedPnlPercent,
        stopLossPriceUsd: r.stop_loss_price_usd || undefined,
        takeProfitPriceUsd: r.take_profit_price_usd || undefined,
        openedAt: r.opened_at,
        lastUpdatedAt: r.last_updated_at,
        mode: r.mode as OperationalMode,
      };
    });
  }

  public getPositionByToken(portfolioId: string, tokenAddress: string): PaperPosition | null {
    const r = this.db.prepare('SELECT * FROM positions WHERE portfolio_id = ? AND token_address = ?').get(portfolioId, tokenAddress) as any;
    if (!r) return null;
    const currentValueUsd = r.amount * r.current_price_usd;
    const unrealizedPnlUsd = currentValueUsd - r.cost_basis_usd;
    const unrealizedPnlPercent = r.cost_basis_usd > 0 ? (unrealizedPnlUsd / r.cost_basis_usd) * 100 : 0;
    return {
      id: r.id,
      portfolioId: r.portfolio_id,
      tokenAddress: r.token_address,
      tokenSymbol: r.token_symbol,
      tokenName: r.token_name,
      amount: r.amount,
      entryPriceUsd: r.entry_price_usd,
      currentPriceUsd: r.current_price_usd,
      costBasisUsd: r.cost_basis_usd,
      currentValueUsd,
      unrealizedPnlUsd,
      unrealizedPnlPercent,
      stopLossPriceUsd: r.stop_loss_price_usd || undefined,
      takeProfitPriceUsd: r.take_profit_price_usd || undefined,
      openedAt: r.opened_at,
      lastUpdatedAt: r.last_updated_at,
      mode: r.mode as OperationalMode,
    };
  }

  public upsertPosition(pos: PaperPosition): void {
    const stmt = this.db.prepare(`
      INSERT INTO positions (
        id, portfolio_id, token_address, token_symbol, token_name,
        amount, entry_price_usd, current_price_usd, cost_basis_usd,
        stop_loss_price_usd, take_profit_price_usd, opened_at, last_updated_at, mode
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET
        amount = excluded.amount,
        entry_price_usd = excluded.entry_price_usd,
        current_price_usd = excluded.current_price_usd,
        cost_basis_usd = excluded.cost_basis_usd,
        stop_loss_price_usd = excluded.stop_loss_price_usd,
        take_profit_price_usd = excluded.take_profit_price_usd,
        last_updated_at = excluded.last_updated_at
    `);
    stmt.run(
      pos.id,
      pos.portfolioId,
      pos.tokenAddress,
      pos.tokenSymbol,
      pos.tokenName,
      pos.amount,
      pos.entryPriceUsd,
      pos.currentPriceUsd,
      pos.costBasisUsd,
      pos.stopLossPriceUsd || null,
      pos.takeProfitPriceUsd || null,
      pos.openedAt,
      pos.lastUpdatedAt,
      pos.mode
    );
  }

  public deletePosition(positionId: string): void {
    this.db.prepare('DELETE FROM positions WHERE id = ?').run(positionId);
  }

  public updatePositionPrice(tokenAddress: string, newPriceUsd: number): void {
    this.db.prepare(`
      UPDATE positions
      SET current_price_usd = ?, last_updated_at = ?
      WHERE token_address = ?
    `).run(newPriceUsd, Date.now(), tokenAddress);
  }

  // --- Orders & Trades ---
  public recordOrder(order: PaperOrder): void {
    const stmt = this.db.prepare(`
      INSERT INTO orders (
        id, idempotency_key, portfolio_id, token_address, token_symbol,
        order_type, asset_used, amount_in, amount_out, execution_price_usd,
        fee_usd, slippage_percent, status, rejection_reason, created_at, mode
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    stmt.run(
      order.id,
      order.idempotencyKey || null,
      order.portfolioId,
      order.tokenAddress,
      order.tokenSymbol,
      order.orderType,
      order.assetUsed,
      order.amountIn,
      order.amountOut,
      order.executionPriceUsd,
      order.feeUsd,
      order.slippagePercent,
      order.status,
      order.rejectionReason || null,
      order.createdAt,
      order.mode
    );
  }

  public isIdempotencyKeyUsed(key?: string): boolean {
    if (!key) return false;
    const r = this.db.prepare('SELECT id FROM orders WHERE idempotency_key = ?').get(key);
    return Boolean(r);
  }

  public recordTrade(trade: PaperTrade): void {
    const stmt = this.db.prepare(`
      INSERT INTO trades (
        id, order_id, portfolio_id, token_address, token_symbol,
        side, amount, price_usd, total_usd, fee_usd, realized_pnl_usd, timestamp, mode
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    stmt.run(
      trade.id,
      trade.orderId,
      trade.portfolioId,
      trade.tokenAddress,
      trade.tokenSymbol,
      trade.side,
      trade.amount,
      trade.priceUsd,
      trade.totalUsd,
      trade.feeUsd,
      trade.realizedPnlUsd || null,
      trade.timestamp,
      trade.mode
    );
  }

  public getTrades(portfolioId = 'default-paper-portfolio', limit = 50): PaperTrade[] {
    const rows = this.db.prepare(`
      SELECT * FROM trades WHERE portfolio_id = ? ORDER BY timestamp DESC LIMIT ?
    `).all(portfolioId, limit) as any[];
    return rows.map(r => ({
      id: r.id,
      orderId: r.order_id,
      portfolioId: r.portfolio_id,
      tokenAddress: r.token_address,
      tokenSymbol: r.token_symbol,
      side: r.side,
      amount: r.amount,
      priceUsd: r.price_usd,
      totalUsd: r.total_usd,
      feeUsd: r.fee_usd,
      realizedPnlUsd: r.realized_pnl_usd ?? undefined,
      timestamp: r.timestamp,
      mode: r.mode as OperationalMode,
    }));
  }

  // --- Alerts ---
  public addAlert(alert: Omit<AlertNotification, 'id' | 'createdAt' | 'isRead'>): AlertNotification {
    const id = `alert-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
    const now = Date.now();
    const stmt = this.db.prepare(`
      INSERT INTO alerts (id, type, title, message, severity, token_address, created_at, is_read)
      VALUES (?, ?, ?, ?, ?, ?, ?, 0)
    `);
    stmt.run(id, alert.type, alert.title, alert.message, alert.severity, alert.tokenAddress || null, now);
    return {
      id,
      ...alert,
      createdAt: now,
      isRead: false,
    };
  }

  public getAlerts(limit = 40): AlertNotification[] {
    const rows = this.db.prepare('SELECT * FROM alerts ORDER BY created_at DESC LIMIT ?').all(limit) as any[];
    return rows.map(r => ({
      id: r.id,
      type: r.type,
      title: r.title,
      message: r.message,
      severity: r.severity,
      tokenAddress: r.token_address || undefined,
      createdAt: r.created_at,
      isRead: Boolean(r.is_read),
    }));
  }

  public markAlertAsRead(id: string): void {
    this.db.prepare('UPDATE alerts SET is_read = 1 WHERE id = ?').run(id);
  }

  public clearAllAlerts(): void {
    this.db.prepare('DELETE FROM alerts').run();
  }

  // --- Settings ---
  public getSettings(): SentinelSettings {
    const row = this.db.prepare('SELECT value_json FROM settings WHERE key = ?').get('app_settings') as any;
    if (!row) {
      return {
        language: 'ar',
        timezone: 'UTC',
        operationalMode: 'LIVE',
        solPriceUsd: 185.5,
        pollIntervalSeconds: 15,
        riskThresholdBlocked: 60,
        minLiquidityFilter: 5000,
        minVolumeFilter: 2000,
        autoPaperTradingEnabled: false,
      };
    }
    return JSON.parse(row.value_json);
  }

  public updateSettings(settings: Partial<SentinelSettings>): SentinelSettings {
    const current = this.getSettings();
    const updated = { ...current, ...settings };
    this.db.prepare('UPDATE settings SET value_json = ?, updated_at = ? WHERE key = ?').run(
      JSON.stringify(updated),
      Date.now(),
      'app_settings'
    );
    return updated;
  }

  // --- Strategies & Backtests ---
  public getStrategies(): StrategyConfig[] {
    const rows = this.db.prepare('SELECT config_json FROM strategies').all() as any[];
    return rows.map(r => JSON.parse(r.config_json));
  }

  public getStrategy(id: string): StrategyConfig | null {
    const row = this.db.prepare('SELECT config_json FROM strategies WHERE id = ?').get(id) as any;
    if (!row) return null;
    return JSON.parse(row.config_json);
  }

  public saveBacktestRun(result: BacktestResult): void {
    const stmt = this.db.prepare(`
      INSERT INTO backtest_runs (run_id, strategy_id, strategy_name, started_at, completed_at, result_json, status)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `);
    stmt.run(
      result.runId,
      result.strategyId,
      result.strategyName,
      result.startedAt,
      result.completedAt,
      JSON.stringify(result),
      result.status
    );
  }

  public getBacktestRuns(limit = 20): BacktestResult[] {
    const rows = this.db.prepare('SELECT result_json FROM backtest_runs ORDER BY completed_at DESC LIMIT ?').all(limit) as any[];
    return rows.map(r => JSON.parse(r.result_json));
  }
}
