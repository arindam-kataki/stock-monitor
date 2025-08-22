// backend/src/populate-demo-stocks.ts
// Populate exactly the stocks needed for demo

import stockDb from './services/sqliteService';
import yahooService from './services/yahooService';

async function populateDemoStocks() {
  console.log('='.repeat(50));
  console.log('DEMO STOCK POPULATION');
  console.log('='.repeat(50));

  // Define demo stocks by category
  const demoStocks = {
    Technology: ['AAPL', 'MSFT', 'NVDA'],
    Healthcare: ['JNJ', 'UNH', 'PFE'],
    Finance: ['JPM', 'V', 'BAC'],
    Retail: ['AMZN', 'WMT', 'HD'],
    Energy: ['XOM', 'CVX', 'NEE'],
    Benchmark: ['SPY'], // S&P 500 for comparison
  };

  // Stocks already populated
  const alreadyDone = ['AAPL', 'MSFT', 'GOOGL', 'META', 'NVDA', 'TSLA', 'AMZN'];

  // Collect stocks to populate
  const stocksToPopulate: string[] = [];

  Object.entries(demoStocks).forEach(([category, stocks]) => {
    console.log(`\n${category}:`);
    stocks.forEach((symbol) => {
      if (alreadyDone.includes(symbol)) {
        console.log(`  ✓ ${symbol} - Already populated`);
      } else {
        console.log(`  ○ ${symbol} - Will populate`);
        stocksToPopulate.push(symbol);
      }
    });
  });

  console.log(`\n${stocksToPopulate.length} stocks to populate...`);
  console.log('This will take about 2-3 minutes.\n');

  let success = 0;
  let failed = 0;

  for (const symbol of stocksToPopulate) {
    console.log(`\nFetching ${symbol}...`);

    try {
      // Fetch current price
      const quote = await yahooService.fetchCurrentPrice(symbol);

      if (quote) {
        yahooService.saveQuotesToDatabase(new Map([[symbol, quote]]));
        console.log(`  ✓ Price: $${quote.regularMarketPrice.toFixed(2)}`);
        console.log(
          `  ✓ Change: ${quote.regularMarketChangePercent.toFixed(2)}%`
        );

        // Fetch 30 days history
        const end = new Date();
        const start = new Date();
        start.setDate(start.getDate() - 30);

        const history = await yahooService.fetchHistoricalData(
          symbol,
          start,
          end,
          '1d'
        );

        if (history && history.length > 0) {
          stockDb.bulkInsertDaily(history);
          console.log(`  ✓ History: ${history.length} days`);
        }

        // Generate today's 5-min data
        const fiveMin = generateIntradayData(symbol, quote.regularMarketPrice);
        stockDb.bulkInsert5Min(fiveMin);
        console.log(`  ✓ Intraday: ${fiveMin.length} points`);

        success++;
      }
    } catch (error: any) {
      console.error(`  ✗ Failed: ${error.message}`);
      failed++;
    }

    // Delay to avoid rate limits
    await new Promise((r) => setTimeout(r, 2000));
  }

  console.log('\n' + '='.repeat(50));
  console.log('DEMO POPULATION COMPLETE');
  console.log('='.repeat(50));
  console.log(`✓ Successfully populated: ${success} stocks`);
  console.log(`✓ Already had: ${alreadyDone.length} stocks`);
  console.log(`✓ Total demo stocks: ${success + alreadyDone.length}`);
  if (failed > 0) {
    console.log(`✗ Failed: ${failed} stocks`);
  }

  // Show all available stocks
  console.log('\nAll Demo Stocks with Prices:');
  const prices = stockDb.getLatestPrices();

  Object.keys(demoStocks).forEach((category) => {
    console.log(`\n${category}:`);
    demoStocks[category as keyof typeof demoStocks].forEach((symbol) => {
      const price = prices.find((p: any) => p.symbol === symbol);
      if (price) {
        const change = price.change_percent > 0 ? '+' : '';
        console.log(
          `  ${symbol}: $${price.price.toFixed(
            2
          )} (${change}${price.change_percent.toFixed(2)}%)`
        );
      } else {
        console.log(`  ${symbol}: No data`);
      }
    });
  });

  process.exit(0);
}

function generateIntradayData(symbol: string, basePrice: number) {
  const data = [];
  const today = new Date();

  for (let hour = 9; hour < 16; hour++) {
    for (let min = 0; min < 60; min += 5) {
      if (hour === 9 && min < 30) continue;

      const time = new Date(today);
      time.setHours(hour, min, 0, 0);

      const variance = (Math.random() - 0.5) * 0.01;
      const price = basePrice * (1 + variance);

      data.push({
        symbol,
        timestamp: time.toISOString(),
        open: price * (1 + (Math.random() - 0.5) * 0.001),
        high: price * (1 + Math.random() * 0.002),
        low: price * (1 - Math.random() * 0.002),
        close: price,
        volume: Math.floor(Math.random() * 1000000),
      });
    }
  }

  return data;
}

populateDemoStocks().catch(console.error);
