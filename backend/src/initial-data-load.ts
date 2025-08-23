// backend/src/scripts/initial-data-load.ts
import stockDb from '../src/services/sqliteService';
import yahooService from '../src/services/yahooService';

async function initialDataLoad() {
  console.log('🚀 INITIAL DATA LOAD - Setting up all historical data');
  console.log('='.repeat(50));
  console.log('This will download:');
  console.log('  • 5 years of daily historical data');
  console.log('  • Current real-time prices');
  console.log('  • Last 7 days of 5-minute intraday data');
  console.log('='.repeat(50) + '\n');

  // Get all stocks from categories
  const categories = stockDb.getAllCategories();
  const stocks = [
    ...new Set(categories.flatMap((c) => c.stocks.map((s) => s.symbol))),
  ];

  console.log(`📊 Found ${stocks.length} stocks to process:`);

  // Group stocks by category for display
  categories.forEach((cat) => {
    const catStocks = cat.stocks.map((s) => s.symbol).join(', ');
    console.log(`  ${cat.icon} ${cat.name}: ${catStocks}`);
  });
  console.log('');

  let successCount = 0;
  let partialCount = 0;
  const failedStocks: string[] = [];
  const startTime = Date.now();

  // Process each stock
  for (let i = 0; i < stocks.length; i++) {
    const symbol = stocks[i];
    const progress = `[${i + 1}/${stocks.length}]`;

    console.log(`\n${progress} Processing ${symbol}...`);
    console.log('─'.repeat(40));

    let hasQuote = false;
    let hasDaily = false;
    let hasIntraday = false;

    try {
      // 1. Get current real-time quote
      console.log('  📈 Fetching real-time quote...');
      const quote = await yahooService.fetchCurrentPrice(symbol);
      if (quote) {
        stockDb.updateRealtimePrice(
          symbol,
          quote.regularMarketPrice,
          quote.regularMarketChange,
          quote.regularMarketChangePercent,
          quote.regularMarketVolume
        );
        hasQuote = true;
        console.log(
          `     ✓ Price: $${quote.regularMarketPrice.toFixed(2)} (${
            quote.regularMarketChangePercent > 0 ? '+' : ''
          }${quote.regularMarketChangePercent.toFixed(2)}%)`
        );
      } else {
        console.log('     ⚠ No quote data available');
      }

      // 2. Get 5 years of daily historical data
      console.log('  📊 Fetching 5 years of daily data...');
      const endDate = new Date();
      const startDate = new Date();
      startDate.setFullYear(startDate.getFullYear() - 5);

      const dailyData = await yahooService.fetchHistoricalData(
        symbol,
        startDate,
        endDate,
        '1d'
      );

      if (dailyData && dailyData.length > 0) {
        const formattedDaily = dailyData.map((d: any) => ({
          symbol: symbol,
          date: new Date(d.date).toISOString().split('T')[0],
          open: d.open,
          high: d.high,
          low: d.low,
          close: d.close,
          volume: d.volume,
        }));

        stockDb.bulkInsertDaily(formattedDaily);
        hasDaily = true;

        // Show date range
        const firstDate = formattedDaily[0].date;
        const lastDate = formattedDaily[formattedDaily.length - 1].date;
        console.log(
          `     ✓ ${formattedDaily.length} days (${firstDate} to ${lastDate})`
        );
      } else {
        console.log('     ⚠ No historical data available');
      }

      // 3. Get last 7 days of 5-minute data (for intraday charts)
      console.log('  ⏱️  Fetching recent intraday data...');
      const intradayEnd = new Date();
      const intradayStart = new Date();
      intradayStart.setDate(intradayStart.getDate() - 7);

      try {
        const intradayData = await yahooService.fetchHistoricalData(
          symbol,
          intradayStart,
          intradayEnd,
          '5m'
        );

        if (intradayData && intradayData.length > 0) {
          intradayData.forEach((d: any) => {
            stockDb.upsert5MinData({
              symbol: symbol,
              timestamp: d.timestamp || d.date,
              open: d.open,
              high: d.high,
              low: d.low,
              close: d.close,
              volume: d.volume,
            });
          });
          hasIntraday = true;
          console.log(`     ✓ ${intradayData.length} data points`);
        } else {
          console.log('     ⚠ No intraday data (markets may be closed)');
        }
      } catch (intradayError) {
        console.log('     ⚠ Intraday data not available');
        // Not critical - some stocks don't have intraday
      }

      // Determine success level
      if (hasQuote && hasDaily) {
        successCount++;
        console.log(`  ✅ ${symbol} complete!`);
      } else if (hasQuote || hasDaily) {
        partialCount++;
        console.log(`  ⚠️ ${symbol} partially loaded`);
      } else {
        throw new Error('No data retrieved');
      }

      // Rate limiting - pause between requests
      if (i < stocks.length - 1) {
        await new Promise((resolve) => setTimeout(resolve, 1000));
      }
    } catch (error: any) {
      console.log(`  ❌ ${symbol} failed: ${error.message}`);
      failedStocks.push(symbol);
    }
  }

  const elapsedTime = ((Date.now() - startTime) / 1000 / 60).toFixed(1);

  // Summary Report
  console.log('\n' + '='.repeat(50));
  console.log('📊 INITIAL DATA LOAD COMPLETE');
  console.log('='.repeat(50));
  console.log(`⏱️  Time elapsed: ${elapsedTime} minutes`);
  console.log(`✅ Successful: ${successCount}/${stocks.length}`);
  if (partialCount > 0) {
    console.log(`⚠️  Partial: ${partialCount}`);
  }
  if (failedStocks.length > 0) {
    console.log(`❌ Failed: ${failedStocks.length}`);
    console.log(`   ${failedStocks.join(', ')}`);
  }

  // Database Statistics
  const stats = stockDb.getDatabaseStats();
  console.log('\n📈 Database Statistics:');
  console.log('─'.repeat(30));
  console.log(
    `Daily records: ${stats.totalDailyRecords.count.toLocaleString()}`
  );
  console.log(
    `Intraday records: ${stats.total5MinRecords.count.toLocaleString()}`
  );
  console.log(`Database size: ${stats.databaseSize}`);

  if (stats.oldestDailyData?.date && stats.newestDailyData?.date) {
    console.log(
      `Date range: ${stats.oldestDailyData.date} to ${stats.newestDailyData.date}`
    );
  }

  // Next Steps
  console.log('\n✨ Your app is ready with:');
  console.log('  • 5 years of historical data for long-term charts');
  console.log('  • Real-time prices for all stocks');
  console.log('  • Intraday data for detailed analysis');

  if (failedStocks.length > 0) {
    console.log('\n💡 To retry failed stocks:');
    console.log(`   npx ts-node src/scripts/initial-data-load.ts`);
    console.log('   (The script will update all stocks including failed ones)');
  }

  console.log('\n🚀 Next steps:');
  console.log('  1. Start backend: npm run dev');
  console.log('  2. Start frontend: ng serve');
  console.log('  3. Open: http://localhost:4200');
}

// Run if called directly
if (require.main === module) {
  initialDataLoad()
    .then(() => {
      console.log('\n✅ Script completed successfully');
      stockDb.close();
      process.exit(0);
    })
    .catch((error) => {
      console.error('\n❌ Fatal error:', error);
      stockDb.close();
      process.exit(1);
    });
}

export default initialDataLoad;
