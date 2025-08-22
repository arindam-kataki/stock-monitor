// backend/src/populate-all-stocks.ts
// Script to populate data for ALL stocks in your categories

import stockDb from './services/sqliteService';
import yahooService from './services/yahooService';

async function populateAllStocks() {
  console.log('Fetching all categories and their stocks...\n');

  // Get all categories from database
  const categories = stockDb.getAllCategories();

  // Collect all unique stock symbols
  const allSymbols = new Set<string>();

  categories.forEach((category) => {
    console.log(`Category: ${category.name}`);
    category.stocks.forEach((stock) => {
      allSymbols.add(stock.symbol);
      console.log(`  - ${stock.symbol}: ${stock.name}`);
    });
  });

  console.log(`\nTotal unique stocks to populate: ${allSymbols.size}\n`);
  console.log('This will take a few minutes...\n');

  let successCount = 0;
  let failCount = 0;

  for (const symbol of allSymbols) {
    console.log(`\nFetching ${symbol}...`);

    try {
      // 1. Fetch current price
      const currentPrice = await yahooService.fetchCurrentPrice(symbol);
      if (currentPrice) {
        yahooService.saveQuotesToDatabase(new Map([[symbol, currentPrice]]));
        console.log(
          `  ✓ Current price: $${currentPrice.regularMarketPrice.toFixed(2)}`
        );
      }

      // 2. Fetch 30 days of historical data
      const endDate = new Date();
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - 30);

      const historicalData = await yahooService.fetchHistoricalData(
        symbol,
        startDate,
        endDate,
        '1d'
      );

      if (historicalData && historicalData.length > 0) {
        stockDb.bulkInsertDaily(historicalData);
        console.log(`  ✓ Saved ${historicalData.length} days of history`);
      }

      // 3. Generate intraday data for today
      const today = new Date();
      const fiveMinData = [];
      const basePrice = currentPrice?.regularMarketPrice || 100;

      // Generate 5-minute intervals from 9:30 AM to 4:00 PM
      for (let hour = 9; hour < 16; hour++) {
        for (let min = 0; min < 60; min += 5) {
          if (hour === 9 && min < 30) continue;

          const timestamp = new Date(today);
          timestamp.setHours(hour, min, 0, 0);

          const variation = (Math.random() - 0.5) * 0.01;
          const price = basePrice * (1 + variation);

          fiveMinData.push({
            symbol: symbol,
            timestamp: timestamp.toISOString(),
            open: price * (1 + (Math.random() - 0.5) * 0.001),
            high: price * (1 + Math.random() * 0.002),
            low: price * (1 - Math.random() * 0.002),
            close: price,
            volume: Math.floor(Math.random() * 1000000),
          });
        }
      }

      if (fiveMinData.length > 0) {
        stockDb.bulkInsert5Min(fiveMinData);
        console.log(`  ✓ Generated ${fiveMinData.length} intraday points`);
      }

      successCount++;
    } catch (error: any) {
      console.error(`  ✗ Error: ${error.message}`);
      failCount++;
    }

    // Small delay to avoid rate limiting
    await new Promise((resolve) => setTimeout(resolve, 1500));
  }

  console.log('\n' + '='.repeat(50));
  console.log('Population Complete!');
  console.log('='.repeat(50));
  console.log(`✓ Success: ${successCount} stocks`);
  console.log(`✗ Failed: ${failCount} stocks`);

  // Verify the data
  console.log('\nVerifying database contents...');
  const prices = stockDb.getLatestPrices();
  console.log(`Total stocks with prices: ${prices.length}`);

  // Show sample data
  console.log('\nSample prices:');
  prices.slice(0, 5).forEach((p: any) => {
    console.log(
      `  ${p.symbol}: $${p.price} (${p.change_percent > 0 ? '+' : ''}${
        p.change_percent
      }%)`
    );
  });

  process.exit(0);
}

// Run the script
populateAllStocks().catch(console.error);
