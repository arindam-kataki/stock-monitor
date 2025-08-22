// backend/src/seed/sqlite-demo-seed.ts
// Demo seed using SQLite only - no MongoDB required!

import stockDb from '../services/sqliteService';

function seedSQLiteDemo() {
  console.log('Seeding demo data to SQLite...\n');
  
  // Define demo categories
  const demoCategories = [
    {
      id: 'tech',
      name: 'Technology',
      icon: 'computer',
      description: 'Leading technology companies',
      color: '#4285F4',
      order_index: 1,
      is_active: true,
      stocks: [
        { symbol: 'AAPL', name: 'Apple Inc.', marketCap: '3.5T' },
        { symbol: 'MSFT', name: 'Microsoft Corporation', marketCap: '3.1T' },
        { symbol: 'NVDA', name: 'NVIDIA Corporation', marketCap: '3.0T' },
        { symbol: 'GOOGL', name: 'Alphabet Inc.', marketCap: '2.1T' },
      ]
    },
    {
      id: 'healthcare',
      name: 'Healthcare',
      icon: 'local_hospital',
      description: 'Healthcare and pharmaceutical companies',
      color: '#EA4335',
      order_index: 2,
      is_active: true,
      stocks: [
        { symbol: 'JNJ', name: 'Johnson & Johnson', marketCap: '380B' },
        { symbol: 'UNH', name: 'UnitedHealth Group', marketCap: '530B' },
        { symbol: 'PFE', name: 'Pfizer Inc.', marketCap: '160B' },
      ]
    },
    {
      id: 'finance',
      name: 'Finance',
      icon: 'account_balance',
      description: 'Financial services and banking',
      color: '#34A853',
      order_index: 3,
      is_active: true,
      stocks: [
        { symbol: 'JPM', name: 'JPMorgan Chase & Co.', marketCap: '600B' },
        { symbol: 'V', name: 'Visa Inc.', marketCap: '560B' },
        { symbol: 'BAC', name: 'Bank of America', marketCap: '350B' },
      ]
    },
    {
      id: 'retail',
      name: 'Consumer',
      icon: 'shopping_cart',
      description: 'Retail and consumer companies',
      color: '#FBBC04',
      order_index: 4,
      is_active: true,
      stocks: [
        { symbol: 'AMZN', name: 'Amazon.com Inc.', marketCap: '1.9T' },
        { symbol: 'WMT', name: 'Walmart Inc.', marketCap: '670B' },
        { symbol: 'HD', name: 'The Home Depot', marketCap: '410B' },
        { symbol: 'TSLA', name: 'Tesla Inc.', marketCap: '1.1T' },
      ]
    },
    {
      id: 'energy',
      name: 'Energy',
      icon: 'bolt',
      description: 'Energy and utilities companies',
      color: '#9333EA',
      order_index: 5,
      is_active: true,
      stocks: [
        { symbol: 'XOM', name: 'Exxon Mobil', marketCap: '520B' },
        { symbol: 'CVX', name: 'Chevron Corporation', marketCap: '290B' },
        { symbol: 'NEE', name: 'NextEra Energy', marketCap: '150B' },
      ]
    },
    {
      id: 'diversified',
      name: 'Diversified',
      icon: 'pie_chart',
      description: 'Diversified holdings and ETFs',
      color: '#10B981',
      order_index: 6,
      is_active: true,
      stocks: [
        { symbol: 'META', name: 'Meta Platforms', marketCap: '1.3T' },
        { symbol: 'BRK.B', name: 'Berkshire Hathaway', marketCap: '980B' },
        { symbol: 'SPY', name: 'S&P 500 ETF', marketCap: '480B' },
      ]
    }
  ];
  
  // Save categories to SQLite
  demoCategories.forEach(category => {
    stockDb.upsertCategory(category as any);
    console.log(`✓ Created category: ${category.name}`);
    
    // Save stock metadata
    category.stocks.forEach(stock => {
      stockDb.upsertStockMetadata({
        symbol: stock.symbol,
        name: stock.name,
        category_id: category.id,
        market_cap: stock.marketCap,
        sector: category.name,
        description: '',
        is_active: true
      });
    });
  });
  
  // Create demo ribbons
  const demoRibbons = [
    {
      id: 1,
      user_id: 'demo-user',
      name: 'Tech Giants',
      category_id: 'tech',
      icon: 'trending_up',
      color: '#4285F4',
      order_index: 1,
      is_active: true,
      stocks: [
        { symbol: 'AAPL', is_selected: true },
        { symbol: 'MSFT', is_selected: true },
        { symbol: 'NVDA', is_selected: true },
        { symbol: 'GOOGL', is_selected: true },
      ]
    },
    {
      id: 2,
      user_id: 'demo-user',
      name: 'Market Leaders',
      category_id: 'diversified',
      icon: 'star',
      color: '#10B981',
      order_index: 2,
      is_active: true,
      stocks: [
        { symbol: 'META', is_selected: true },
        { symbol: 'BRK.B', is_selected: true },
        { symbol: 'SPY', is_selected: true },
      ]
    },
    {
      id: 3,
      user_id: 'demo-user',
      name: 'Value Picks',
      category_id: 'finance',
      icon: 'account_balance',
      color: '#34A853',
      order_index: 3,
      is_active: true,
      stocks: [
        { symbol: 'JPM', is_selected: true },
        { symbol: 'V', is_selected: true },
        { symbol: 'BAC', is_selected: true },
      ]
    }
  ];
  
  // Create ribbons using SQLite methods
  demoRibbons.forEach(ribbon => {
    const result = stockDb.createRibbon({
      user_id: ribbon.user_id,
      name: ribbon.name,
      category_id: ribbon.category_id,
      icon: ribbon.icon,
      color: ribbon.color,
      order_index: ribbon.order_index,
      is_active: ribbon.is_active
    });
    
    console.log(`✓ Created ribbon: ${ribbon.name}`);
    
    // Add stocks to ribbon
    ribbon.stocks.forEach(stock => {
      stockDb.addStockToRibbon(result.lastInsertRowid as number, stock.symbol, stock.is_selected);
    });
  });
  
  // Add default settings
  stockDb.updateSetting('autoCycle', 'true');
  stockDb.updateSetting('cycleInterval', '15');
  stockDb.updateSetting('showVolume', 'true');
  stockDb.updateSetting('theme', 'light');
  
  console.log('\n✓ SQLite demo seed complete!');
  console.log(`  ${demoCategories.length} categories`);
  console.log(`  20 stocks`);
  console.log(`  ${demoRibbons.length} ribbons`);
  console.log('\nNo MongoDB required! 🎉');
  
  // Show what's in the database
  const categories = stockDb.getAllCategories();
  const ribbons = stockDb.getUserRibbons('demo-user');
  const prices = stockDb.getLatestPrices();
  
  console.log(`\nVerification:`);
  console.log(`  Categories in DB: ${categories.length}`);
  console.log(`  Ribbons in DB: ${ribbons.length}`);
  console.log(`  Stocks with prices: ${prices.length}`);
  
  process.exit(0);
}

// Run the seed
seedSQLiteDemo();