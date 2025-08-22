// backend/src/services/yahooService.ts

import yahooFinance from 'yahoo-finance2';
import stockDb from './sqliteService';

// Suppress TypeScript errors for yahoo-finance2 if types are not available
const yf = yahooFinance as any;

interface YahooQuote {
  symbol: string;
  regularMarketPrice: number;
  regularMarketChange: number;
  regularMarketChangePercent: number;
  regularMarketVolume: number;
  regularMarketTime: Date;
  shortName?: string;
  marketCap?: number;
  fiftyTwoWeekHigh?: number;
  fiftyTwoWeekLow?: number;
}

class YahooFinanceService {
  constructor() {
    // Suppress Yahoo Finance console warnings in production
    if (process.env.NODE_ENV === 'production') {
      yf.suppressNotices(['yahooSurvey']);
    }
  }

  /**
   * Fetch current price for a single stock
   */
  async fetchCurrentPrice(symbol: string): Promise<YahooQuote | null> {
    try {
      console.log(`Fetching current price for ${symbol}...`);

      const quote = await yf.quote(symbol);

      if (!quote) {
        console.error(`No data returned for ${symbol}`);
        return null;
      }

      console.log(
        `✓ Fetched ${symbol}: $${
          quote.regularMarketPrice
        } (${quote.regularMarketChangePercent?.toFixed(2)}%)`
      );

      return {
        symbol: quote.symbol,
        regularMarketPrice: quote.regularMarketPrice || 0,
        regularMarketChange: quote.regularMarketChange || 0,
        regularMarketChangePercent: quote.regularMarketChangePercent || 0,
        regularMarketVolume: quote.regularMarketVolume || 0,
        regularMarketTime: quote.regularMarketTime
          ? new Date(quote.regularMarketTime)
          : new Date(),
        shortName: quote.shortName,
        marketCap: quote.marketCap,
        fiftyTwoWeekHigh: quote.fiftyTwoWeekHigh,
        fiftyTwoWeekLow: quote.fiftyTwoWeekLow,
      };
    } catch (error) {
      console.error(`Error fetching ${symbol}:`, error);
      return null;
    }
  }

  /**
   * Fetch current prices for multiple stocks
   */
  async fetchMultiplePrices(
    symbols: string[]
  ): Promise<Map<string, YahooQuote>> {
    console.log(`\nFetching prices for ${symbols.length} stocks...`);
    const results = new Map<string, YahooQuote>();

    try {
      // Yahoo Finance allows bulk queries
      const quotes = await yf.quote(symbols);

      // Handle both single and multiple results
      const quotesArray = Array.isArray(quotes) ? quotes : [quotes];

      for (const quote of quotesArray) {
        if (quote && quote.symbol) {
          results.set(quote.symbol, {
            symbol: quote.symbol,
            regularMarketPrice: quote.regularMarketPrice || 0,
            regularMarketChange: quote.regularMarketChange || 0,
            regularMarketChangePercent: quote.regularMarketChangePercent || 0,
            regularMarketVolume: quote.regularMarketVolume || 0,
            regularMarketTime: quote.regularMarketTime
              ? new Date(quote.regularMarketTime)
              : new Date(),
            shortName: quote.shortName,
            marketCap: quote.marketCap,
            fiftyTwoWeekHigh: quote.fiftyTwoWeekHigh,
            fiftyTwoWeekLow: quote.fiftyTwoWeekLow,
          });

          console.log(
            `✓ ${quote.symbol}: $${quote.regularMarketPrice?.toFixed(2)}`
          );
        }
      }
    } catch (error) {
      console.error('Error fetching multiple quotes:', error);

      // Fallback: fetch individually if bulk fails
      for (const symbol of symbols) {
        const quote = await this.fetchCurrentPrice(symbol);
        if (quote) {
          results.set(symbol, quote);
        }
      }
    }

    console.log(
      `✓ Successfully fetched ${results.size}/${symbols.length} stocks\n`
    );
    return results;
  }

  /**
   * Save fetched quotes to database
   */
  saveQuotesToDatabase(quotes: Map<string, YahooQuote>): void {
    console.log('Saving to database...');

    quotes.forEach((quote, symbol) => {
      try {
        // Update real-time price in database
        stockDb.updateRealtimePrice(
          symbol,
          quote.regularMarketPrice,
          quote.regularMarketChange,
          quote.regularMarketChangePercent,
          quote.regularMarketVolume
        );

        console.log(`✓ Saved ${symbol} to database`);
      } catch (error) {
        console.error(`Error saving ${symbol} to database:`, error);
      }
    });

    console.log('✓ Database update complete\n');
  }

  /**
   * Fetch historical data for a stock
   */
  async fetchHistoricalData(
    symbol: string,
    period1: Date,
    period2: Date = new Date(),
    interval: '1m' | '5m' | '15m' | '30m' | '1h' | '1d' | '1wk' | '1mo' = '1d'
  ) {
    try {
      console.log(`Fetching historical data for ${symbol}...`);

      const result = await yf.chart(symbol, {
        period1: period1,
        period2: period2,
        interval: interval,
      });

      if (!result || !result.quotes) {
        console.error(`No historical data for ${symbol}`);
        return [];
      }

      // Transform Yahoo data to your format
      const historicalData = result.quotes.map((quote: any) => ({
        symbol: symbol,
        date: new Date(quote.date).toISOString(),
        timestamp: new Date(quote.date).toISOString(),
        open: quote.open || 0,
        high: quote.high || 0,
        low: quote.low || 0,
        close: quote.close || 0,
        volume: quote.volume || 0,
      }));

      console.log(
        `✓ Fetched ${historicalData.length} data points for ${symbol}`
      );
      return historicalData;
    } catch (error) {
      console.error(`Error fetching historical data for ${symbol}:`, error);
      return [];
    }
  }

  /**
   * Test method - Fetch and save a single stock
   */
  async testSingleStock(symbol: string = 'AAPL'): Promise<void> {
    console.log('='.repeat(50));
    console.log('Yahoo Finance Test - Single Stock');
    console.log('='.repeat(50));

    const quote = await this.fetchCurrentPrice(symbol);

    if (quote) {
      console.log('\nQuote details:');
      console.log(`  Symbol: ${quote.symbol}`);
      console.log(`  Name: ${quote.shortName || 'N/A'}`);
      console.log(`  Price: $${quote.regularMarketPrice.toFixed(2)}`);
      console.log(
        `  Change: ${quote.regularMarketChange.toFixed(
          2
        )} (${quote.regularMarketChangePercent.toFixed(2)}%)`
      );
      console.log(`  Volume: ${quote.regularMarketVolume.toLocaleString()}`);
      console.log(
        `  Market Cap: ${
          quote.marketCap ? `$${(quote.marketCap / 1e9).toFixed(2)}B` : 'N/A'
        }`
      );
      console.log(`  52W High: ${quote.fiftyTwoWeekHigh?.toFixed(2) || 'N/A'}`);
      console.log(`  52W Low: ${quote.fiftyTwoWeekLow?.toFixed(2) || 'N/A'}`);
      console.log(`  Time: ${quote.regularMarketTime}`);

      // Save to database
      this.saveQuotesToDatabase(new Map([[symbol, quote]]));

      // Verify it was saved
      console.log('\nVerifying database save...');
      const savedPrices = stockDb.getLatestPrices();
      const savedPrice = savedPrices.find((p: any) => p.symbol === symbol);

      if (savedPrice) {
        console.log('✓ Successfully saved and retrieved from database');
        console.log(`  Database price: $${savedPrice.price}`);
      } else {
        console.log('✗ Failed to retrieve from database');
      }
    }
  }

  /**
   * Test method - Fetch multiple tech stocks
   */
  async testMultipleStocks(): Promise<void> {
    console.log('='.repeat(50));
    console.log('Yahoo Finance Test - Multiple Stocks');
    console.log('='.repeat(50));

    // Use your actual tech stocks from the app
    const techStocks = ['AAPL', 'MSFT', 'GOOGL', 'META', 'NVDA', 'TSLA'];

    const quotes = await this.fetchMultiplePrices(techStocks);

    if (quotes.size > 0) {
      this.saveQuotesToDatabase(quotes);

      // Display summary
      console.log('\nSummary:');
      console.log(`  Requested: ${techStocks.length} stocks`);
      console.log(`  Fetched: ${quotes.size} stocks`);
      console.log(
        `  Success rate: ${((quotes.size / techStocks.length) * 100).toFixed(
          1
        )}%`
      );

      // Show top gainer/loser
      let topGainer = { symbol: '', percent: -Infinity };
      let topLoser = { symbol: '', percent: Infinity };

      quotes.forEach((quote, symbol) => {
        if (quote.regularMarketChangePercent > topGainer.percent) {
          topGainer = { symbol, percent: quote.regularMarketChangePercent };
        }
        if (quote.regularMarketChangePercent < topLoser.percent) {
          topLoser = { symbol, percent: quote.regularMarketChangePercent };
        }
      });

      console.log(
        `\n  📈 Top Gainer: ${topGainer.symbol} (+${topGainer.percent.toFixed(
          2
        )}%)`
      );
      console.log(
        `  📉 Top Loser: ${topLoser.symbol} (${topLoser.percent.toFixed(2)}%)`
      );
    }
  }

  /**
   * Test historical data fetch
   */
  async testHistoricalData(symbol: string = 'AAPL'): Promise<void> {
    console.log('='.repeat(50));
    console.log('Yahoo Finance Test - Historical Data');
    console.log('='.repeat(50));

    // Fetch last 30 days of daily data
    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - 30);

    const data = await this.fetchHistoricalData(
      symbol,
      startDate,
      endDate,
      '1d'
    );

    if (data.length > 0) {
      console.log(`\nSample data points:`);
      // Show first, middle, and last data points
      const indices = [0, Math.floor(data.length / 2), data.length - 1];
      indices.forEach((i) => {
        const point = data[i];
        console.log(
          `  ${point.date.split('T')[0]}: O:${point.open.toFixed(
            2
          )} H:${point.high.toFixed(2)} L:${point.low.toFixed(
            2
          )} C:${point.close.toFixed(2)} V:${(point.volume / 1e6).toFixed(1)}M`
        );
      });

      // Save to database
      console.log('\nSaving historical data to database...');
      stockDb.bulkInsertDaily(data);
      console.log('✓ Historical data saved');
    }
  }
}

// Create singleton instance
const yahooService = new YahooFinanceService();

export default yahooService;

// Test execution if run directly
if (require.main === module) {
  (async () => {
    try {
      // Test 1: Single stock
      await yahooService.testSingleStock('AAPL');

      console.log('\n' + '='.repeat(50) + '\n');

      // Test 2: Multiple stocks
      await yahooService.testMultipleStocks();

      console.log('\n' + '='.repeat(50) + '\n');

      // Test 3: Historical data
      await yahooService.testHistoricalData('AAPL');

      process.exit(0);
    } catch (error) {
      console.error('Test failed:', error);
      process.exit(1);
    }
  })();
}
