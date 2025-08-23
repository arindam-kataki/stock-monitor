// backend/src/populate-stocks.ts
import stockDb from './services/sqliteService';
import yahooService from './services/yahooService';

async function populateStocks() {
  console.log('Starting stock data population...\n');

  // Get all unique stocks from categories
  const categories = stockDb.getAllCategories();
  const allStocks = [
    ...new Set(categories.flatMap((c) => c.stocks.map((s) => s.symbol))),
  ];

  console.log(`Found ${allStocks.length} unique stocks to populate:`);
  console.log(allStocks.join(', '));
  console.log('\n');

  // Check which stocks already have price data
  const existingPrices = stockDb.getLatestPrices();
  const existingSymbols = existingPrices.map((p: any) => p.symbol);
  const missingStocks = allStocks.filter((s) => !existingSymbols.includes(s));

  if (missingStocks.length === 0) {
    console.log('✅ All stocks already have price data!');

    // Show current prices
    console.log('\nCurrent stock prices:');
    allStocks.forEach((symbol) => {
      const price = existingPrices.find((p: any) => p.symbol === symbol);
      if (price) {
        console.log(
          `  ${symbol}: $${price.price.toFixed(2)} (${
            price.change_percent > 0 ? '+' : ''
          }${price.change_percent.toFixed(2)}%)`
        );
      }
    });

    console.log('\n✅ Database is ready for demo!');
    return;
  }

  console.log(
    `Need to fetch data for ${
      missingStocks.length
    } stocks: ${missingStocks.join(', ')}\n`
  );

  // Populate missing stocks
  for (const symbol of missingStocks) {
    try {
      console.log(`Fetching ${symbol}...`);

      // Get quote data using the correct method name
      const quote = await yahooService.fetchCurrentPrice(symbol);
      if (quote) {
        // Update real-time price
        stockDb.updateRealtimePrice(
          symbol,
          quote.regularMarketPrice,
          quote.regularMarketChange,
          quote.regularMarketChangePercent,
          quote.regularMarketVolume
        );
        console.log(`  ✓ Price: ${quote.regularMarketPrice.toFixed(2)}`);
      }

      // Get historical data (30 days)
      console.log(`  Fetching historical data...`);
      const endDate = new Date();
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - 30);

      const historical = await yahooService.fetchHistoricalData(
        symbol,
        startDate,
        endDate,
        '1d'
      );
      if (historical && historical.length > 0) {
        // Bulk insert historical data
        const dailyData = historical.map((h: any) => ({
          symbol: symbol,
          date: new Date(h.date).toISOString().split('T')[0],
          open: h.open,
          high: h.high,
          low: h.low,
          close: h.close,
          volume: h.volume,
        }));
        stockDb.bulkInsertDaily(dailyData);
        console.log(`  ✓ Added ${dailyData.length} days of historical data`);
      }

      // Small delay to avoid rate limiting
      await new Promise((resolve) => setTimeout(resolve, 1000));
    } catch (error) {
      console.error(`  ✗ Error fetching ${symbol}:`, error);
      console.log('  Continuing with next stock...');
    }
  }

  // Show summary
  console.log('\n📊 Population Summary:');
  console.log('=======================');

  const finalPrices = stockDb.getLatestPrices();
  const successCount = allStocks.filter((s) =>
    finalPrices.some((p: any) => p.symbol === s)
  ).length;

  console.log(`Total stocks needed: ${allStocks.length}`);
  console.log(`Successfully populated: ${successCount}`);
  console.log(`Failed: ${allStocks.length - successCount}`);

  if (successCount === allStocks.length) {
    console.log('\n✅ All stocks successfully populated!');
    console.log('\nSample prices:');
    allStocks.slice(0, 5).forEach((symbol) => {
      const price = finalPrices.find((p: any) => p.symbol === symbol);
      if (price) {
        console.log(
          `  ${symbol}: $${price.price.toFixed(2)} (${
            price.change_percent > 0 ? '+' : ''
          }${price.change_percent.toFixed(2)}%)`
        );
      }
    });
  } else {
    const failedStocks = allStocks.filter(
      (s) => !finalPrices.some((p: any) => p.symbol === s)
    );
    console.log(`\n⚠️  Failed to populate: ${failedStocks.join(', ')}`);
    console.log('You may want to run the script again for failed stocks.');
  }

  console.log('\n✅ Stock population completed!');
  console.log('\nNext steps:');
  console.log('1. Start the backend: npm run dev');
  console.log('2. Start the frontend: ng serve');
  console.log('3. Navigate to http://localhost:4200');
}

// Run if called directly
if (require.main === module) {
  populateStocks()
    .then(() => {
      stockDb.close();
      process.exit(0);
    })
    .catch((error) => {
      console.error('Population error:', error);
      stockDb.close();
      process.exit(1);
    });
}

export default populateStocks;
