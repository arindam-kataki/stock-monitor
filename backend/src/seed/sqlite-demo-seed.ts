// backend/src/seed/clean-demo-seed.ts
import stockDb from '../services/sqliteService';

function cleanDemoSeed(purgeOldData: boolean = false) {
  console.log('🚀 Starting Clean Demo Seed...\n');
  
  // Optional: Clean existing data
  if (purgeOldData) {
    console.log('🧹 Purging old data...');
    try {
      // Use the execute method which is public
      stockDb.execute('DELETE FROM ribbon_stocks', []);
      stockDb.execute('DELETE FROM ribbons', []);
      stockDb.execute('DELETE FROM user_selections', []);
      stockDb.execute('DELETE FROM stocks_realtime', []);
      stockDb.execute('DELETE FROM stocks_daily', []);
      stockDb.execute('DELETE FROM stocks_5min', []);
      stockDb.execute('DELETE FROM stock_metadata', []);
      stockDb.execute('DELETE FROM categories', []);
      stockDb.execute('DELETE FROM settings', []);
      
      console.log('✓ Old data purged\n');
    } catch (error) {
      console.error('Error purging data:', error);
      console.log('Continuing with seed...\n');
    }
  }
  
  // Define 9 categories with 30 total stocks
  const demoCategories = [
    {
      id: 'technology',
      name: 'Technology',
      icon: '💻',
      description: 'Software, hardware, and cloud computing',
      color: '#4285F4',
      order_index: 1,
      is_active: true,
      stocks: [
        { symbol: 'AAPL', name: 'Apple Inc.', marketCap: '3.5T' },
        { symbol: 'MSFT', name: 'Microsoft Corporation', marketCap: '3.1T' },
        { symbol: 'GOOGL', name: 'Alphabet Inc.', marketCap: '2.1T' },
        { symbol: 'NVDA', name: 'NVIDIA Corporation', marketCap: '3.0T' },
        { symbol: 'ORCL', name: 'Oracle Corporation', marketCap: '500B' },
      ]
    },
    {
      id: 'media',
      name: 'Media & Entertainment',
      icon: '🎬',
      description: 'Streaming, entertainment, and media companies',
      color: '#9333EA',
      order_index: 2,
      is_active: true,
      stocks: [
        { symbol: 'DIS', name: 'Walt Disney Co.', marketCap: '200B' },
        { symbol: 'NFLX', name: 'Netflix Inc.', marketCap: '240B' },
        { symbol: 'META', name: 'Meta Platforms', marketCap: '1.3T' },
      ]
    },
    {
      id: 'ecommerce',
      name: 'E-Commerce & Retail',
      icon: '🛒',
      description: 'Online retail and e-commerce platforms',
      color: '#F97316',
      order_index: 3,
      is_active: true,
      stocks: [
        { symbol: 'AMZN', name: 'Amazon.com Inc.', marketCap: '1.9T' },
        { symbol: 'SHOP', name: 'Shopify Inc.', marketCap: '135B' },
        { symbol: 'EBAY', name: 'eBay Inc.', marketCap: '35B' },
      ]
    },
    {
      id: 'finance',
      name: 'Finance',
      icon: '🏦',
      description: 'Banks and payment processors',
      color: '#10B981',
      order_index: 4,
      is_active: true,
      stocks: [
        { symbol: 'JPM', name: 'JPMorgan Chase', marketCap: '600B' },
        { symbol: 'V', name: 'Visa Inc.', marketCap: '560B' },
        { symbol: 'MA', name: 'Mastercard Inc.', marketCap: '450B' },
        { symbol: 'PYPL', name: 'PayPal Holdings', marketCap: '70B' },
      ]
    },
    {
      id: 'healthcare',
      name: 'Healthcare',
      icon: '🏥',
      description: 'Healthcare and pharmaceutical companies',
      color: '#EF4444',
      order_index: 5,
      is_active: true,
      stocks: [
        { symbol: 'JNJ', name: 'Johnson & Johnson', marketCap: '380B' },
        { symbol: 'UNH', name: 'UnitedHealth Group', marketCap: '530B' },
        { symbol: 'PFE', name: 'Pfizer Inc.', marketCap: '160B' },
      ]
    },
    {
      id: 'automobile',
      name: 'Automobile',
      icon: '🚗',
      description: 'Automotive manufacturers',
      color: '#8B5CF6',
      order_index: 6,
      is_active: true,
      stocks: [
        { symbol: 'TSLA', name: 'Tesla Inc.', marketCap: '1.1T' },
        { symbol: 'GM', name: 'General Motors', marketCap: '65B' },
        { symbol: 'TM', name: 'Toyota Motor Corp.', marketCap: '250B' },
        { symbol: 'F', name: 'Ford Motor Co.', marketCap: '50B' },
      ]
    },
    {
      id: 'retail',
      name: 'Retail & Consumer',
      icon: '🛍️',
      description: 'Retail stores and consumer goods',
      color: '#FACC15',
      order_index: 7,
      is_active: true,
      stocks: [
        { symbol: 'WMT', name: 'Walmart Inc.', marketCap: '670B' },
        { symbol: 'HD', name: 'The Home Depot', marketCap: '410B' },
        { symbol: 'NKE', name: 'Nike Inc.', marketCap: '120B' },
        { symbol: 'SBUX', name: 'Starbucks Corp.', marketCap: '115B' },
      ]
    },
    {
      id: 'energy',
      name: 'Energy',
      icon: '⚡',
      description: 'Energy and utilities companies',
      color: '#06B6D4',
      order_index: 8,
      is_active: true,
      stocks: [
        { symbol: 'XOM', name: 'Exxon Mobil', marketCap: '520B' },
        { symbol: 'CVX', name: 'Chevron Corporation', marketCap: '290B' },
        { symbol: 'NEE', name: 'NextEra Energy', marketCap: '150B' },
      ]
    },
    {
      id: 'etfs',
      name: 'ETFs & Indices',
      icon: '📊',
      description: 'Exchange-traded funds and market indices',
      color: '#64748B',
      order_index: 9,
      is_active: true,
      stocks: [
        { symbol: 'SPY', name: 'SPDR S&P 500 ETF', marketCap: '480B' },
        { symbol: 'QQQ', name: 'Invesco QQQ Trust', marketCap: '250B' },
      ]
    }
  ];

  // Insert categories and stock metadata
  console.log('📁 Creating categories and stocks...');
  let totalStocks = 0;
  
  demoCategories.forEach(category => {
    try {
      // Insert/update category
      stockDb.upsertCategory({
        id: category.id,
        name: category.name,
        icon: category.icon,
        description: category.description,
        color: category.color,
        order_index: category.order_index,
        is_active: category.is_active,
        stocks: []
      });
      
      // Insert stock metadata
      category.stocks.forEach(stock => {
        stockDb.upsertStockMetadata({
          symbol: stock.symbol,
          name: stock.name,
          category_id: category.id,
          market_cap: stock.marketCap,
          sector: category.name,
          description: `${stock.name} - ${category.description}`,
          is_active: true
        });
        totalStocks++;
      });
      
      console.log(`  ✓ ${category.icon} ${category.name}: ${category.stocks.length} stocks`);
    } catch (error) {
      console.error(`  ✗ Error with ${category.name}:`, error);
    }
  });
  
  console.log(`\n✓ Created ${demoCategories.length} categories with ${totalStocks} stocks total\n`);

  // Create demo ribbons - one for each category
  const demoRibbons = [
    {
      name: 'Technology',
      categoryId: 'technology',
      stocks: ['AAPL', 'MSFT', 'GOOGL', 'NVDA', 'ORCL'],
      icon: '💻',
      color: '#4285F4'
    },
    {
      name: 'Media & Entertainment',
      categoryId: 'media',
      stocks: ['DIS', 'NFLX', 'META'],
      icon: '🎬',
      color: '#9333EA'
    },
    {
      name: 'E-Commerce & Retail',
      categoryId: 'ecommerce',
      stocks: ['AMZN', 'SHOP', 'EBAY'],
      icon: '🛒',
      color: '#F97316'
    },
    {
      name: 'Finance',
      categoryId: 'finance',
      stocks: ['JPM', 'V', 'MA', 'PYPL'],
      icon: '🏦',
      color: '#10B981'
    },
    {
      name: 'Healthcare',
      categoryId: 'healthcare',
      stocks: ['JNJ', 'UNH', 'PFE'],
      icon: '🏥',
      color: '#EF4444'
    },
    {
      name: 'Automobile',
      categoryId: 'automobile',
      stocks: ['TSLA', 'GM', 'TM', 'F'],
      icon: '🚗',
      color: '#8B5CF6'
    },
    {
      name: 'Retail & Consumer',
      categoryId: 'retail',
      stocks: ['WMT', 'HD', 'NKE', 'SBUX'],
      icon: '🛍️',
      color: '#FACC15'
    },
    {
      name: 'Energy',
      categoryId: 'energy',
      stocks: ['XOM', 'CVX', 'NEE'],
      icon: '⚡',
      color: '#06B6D4'
    },
    {
      name: 'ETFs',
      categoryId: 'etfs',
      stocks: ['SPY', 'QQQ'],
      icon: '📊',
      color: '#64748B'
    }
  ];

  console.log('🎯 Creating demo ribbons...');
  demoRibbons.forEach((ribbon, index) => {
    try {
      const ribbonId = stockDb.createRibbon({
        userId: 'default',  // Using 'default' for API compatibility
        name: ribbon.name,
        categoryId: ribbon.categoryId,
        icon: ribbon.icon,
        color: ribbon.color,
        orderIndex: index,
        isActive: true,
        selectedStocks: ribbon.stocks
      });
      console.log(`  ✓ ${ribbon.icon} ${ribbon.name}: ${ribbon.stocks.length} stocks`);
    } catch (error) {
      console.error(`  ✗ Error creating ${ribbon.name}:`, error);
    }
  });

  // Set demo settings
  const demoSettings = {
    autoCycle: true,
    cycleInterval: 15,
    showVolume: true,
    enableNotifications: false,
    theme: 'light',
    defaultTimeRange: '5D',
    demoMode: true,
    maxStocksPerView: 5,
    refreshInterval: 30
  };

  console.log('\n⚙️  Applying demo settings...');
  Object.entries(demoSettings).forEach(([key, value]) => {
    stockDb.updateSetting('default', key, value);  // Using 'default' user
  });
  console.log('✓ Settings applied');

  // Store the category list as a setting for reference
  stockDb.updateSetting('default', 'categories', JSON.stringify(
    demoCategories.map(c => ({
      id: c.id,
      name: c.name,
      stockCount: c.stocks.length
    }))
  ));

  // Summary
  const allStocks = demoCategories.flatMap(c => c.stocks.map(s => s.symbol));
  const uniqueStocks = [...new Set(allStocks)];
  
  console.log('\n' + '='.repeat(50));
  console.log('📊 DEMO CONFIGURATION COMPLETE');
  console.log('='.repeat(50));
  console.log(`Categories: ${demoCategories.length}`);
  console.log(`Total Stocks: ${uniqueStocks.length}`);
  console.log(`Ribbons: ${demoRibbons.length}`);
  console.log('\nStock Distribution:');
  demoCategories.forEach(c => {
    console.log(`  ${c.icon} ${c.name}: ${c.stocks.map(s => s.symbol).join(', ')}`);
  });
  
  console.log('\n📝 Next Steps:');
  console.log('1. Run: npx ts-node src/populate-stocks.ts');
  console.log('2. Start backend: npm run dev');
  console.log('3. Start frontend: ng serve');
  console.log('4. Open: http://localhost:4200');
  
  // Check for missing price data
  const existingPrices = stockDb.getLatestPrices();
  const existingSymbols = existingPrices.map((p: any) => p.symbol);
  const missingStocks = uniqueStocks.filter(s => !existingSymbols.includes(s));
  
  if (missingStocks.length > 0) {
    console.log(`\n⚠️  Missing price data for ${missingStocks.length} stocks:`);
    console.log(`   ${missingStocks.join(', ')}`);
  } else {
    console.log('\n✅ All stocks have price data!');
  }
}

// Run with command line argument
if (require.main === module) {
  const args = process.argv.slice(2);
  const shouldPurge = args.includes('--purge') || args.includes('-p');
  
  if (shouldPurge) {
    console.log('⚠️  PURGE MODE: This will delete all existing data!');
    console.log('Press Ctrl+C to cancel, or wait 3 seconds to continue...\n');
    setTimeout(() => {
      try {
        stockDb.createRibbonTables(); // Ensure tables exist
        cleanDemoSeed(true);
        stockDb.close();
        process.exit(0);
      } catch (error) {
        console.error('❌ Error:', error);
        stockDb.close();
        process.exit(1);
      }
    }, 3000);
  } else {
    try {
      stockDb.createRibbonTables(); // Ensure tables exist
      cleanDemoSeed(false);
      stockDb.close();
      process.exit(0);
    } catch (error) {
      console.error('❌ Error:', error);
      stockDb.close();
      process.exit(1);
    }
  }
}

export default cleanDemoSeed;