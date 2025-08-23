// backend/src/scripts/realtime-updater.ts
// Runs continuously to update stock prices every 5 minutes

import cron from 'node-cron';
import stockDb from '../src/services/sqliteService';
import yahooService from '../src/services/yahooService';

class RealtimeUpdater {
  private updateInterval = 5; // minutes
  private isRunning = false;
  private stocks: string[] = [];
  private updateCount = 0;
  private startTime: Date;

  constructor() {
    // Load stocks from categories
    const categories = stockDb.getAllCategories();
    this.stocks = [
      ...new Set(categories.flatMap((c) => c.stocks.map((s) => s.symbol))),
    ];
    this.startTime = new Date();

    console.log('═'.repeat(50));
    console.log('📊 REAL-TIME STOCK UPDATER');
    console.log('═'.repeat(50));
    console.log(`Stocks monitored: ${this.stocks.length}`);
    console.log(`Update interval: ${this.updateInterval} minutes`);
    console.log(`Stocks: ${this.stocks.join(', ')}`);
    console.log('═'.repeat(50) + '\n');
  }

  /**
   * Check if market is open (US Eastern Time)
   */
  private isMarketOpen(): boolean {
    const now = new Date();

    // Convert to ET (Eastern Time)
    const etTime = new Date(
      now.toLocaleString('en-US', { timeZone: 'America/New_York' })
    );
    const day = etTime.getDay();
    const hour = etTime.getHours();
    const minute = etTime.getMinutes();
    const currentTime = hour * 60 + minute;

    // Skip weekends (0 = Sunday, 6 = Saturday)
    if (day === 0 || day === 6) {
      return false;
    }

    // Check for US market holidays (simplified - you can expand this)
    const isHoliday = this.isMarketHoliday(etTime);
    if (isHoliday) {
      return false;
    }

    // Market hours: 9:30 AM - 4:00 PM ET
    const marketOpen = 9 * 60 + 30; // 9:30 AM = 570 minutes
    const marketClose = 16 * 60; // 4:00 PM = 960 minutes

    return currentTime >= marketOpen && currentTime <= marketClose;
  }

  /**
   * Check if today is a market holiday (simplified)
   */
  private isMarketHoliday(date: Date): boolean {
    // Add major market holidays here
    const holidays = [
      '01-01', // New Year's Day
      '07-04', // Independence Day
      '12-25', // Christmas
      // Add more holidays as needed
    ];

    const monthDay = `${String(date.getMonth() + 1).padStart(2, '0')}-${String(
      date.getDate()
    ).padStart(2, '0')}`;
    return holidays.includes(monthDay);
  }

  /**
   * Format elapsed time
   */
  private getElapsedTime(): string {
    const elapsed = Date.now() - this.startTime.getTime();
    const hours = Math.floor(elapsed / (1000 * 60 * 60));
    const minutes = Math.floor((elapsed % (1000 * 60 * 60)) / (1000 * 60));
    return `${hours}h ${minutes}m`;
  }

  /**
   * Fetch and store current prices for all stocks
   */
  private async updatePrices() {
    this.updateCount++;
    const timestamp = new Date().toLocaleTimeString();
    const marketOpen = this.isMarketOpen();

    console.log(
      `\n[Update #${
        this.updateCount
      }] ${timestamp} | Running: ${this.getElapsedTime()}`
    );
    console.log(`Market: ${marketOpen ? '🟢 OPEN' : '🔴 CLOSED'}`);
    console.log('─'.repeat(40));

    let updated = 0;
    let failed = 0;
    const errors: string[] = [];

    try {
      // Batch fetch all stocks
      console.log(`Fetching ${this.stocks.length} stocks...`);
      const quotes = await yahooService.fetchMultiplePrices(this.stocks);

      quotes.forEach((quote, symbol) => {
        try {
          // Always update real-time price
          stockDb.updateRealtimePrice(
            symbol,
            quote.regularMarketPrice,
            quote.regularMarketChange,
            quote.regularMarketChangePercent,
            quote.regularMarketVolume
          );

          // During market hours, also store as 5-minute data
          if (marketOpen) {
            stockDb.upsert5MinData({
              symbol: symbol,
              timestamp: new Date().toISOString(),
              open: quote.regularMarketPrice,
              high: quote.regularMarketPrice,
              low: quote.regularMarketPrice,
              close: quote.regularMarketPrice,
              volume: quote.regularMarketVolume,
            });
          }

          updated++;

          // Show significant movers (> 2% change)
          if (Math.abs(quote.regularMarketChangePercent) > 2) {
            const direction =
              quote.regularMarketChangePercent > 0 ? '📈' : '📉';
            console.log(
              `  ${direction} ${symbol}: ${
                quote.regularMarketChangePercent > 0 ? '+' : ''
              }${quote.regularMarketChangePercent.toFixed(
                2
              )}% ($${quote.regularMarketPrice.toFixed(2)})`
            );
          }
        } catch (error: any) {
          failed++;
          errors.push(`${symbol}: ${error.message}`);
        }
      });

      // Summary
      console.log(`\n✓ Updated: ${updated} | ✗ Failed: ${failed}`);

      if (marketOpen) {
        console.log(`📊 Stored ${updated} intraday data points`);
      }

      if (errors.length > 0 && errors.length <= 3) {
        console.log('Errors:', errors.join(', '));
      }
    } catch (error: any) {
      console.error('Batch update failed:', error.message);
      console.log('Attempting individual updates...');

      // Fallback: update individually
      for (const symbol of this.stocks) {
        try {
          const quote = await yahooService.fetchCurrentPrice(symbol);
          if (quote) {
            stockDb.updateRealtimePrice(
              symbol,
              quote.regularMarketPrice,
              quote.regularMarketChange,
              quote.regularMarketChangePercent,
              quote.regularMarketVolume
            );
            updated++;
          } else {
            failed++;
          }
        } catch (err) {
          failed++;
        }
      }

      console.log(`Fallback complete: ✓ ${updated} | ✗ ${failed}`);
    }

    // Show next update time
    const nextUpdate = new Date(Date.now() + this.updateInterval * 60 * 1000);
    console.log(`Next update: ${nextUpdate.toLocaleTimeString()}`);

    return { updated, failed };
  }

  /**
   * Update end-of-day data (run after market close)
   */
  private async updateDailyData() {
    console.log('\n' + '═'.repeat(40));
    console.log('📅 END OF DAY UPDATE');
    console.log('═'.repeat(40));

    const today = new Date();
    const todayStr = today.toISOString().split('T')[0];
    let updated = 0;
    let failed = 0;

    for (const symbol of this.stocks) {
      try {
        // Fetch today's daily candle
        const dailyData = await yahooService.fetchHistoricalData(
          symbol,
          today,
          today,
          '1d'
        );

        if (dailyData && dailyData.length > 0) {
          const todayData = dailyData[0];
          stockDb.upsertDailyData({
            symbol: symbol,
            date: todayStr,
            open: todayData.open,
            high: todayData.high,
            low: todayData.low,
            close: todayData.close,
            volume: todayData.volume,
          });
          updated++;
        }
      } catch (error: any) {
        console.error(`Failed ${symbol}: ${error.message}`);
        failed++;
      }
    }

    console.log(`\n✓ Daily data updated: ${updated} stocks`);
    if (failed > 0) {
      console.log(`✗ Failed: ${failed} stocks`);
    }
  }

  /**
   * Clean old intraday data to save space
   */
  private cleanOldData() {
    console.log('\n🧹 Cleaning old intraday data...');
    const deleted = stockDb.cleanOld5MinData(30); // Keep 30 days
    console.log(`Deleted ${deleted} old records`);

    // Vacuum database to reclaim space
    if (deleted > 0) {
      console.log('Optimizing database...');
      stockDb.vacuum();
      console.log('✓ Database optimized');
    }
  }

  /**
   * Start the real-time updater
   */
  start() {
    if (this.isRunning) {
      console.log('⚠️  Updater is already running');
      return;
    }

    console.log('🚀 Starting real-time updater...\n');
    this.isRunning = true;

    // Initial update
    console.log('Running initial update...');
    this.updatePrices();

    // Schedule updates every 5 minutes
    const updateJob = cron.schedule(
      `*/${this.updateInterval} * * * *`,
      async () => {
        await this.updatePrices();
      }
    );

    // Schedule end-of-day update at 4:30 PM ET (adjust for your timezone)
    const dailyJob = cron.schedule('30 16 * * 1-5', async () => {
      await this.updateDailyData();
    });

    // Clean old data every night at 2 AM
    const cleanupJob = cron.schedule('0 2 * * *', () => {
      this.cleanOldData();
    });

    console.log('\n✅ Real-time updater is running');
    console.log('   Updates: Every 5 minutes');
    console.log('   Daily close: 4:30 PM ET');
    console.log('   Cleanup: 2:00 AM daily');
    console.log('\nPress Ctrl+C to stop\n');

    // Keep the process alive
    process.stdin.resume();
  }

  /**
   * Stop the updater gracefully
   */
  stop() {
    const runtime = this.getElapsedTime();

    console.log('\n' + '═'.repeat(40));
    console.log('🛑 Stopping real-time updater...');
    console.log(`Total updates: ${this.updateCount}`);
    console.log(`Runtime: ${runtime}`);
    console.log('═'.repeat(40));

    this.isRunning = false;
    stockDb.close();
    process.exit(0);
  }

  /**
   * Get current status
   */
  getStatus() {
    return {
      running: this.isRunning,
      updateCount: this.updateCount,
      runtime: this.getElapsedTime(),
      nextUpdate: new Date(Date.now() + this.updateInterval * 60 * 1000),
      marketOpen: this.isMarketOpen(),
      stockCount: this.stocks.length,
    };
  }
}

// Run if called directly
if (require.main === module) {
  const updater = new RealtimeUpdater();

  // Handle graceful shutdown
  process.on('SIGINT', () => {
    console.log('\n⚠️  Interrupt received...');
    updater.stop();
  });

  process.on('SIGTERM', () => {
    console.log('\n⚠️  Termination signal received...');
    updater.stop();
  });

  // Handle errors
  process.on('uncaughtException', (error) => {
    console.error('\n❌ Uncaught Exception:', error);
    updater.stop();
  });

  // Start the updater
  updater.start();
}

export default RealtimeUpdater;
