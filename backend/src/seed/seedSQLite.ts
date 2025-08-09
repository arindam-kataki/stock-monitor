// backend/src/seed/seedSQLite.ts
import stockDb from '../services/sqliteService';
import { Category, StockMetadata } from '../services/sqliteService';

async function seedDatabase() {
  console.log('Starting database seed...');

  // 1. Insert Categories
  const categories: Category[] = [
    {
      id: 'tech',
      name: 'Technology',
      icon: '💻',
      description: 'Technology sector stocks',
      color: '#667eea',
      order_index: 1,
      is_active: true
    },
    {
      id: 'healthcare',
      name: 'Healthcare',
      icon: '🏥',
      description: 'Healthcare and pharmaceutical stocks',
      color: '#28a745',
      order_index: 2,
      is_active: true
    },
    {
      id: 'finance',
      name: 'Finance',
      icon: '🏦',
      description: 'Financial services and banking',
      color: '#ffc107',
      order_index: 3,
      is_active: true
    },
    {
      id: 'retail',
      name: 'Retail',
      icon: '🛍️',
      description: 'Retail and consumer goods',
      color: '#dc3545',
      order_index: 4,
      is_active: true
    },
    {
      id: 'energy',
      name: 'Energy',
      icon: '⚡',
      description: 'Energy and utilities',
      color: '#17a2b8',
      order_index: 5,
      is_active: true
    }
  ];

  categories.forEach(cat => stockDb.upsertCategory(cat));
  console.log(`✓ Inserted ${categories.length} categories`);

  // 2. Insert Stock Metadata
  const stocks: StockMetadata[] = [
    // Tech stocks
    { symbol: 'AAPL', name: 'Apple Inc.', category_id: 'tech', market_cap: 'Large Cap', sector: 'Technology', is_active: true },
    { symbol: 'MSFT', name: 'Microsoft', category_id: 'tech', market_cap: 'Large Cap', sector: 'Technology', is_active: true },
    { symbol: 'GOOGL', name: 'Alphabet', category_id: 'tech', market_cap: 'Large Cap', sector: 'Technology', is_active: true },
    { symbol: 'META', name: 'Meta', category_id: 'tech', market_cap: 'Large Cap', sector: 'Technology', is_active: true },
    { symbol: 'NVDA', name: 'NVIDIA', category_id: 'tech', market_cap: 'Large Cap', sector: 'Technology', is_active: true },
    
    // Healthcare stocks
    { symbol: 'JNJ', name: 'Johnson & Johnson', category_id: 'healthcare', market_cap: 'Large Cap', sector: 'Healthcare', is_active: true },
    { symbol: 'PFE', name: 'Pfizer', category_id: 'healthcare', market_cap: 'Large Cap', sector: 'Healthcare', is_active: true },
    { symbol: 'UNH', name: 'UnitedHealth', category_id: 'healthcare', market_cap: 'Large Cap', sector: 'Healthcare', is_active: true },
    
    // Finance stocks
    { symbol: 'JPM', name: 'JP Morgan', category_id: 'finance', market_cap: 'Large Cap', sector: 'Finance', is_active: true },
    { symbol: 'BAC', name: 'Bank of America', category_id: 'finance', market_cap: 'Large Cap', sector: 'Finance', is_active: true },
    { symbol: 'V', name: 'Visa', category_id: 'finance', market_cap: 'Large Cap', sector: 'Finance', is_active: true },
    
    // Add more stocks...
  ];

  stocks.forEach(stock => stockDb.upsertStockMetadata(stock));
  console.log(`✓ Inserted ${stocks.length} stocks`);

  // 3. Insert Default Settings
  const defaultSettings = {
    autoCycle: true,
    cycleInterval: 15,
    showVolume: true,
    enableNotifications: false,
    theme: 'light',
    defaultTimeRange: '5D'
  };

  Object.entries(defaultSettings).forEach(([key, value]) => {
    stockDb.updateSetting('default', key, value);
  });
  console.log('✓ Inserted default settings');

  // 4. Generate Sample Price Data (for testing)
  console.log('Generating sample price data...');
  
  const today = new Date();
  const symbols = stocks.map(s => s.symbol);
  
  symbols.forEach(symbol => {
    const dailyData = [];
    const basePrice = 100 + Math.random() * 400;
    
    // Generate 1 year of daily data
    for (let i = 365; i >= 0; i--) {
      const date = new Date(today);
      date.setDate(date.getDate() - i);
      
      const variation = (Math.random() - 0.5) * 10;
      const open = basePrice + variation;
      const close = open + (Math.random() - 0.5) * 5;
      const high = Math.max(open, close) + Math.random() * 2;
      const low = Math.min(open, close) - Math.random() * 2;
      
      dailyData.push({
        symbol,
        date: date.toISOString().split('T')[0],
        open: parseFloat(open.toFixed(2)),
        high: parseFloat(high.toFixed(2)),
        low: parseFloat(low.toFixed(2)),
        close: parseFloat(close.toFixed(2)),
        volume: Math.floor(Math.random() * 100000000)
      });
    }
    
    stockDb.bulkInsertDaily(dailyData);
  });
  
  console.log(`✓ Generated sample price data for ${symbols.length} stocks`);

  // 5. Show database stats
  const stats = stockDb.getDatabaseStats();
  console.log('\nDatabase Statistics:');
  console.log('-------------------');
  console.log(`Total Stocks: ${stats.totalStocks.count}`);
  console.log(`Daily Records: ${stats.totalDailyRecords.count}`);
  console.log(`Database Size: ${stats.databaseSize}`);
  
  console.log('\n✅ Database seeding completed!');
}

// Run if called directly
if (require.main === module) {
  seedDatabase()
    .then(() => {
      stockDb.close();
      process.exit(0);
    })
    .catch(error => {
      console.error('Seed error:', error);
      stockDb.close();
      process.exit(1);
    });
}

export default seedDatabase;