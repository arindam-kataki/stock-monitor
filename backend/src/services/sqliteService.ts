// backend/src/services/sqliteService.ts
import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';

export interface StockData {
  symbol: string;
  date?: string;
  timestamp?: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export interface Category {
  id: string;
  name: string;
  icon: string;
  description?: string;
  color?: string;
  order_index: number;
  is_active: boolean;
  stocks: Stock[];
}

// Also add the Stock interface if it doesn't exist
export interface Stock {
  symbol: string;
  name: string;
  price: number;
  previousClose: number;
  change: number;
  changePercent: number;
  volume: number;
  marketCap?: string;
  sector?: string;
}

export interface StockMetadata {
  symbol: string;
  name: string;
  category_id: string;
  market_cap?: string;
  sector?: string;
  description?: string;
  is_active: boolean;
}

interface CategoryRow {
  id: string;
  name: string;
  icon: string;
  description: string | null; // SQLite returns null, not undefined
  color: string | null;
  order_index: number;
  is_active: number; // SQLite stores boolean as 0/1
  created_at: string;
  updated_at: string;
}

interface StockRow {
  symbol: string;
  name: string;
  category_id: string;
  market_cap: string | null;
  sector: string | null;
  description: string | null;
  is_active: number; // SQLite stores boolean as 0/1
  created_at: string;
  updated_at: string;
}

export class StockDatabase {
  private db: Database.Database;
  private dataDir: string;

  constructor(dbPath?: string) {
    this.dataDir = path.join(__dirname, '../../data');

    // Ensure data directory exists
    if (!fs.existsSync(this.dataDir)) {
      fs.mkdirSync(this.dataDir, { recursive: true });
    }

    const dbFile = dbPath || path.join(this.dataDir, 'stocks.db');
    this.db = new Database(dbFile);

    // Enable WAL mode for better concurrency
    this.db.pragma('journal_mode = WAL');
    this.db.pragma('foreign_keys = ON');

    this.initialize();
    console.log('SQLite database initialized at:', dbFile);
  }

  private initialize() {
    // Create all tables
    this.db.exec(`
      -- Daily stock data (5 years)
      CREATE TABLE IF NOT EXISTS stocks_daily (
        symbol TEXT NOT NULL,
        date TEXT NOT NULL,
        open REAL,
        high REAL,
        low REAL,
        close REAL,
        volume INTEGER,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (symbol, date)
      );

      -- 5-minute intraday data (7 days)
      CREATE TABLE IF NOT EXISTS stocks_5min (
        symbol TEXT NOT NULL,
        timestamp TEXT NOT NULL,
        open REAL,
        high REAL,
        low REAL,
        close REAL,
        volume INTEGER,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (symbol, timestamp)
      );

      -- Real-time/latest prices
      CREATE TABLE IF NOT EXISTS stocks_realtime (
        symbol TEXT PRIMARY KEY,
        price REAL,
        change REAL,
        change_percent REAL,
        volume INTEGER,
        timestamp TEXT,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );

      -- Categories
      CREATE TABLE IF NOT EXISTS categories (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        icon TEXT,
        description TEXT,
        color TEXT,
        order_index INTEGER DEFAULT 0,
        is_active BOOLEAN DEFAULT 1,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );

      -- Stock metadata
      CREATE TABLE IF NOT EXISTS stock_metadata (
        symbol TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        category_id TEXT,
        market_cap TEXT,
        sector TEXT,
        description TEXT,
        is_active BOOLEAN DEFAULT 1,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (category_id) REFERENCES categories(id) ON DELETE SET NULL
      );

      -- User selections
      CREATE TABLE IF NOT EXISTS user_selections (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id TEXT DEFAULT 'default',
        category_id TEXT,
        symbol TEXT,
        selected BOOLEAN DEFAULT 1,
        selected_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(user_id, category_id, symbol),
        FOREIGN KEY (category_id) REFERENCES categories(id) ON DELETE CASCADE,
        FOREIGN KEY (symbol) REFERENCES stock_metadata(symbol) ON DELETE CASCADE
      );

      -- App settings
      CREATE TABLE IF NOT EXISTS settings (
        key TEXT PRIMARY KEY,
        value TEXT,
        user_id TEXT DEFAULT 'default',
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );

      -- Watchlists
      CREATE TABLE IF NOT EXISTS watchlists (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id TEXT DEFAULT 'default',
        name TEXT NOT NULL,
        symbols TEXT, -- JSON array of symbols
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );

      -- Create indexes for performance
      CREATE INDEX IF NOT EXISTS idx_daily_symbol_date 
        ON stocks_daily(symbol, date DESC);
      
      CREATE INDEX IF NOT EXISTS idx_5min_symbol_timestamp 
        ON stocks_5min(symbol, timestamp DESC);
      
      CREATE INDEX IF NOT EXISTS idx_user_selections 
        ON user_selections(user_id, category_id);
      
      CREATE INDEX IF NOT EXISTS idx_stock_metadata_category 
        ON stock_metadata(category_id);
      
      CREATE INDEX IF NOT EXISTS idx_settings_user 
        ON settings(user_id, key);
    `);
  }

  // ============ STOCK DATA METHODS ============

  // Insert or update daily stock data
  upsertDailyData(data: StockData): Database.RunResult {
    const stmt = this.db.prepare(`
      INSERT OR REPLACE INTO stocks_daily 
      (symbol, date, open, high, low, close, volume)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `);

    return stmt.run(
      data.symbol,
      data.date,
      data.open,
      data.high,
      data.low,
      data.close,
      data.volume
    );
  }

  // Insert or update 5-minute data
  upsert5MinData(data: StockData): Database.RunResult {
    const stmt = this.db.prepare(`
      INSERT OR REPLACE INTO stocks_5min 
      (symbol, timestamp, open, high, low, close, volume)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `);

    return stmt.run(
      data.symbol,
      data.timestamp,
      data.open,
      data.high,
      data.low,
      data.close,
      data.volume
    );
  }

  // Bulk insert daily data (optimized for large datasets)
  bulkInsertDaily(stocks: StockData[]): void {
    const insert = this.db.prepare(`
      INSERT OR REPLACE INTO stocks_daily 
      (symbol, date, open, high, low, close, volume)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `);

    const insertMany = this.db.transaction((stocks: StockData[]) => {
      for (const stock of stocks) {
        insert.run(
          stock.symbol,
          stock.date,
          stock.open,
          stock.high,
          stock.low,
          stock.close,
          stock.volume
        );
      }
    });

    insertMany(stocks);
  }

  // Bulk insert 5-minute data
  bulkInsert5Min(stocks: StockData[]): void {
    const insert = this.db.prepare(`
      INSERT OR REPLACE INTO stocks_5min 
      (symbol, timestamp, open, high, low, close, volume)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `);

    const insertMany = this.db.transaction((stocks: StockData[]) => {
      for (const stock of stocks) {
        insert.run(
          stock.symbol,
          stock.timestamp,
          stock.open,
          stock.high,
          stock.low,
          stock.close,
          stock.volume
        );
      }
    });

    insertMany(stocks);
  }

  // Get daily data for a symbol
  getDailyData(symbol: string, startDate?: string, endDate?: string): any[] {
    let query = 'SELECT * FROM stocks_daily WHERE symbol = ?';
    const params: any[] = [symbol];

    if (startDate) {
      query += ' AND date >= ?';
      params.push(startDate);
    }

    if (endDate) {
      query += ' AND date <= ?';
      params.push(endDate);
    }

    query += ' ORDER BY date DESC';

    return this.db.prepare(query).all(...params);
  }

  // Get 5-minute data for a symbol
  get5MinData(symbol: string, startTime?: string, endTime?: string): any[] {
    let query = 'SELECT * FROM stocks_5min WHERE symbol = ?';
    const params: any[] = [symbol];

    if (startTime) {
      query += ' AND timestamp >= ?';
      params.push(startTime);
    }

    if (endTime) {
      query += ' AND timestamp <= ?';
      params.push(endTime);
    }

    query += ' ORDER BY timestamp DESC';

    return this.db.prepare(query).all(...params);
  }

  // Get chart data based on time range (with aggregation)
  getChartData(symbol: string, range: string): any[] {
    switch (range) {
      case '1D':
        // Return 5-minute data for today
        return this.db
          .prepare(
            `
          SELECT * FROM stocks_5min 
          WHERE symbol = ? 
            AND timestamp >= datetime('now', 'start of day')
          ORDER BY timestamp ASC
        `
          )
          .all(symbol);

      case '5D':
        // Get 5-minute data and aggregate to 30-minute
        const fiveMinData = this.db
          .prepare(
            `
          SELECT * FROM stocks_5min 
          WHERE symbol = ? 
            AND timestamp >= datetime('now', '-5 days')
          ORDER BY timestamp ASC
        `
          )
          .all(symbol);

        return this.aggregateTo30Min(fiveMinData);

      case '1M':
        return this.db
          .prepare(
            `
          SELECT * FROM stocks_daily 
          WHERE symbol = ? 
            AND date >= date('now', '-30 days')
          ORDER BY date ASC
        `
          )
          .all(symbol);

      case '6M':
        return this.db
          .prepare(
            `
          SELECT * FROM stocks_daily 
          WHERE symbol = ? 
            AND date >= date('now', '-6 months')
          ORDER BY date ASC
        `
          )
          .all(symbol);

      case '1Y':
        return this.db
          .prepare(
            `
          SELECT * FROM stocks_daily 
          WHERE symbol = ? 
            AND date >= date('now', '-1 year')
          ORDER BY date ASC
        `
          )
          .all(symbol);

      case '5Y':
        // Aggregate daily to weekly
        return this.db
          .prepare(
            `
          SELECT 
            MIN(date) as date,
            (SELECT open FROM stocks_daily d2 
             WHERE d2.symbol = d1.symbol 
               AND strftime('%Y-%W', d2.date) = strftime('%Y-%W', d1.date)
             ORDER BY d2.date ASC LIMIT 1) as open,
            MAX(high) as high,
            MIN(low) as low,
            (SELECT close FROM stocks_daily d3 
             WHERE d3.symbol = d1.symbol 
               AND strftime('%Y-%W', d3.date) = strftime('%Y-%W', d1.date)
             ORDER BY d3.date DESC LIMIT 1) as close,
            SUM(volume) as volume
          FROM stocks_daily d1
          WHERE symbol = ? 
            AND date >= date('now', '-5 years')
          GROUP BY strftime('%Y-%W', date)
          ORDER BY date ASC
        `
          )
          .all(symbol);

      default:
        return this.getDailyData(symbol);
    }
  }

  // Aggregate 5-minute data to 30-minute candles
  private aggregateTo30Min(fiveMinData: any[]): any[] {
    const thirtyMinCandles = [];

    for (let i = 0; i < fiveMinData.length; i += 6) {
      const group = fiveMinData.slice(i, Math.min(i + 6, fiveMinData.length));

      if (group.length > 0) {
        thirtyMinCandles.push({
          timestamp: group[0].timestamp,
          open: group[0].open,
          high: Math.max(...group.map((g) => g.high)),
          low: Math.min(...group.map((g) => g.low)),
          close: group[group.length - 1].close,
          volume: group.reduce((sum, g) => sum + g.volume, 0),
        });
      }
    }

    return thirtyMinCandles;
  }

  // Update real-time price
  updateRealtimePrice(
    symbol: string,
    price: number,
    change: number,
    changePercent: number,
    volume: number
  ): void {
    this.db
      .prepare(
        `
      INSERT OR REPLACE INTO stocks_realtime 
      (symbol, price, change, change_percent, volume, timestamp, updated_at)
      VALUES (?, ?, ?, ?, ?, datetime('now'), datetime('now'))
    `
      )
      .run(symbol, price, change, changePercent, volume);
  }

  // Get latest prices for all stocks
  getLatestPrices(): any[] {
    return this.db
      .prepare(
        `
      SELECT 
        sr.symbol,
        sr.price,
        sr.change,
        sr.change_percent,
        sr.volume,
        sr.timestamp,
        sm.name,
        sm.category_id
      FROM stocks_realtime sr
      LEFT JOIN stock_metadata sm ON sr.symbol = sm.symbol
      ORDER BY sr.symbol
    `
      )
      .all();
  }

  // ============ CONFIGURATION METHODS ============

  // Get all categories with their stocks
  getAllCategories(): Category[] {
    const categoryRows = this.db
      .prepare(
        `
      SELECT * FROM categories 
      WHERE is_active = 1 
      ORDER BY order_index, name
    `
      )
      .all() as CategoryRow[];

    const getStocksStmt = this.db.prepare(`
      SELECT * FROM stock_metadata 
      WHERE category_id = ? AND is_active = 1
      ORDER BY symbol
    `);

    return categoryRows.map((row: CategoryRow): Category => {
      const stockRows = getStocksStmt.all(row.id) as StockRow[];

      return {
        id: row.id,
        name: row.name,
        icon: row.icon,
        description: row.description || undefined,
        color: row.color || undefined,
        order_index: row.order_index,
        is_active: row.is_active === 1,
        stocks: stockRows.map(
          (stockRow): Stock => ({
            symbol: stockRow.symbol,
            name: stockRow.name,
            price: 0,
            previousClose: 0,
            change: 0,
            changePercent: 0,
            volume: 0,
            marketCap: stockRow.market_cap || undefined,
            sector: stockRow.sector || undefined,
          })
        ),
      };
    });
  }
  // Insert or update category
  upsertCategory(category: Category): void {
    this.db
      .prepare(
        `
      INSERT OR REPLACE INTO categories 
      (id, name, icon, description, color, order_index, is_active, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, datetime('now'))
    `
      )
      .run(
        category.id,
        category.name,
        category.icon,
        category.description,
        category.color,
        category.order_index,
        category.is_active ? 1 : 0
      );
  }

  updateCategoryName(categoryId: string, newName: string): any {
    return this.db
      .prepare(
        `
        UPDATE categories 
        SET name = ?, updated_at = datetime('now')
        WHERE id = ?
      `
      )
      .run(newName, categoryId);
  }

  // Insert or update stock metadata
  upsertStockMetadata(stock: StockMetadata): void {
    this.db
      .prepare(
        `
      INSERT OR REPLACE INTO stock_metadata 
      (symbol, name, category_id, market_cap, sector, description, is_active, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, datetime('now'))
    `
      )
      .run(
        stock.symbol,
        stock.name,
        stock.category_id,
        stock.market_cap,
        stock.sector,
        stock.description,
        stock.is_active ? 1 : 0
      );
  }

  // Get user selections
  getUserSelections(userId = 'default'): any[] {
    return this.db
      .prepare(
        `
      SELECT 
        us.category_id,
        us.symbol,
        us.selected,
        sm.name as stock_name,
        c.name as category_name,
        c.icon as category_icon
      FROM user_selections us
      JOIN stock_metadata sm ON us.symbol = sm.symbol
      JOIN categories c ON us.category_id = c.id
      WHERE us.user_id = ? AND us.selected = 1
      ORDER BY c.order_index, us.symbol
    `
      )
      .all(userId);
  }

  // Toggle stock selection
  toggleStockSelection(
    userId: string,
    categoryId: string,
    symbol: string
  ): void {
    const existing = this.db
      .prepare(
        `
      SELECT selected FROM user_selections 
      WHERE user_id = ? AND category_id = ? AND symbol = ?
    `
      )
      .get(userId, categoryId, symbol) as any;

    if (existing) {
      this.db
        .prepare(
          `
        UPDATE user_selections 
        SET selected = ?, selected_at = datetime('now')
        WHERE user_id = ? AND category_id = ? AND symbol = ?
      `
        )
        .run(existing.selected ? 0 : 1, userId, categoryId, symbol);
    } else {
      this.db
        .prepare(
          `
        INSERT INTO user_selections (user_id, category_id, symbol, selected)
        VALUES (?, ?, ?, 1)
      `
        )
        .run(userId, categoryId, symbol);
    }
  }

  // Get settings
  getSettings(userId = 'default'): Record<string, any> {
    const rows = this.db
      .prepare(
        `
      SELECT key, value FROM settings WHERE user_id = ?
    `
      )
      .all(userId) as any[];

    return rows.reduce((acc, row) => {
      try {
        acc[row.key] = JSON.parse(row.value);
      } catch {
        acc[row.key] = row.value;
      }
      return acc;
    }, {} as Record<string, any>);
  }

  // Update setting
  updateSetting(userId: string, key: string, value: any): void {
    const jsonValue = typeof value === 'string' ? value : JSON.stringify(value);

    this.db
      .prepare(
        `
      INSERT OR REPLACE INTO settings (key, value, user_id, updated_at)
      VALUES (?, ?, ?, datetime('now'))
    `
      )
      .run(key, jsonValue, userId);
  }

  // ============ STATISTICS METHODS ============

  // Get stock statistics
  getStockStats(symbol: string): any {
    return this.db
      .prepare(
        `
      SELECT 
        symbol,
        COUNT(*) as total_days,
        MIN(date) as first_date,
        MAX(date) as last_date,
        AVG(close) as avg_close,
        MIN(low) as year_low,
        MAX(high) as year_high,
        AVG(volume) as avg_volume
      FROM stocks_daily
      WHERE symbol = ?
        AND date >= date('now', '-1 year')
      GROUP BY symbol
    `
      )
      .get(symbol);
  }

  // Get database statistics
  getDatabaseStats(): any {
    return {
      totalStocks: this.db
        .prepare('SELECT COUNT(DISTINCT symbol) as count FROM stock_metadata')
        .get(),
      totalDailyRecords: this.db
        .prepare('SELECT COUNT(*) as count FROM stocks_daily')
        .get(),
      total5MinRecords: this.db
        .prepare('SELECT COUNT(*) as count FROM stocks_5min')
        .get(),
      totalCategories: this.db
        .prepare('SELECT COUNT(*) as count FROM categories')
        .get(),
      oldestDailyData: this.db
        .prepare('SELECT MIN(date) as date FROM stocks_daily')
        .get(),
      newestDailyData: this.db
        .prepare('SELECT MAX(date) as date FROM stocks_daily')
        .get(),
      databaseSize: this.getDatabaseSize(),
    };
  }

  private getDatabaseSize(): string {
    const stats = fs.statSync(path.join(this.dataDir, 'stocks.db'));
    return `${(stats.size / (1024 * 1024)).toFixed(2)} MB`;
  }

  // ============ CLEANUP METHODS ============

  // Clean old 5-minute data
  cleanOld5MinData(daysToKeep = 7): number {
    const result = this.db
      .prepare(
        `
      DELETE FROM stocks_5min 
      WHERE timestamp < datetime('now', '-${daysToKeep} days')
    `
      )
      .run();

    return result.changes;
  }

  // Vacuum database to reclaim space
  vacuum(): void {
    this.db.prepare('VACUUM').run();
  }

  // ============ UTILITY METHODS ============

  // Execute raw SQL query (for flexibility)
  query(sql: string, params: any[] = []): any[] {
    return this.db.prepare(sql).all(...params);
  }

  // Execute raw SQL statement
  execute(sql: string, params: any[] = []): Database.RunResult {
    return this.db.prepare(sql).run(...params);
  }

  // Get database connection (for advanced usage)
  getDatabase(): Database.Database {
    return this.db;
  }

  // Close database connection
  close(): void {
    this.db.close();
    console.log('Database connection closed');
  }

  // Create backup
  backup(backupPath?: string): void {
    const backupFile =
      backupPath || path.join(this.dataDir, `backup_${Date.now()}.db`);
    this.db.backup(backupFile);
    console.log('Database backed up to:', backupFile);
  }
}

// Export singleton instance
export default new StockDatabase();
