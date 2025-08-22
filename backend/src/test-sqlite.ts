// backend/src/test-sqlite.ts
import stockDb from './services/sqliteService';

console.log('Testing SQLite methods...\n');

// Check available methods
const methods = Object.getOwnPropertyNames(Object.getPrototypeOf(stockDb));
console.log(
  'Available methods:',
  methods.filter((m) => !m.startsWith('_')).join(', ')
);
console.log('\n');

// Test getting categories
try {
  const categories = stockDb.getAllCategories();
  console.log('✓ getAllCategories() works');
  console.log(
    `  Found ${categories.length} categories:`,
    categories.map((c) => c.name).join(', ')
  );
} catch (e: any) {
  console.log('✗ getAllCategories() failed:', e.message);
}

// Test getting latest prices
try {
  const prices = stockDb.getLatestPrices();
  console.log('\n✓ getLatestPrices() works');
  console.log(`  Found ${prices.length} prices in database`);

  if (prices.length > 0) {
    console.log('\n  Sample prices:');
    prices.slice(0, 3).forEach((p: any) => {
      console.log(
        `    ${p.symbol}: $${p.price} (${p.change_percent > 0 ? '+' : ''}${
          p.change_percent
        }%)`
      );
    });
  }
} catch (e: any) {
  console.log('✗ getLatestPrices() failed:', e.message);
}

// Test if we have real data from Yahoo
try {
  const applePrice = stockDb
    .getLatestPrices()
    .find((p: any) => p.symbol === 'AAPL');
  if (applePrice) {
    console.log('\n✓ Found AAPL in database:');
    console.log(`  Price: $${applePrice.price}`);
    console.log(
      `  Change: ${applePrice.change} (${applePrice.change_percent}%)`
    );
    console.log(`  Volume: ${applePrice.volume}`);
  }
} catch (e: any) {
  console.log('Error checking AAPL:', e.message);
}

process.exit(0);
