// backend/src/populate-chart-data.ts
// Script to populate chart data for testing

import stockDb from './services/sqliteService';
import yahooService from './services/yahooService';

async function populateChartData() {
  console.log('Populating chart data...\n');

  // List of stocks to populate
  const stocks = ['AAPL', 'MSFT', 'GOOGL', 'META', 'NVDA', 'TSLA', 'AMZN'];

  for (const symbol of stocks) {
    console.log(`Fetching data for ${symbol}...`);

    try {
      // 1. Fetch current price
      const currentPrice = await yahooService.fetchCurrentPrice(symbol);
      if (currentPrice) {
        yahooService.saveQuotesToDatabase(new Map([[symbol, currentPrice]]));
        console.log(
          `  ✓ Saved current price: $${currentPrice.regularMarketPrice}`
        );
      }

      // 2. Fetch historical data (30 days)
      const endDate = new Date();
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - 30);

      const historicalData = await yahooService.fetchHistoricalData(
        symbol,
        startDate,
        endDate,
        '1d' // Daily data
      );

      if (historicalData && historicalData.length > 0) {
        // Save to database
        stockDb.bulkInsertDaily(historicalData);
        console.log(
          `  ✓ Saved ${historicalData.length} days of historical data`
        );
      }

      // 3. Generate some 5-minute data for today (mock for now)
      const today = new Date();
      const fiveMinData = [];
      const basePrice = currentPrice?.regularMarketPrice || 100;

      // Generate data points for today (9:30 AM to 4:00 PM)
      for (let hour = 9; hour < 16; hour++) {
        for (let min = 0; min < 60; min += 5) {
          if (hour === 9 && min < 30) continue; // Market opens at 9:30

          const timestamp = new Date(today);
          timestamp.setHours(hour, min, 0, 0);

          const variation = (Math.random() - 0.5) * 0.01; // ±1% variation
          const price = basePrice * (1 + variation);

          fiveMinData.push({
            symbol: symbol,
            timestamp: timestamp.toISOString(),
            open: price * (1 + (Math.random() - 0.5) * 0.001),
            high: price * (1 + Math.random() * 0.002),
            low: price * (1 - Math.random() * 0.002),
            close: price,
            volume: Math.floor(Math.random() * 100000),
          });
        }
      }

      if (fiveMinData.length > 0) {
        stockDb.bulkInsert5Min(fiveMinData);
        console.log(
          `  ✓ Generated ${fiveMinData.length} 5-minute data points for today`
        );
      }
    } catch (error) {
      console.error(`  ✗ Error fetching ${symbol}:`, error);
    }

    // Small delay between requests
    await new Promise((resolve) => setTimeout(resolve, 1000));
  }

  console.log('\n✓ Chart data population complete!');

  // Verify the data
  console.log('\nVerifying data in database:');

  for (const symbol of stocks.slice(0, 3)) {
    const dailyData = stockDb.getDailyData(symbol);
    const fiveMinData = stockDb.get5MinData(symbol);
    const chartData = stockDb.getChartData(symbol, '1D');

    console.log(`\n${symbol}:`);
    console.log(`  Daily records: ${dailyData.length}`);
    console.log(`  5-min records: ${fiveMinData.length}`);
    console.log(`  Chart data (1D): ${chartData.length} points`);
  }

  process.exit(0);
}

// Run the script
populateChartData().catch(console.error);
