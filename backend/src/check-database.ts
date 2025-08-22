// backend/src/check-database.ts
// Quick script to check database contents

import stockDb from './services/sqliteService';

function checkDatabase() {
  console.log('Checking database contents...\n');

  // Check real-time prices
  const prices = stockDb.getLatestPrices();
  console.log(`Real-time prices: ${prices.length} stocks`);
  if (prices.length > 0) {
    console.log('Sample prices:');
    prices.slice(0, 3).forEach((p: any) => {
      console.log(`  ${p.symbol}: $${p.price} (${p.change_percent}%)`);
    });
  }

  // Check categories
  const categories = stockDb.getAllCategories();
  console.log(`\nCategories: ${categories.length}`);
  categories.forEach((cat) => {
    console.log(`  ${cat.name}: ${cat.stocks.length} stocks`);
  });

  // Check chart data for common stocks
  const testSymbols = ['AAPL', 'MSFT', 'GOOGL', 'NVDA'];
  console.log('\nChart data availability:');

  testSymbols.forEach((symbol) => {
    const daily = stockDb.getDailyData(symbol);
    const fiveMin = stockDb.get5MinData(symbol);
    const chart1D = stockDb.getChartData(symbol, '1D');
    const chart1M = stockDb.getChartData(symbol, '1M');

    console.log(`\n${symbol}:`);
    console.log(`  Daily data: ${daily.length} records`);
    console.log(`  5-min data: ${fiveMin.length} records`);
    console.log(`  Chart 1D: ${chart1D.length} points`);
    console.log(`  Chart 1M: ${chart1M.length} points`);

    if (chart1D.length > 0) {
      const latest = chart1D[chart1D.length - 1];
      console.log(`  Latest: $${latest.close?.toFixed(2) || 'N/A'}`);
    }
  });

  // Check ribbons
  const ribbons = stockDb.getUserRibbons();
  console.log(`\nRibbons: ${ribbons.length}`);
  ribbons.forEach((r: any) => {
    console.log(`  ${r.name}: ${r.stocks?.length || 0} stocks`);
  });

  process.exit(0);
}

checkDatabase();
