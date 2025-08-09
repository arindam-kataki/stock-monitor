import mongoose from 'mongoose';
import dotenv from 'dotenv';
import Category from '../models/Category';

dotenv.config();

const seedData = [
  {
    id: 'tech',
    name: 'Technology',
    icon: '💻',
    description: 'Technology sector stocks',
    color: '#667eea',
    order: 1,
    stocks: [
      { symbol: 'AAPL', name: 'Apple Inc.', marketCap: 'Large Cap' },
      { symbol: 'MSFT', name: 'Microsoft', marketCap: 'Large Cap' },
      { symbol: 'GOOGL', name: 'Alphabet', marketCap: 'Large Cap' },
      { symbol: 'META', name: 'Meta', marketCap: 'Large Cap' },
      { symbol: 'NVDA', name: 'NVIDIA', marketCap: 'Large Cap' },
      { symbol: 'AMD', name: 'AMD', marketCap: 'Large Cap' },
      { symbol: 'TSLA', name: 'Tesla', marketCap: 'Large Cap' },
      { symbol: 'INTC', name: 'Intel', marketCap: 'Large Cap' },
    ],
  },
  {
    id: 'healthcare',
    name: 'Healthcare',
    icon: '🏥',
    description: 'Healthcare and pharmaceutical stocks',
    color: '#28a745',
    order: 2,
    stocks: [
      { symbol: 'JNJ', name: 'Johnson & Johnson', marketCap: 'Large Cap' },
      { symbol: 'PFE', name: 'Pfizer', marketCap: 'Large Cap' },
      { symbol: 'UNH', name: 'UnitedHealth', marketCap: 'Large Cap' },
      { symbol: 'CVS', name: 'CVS Health', marketCap: 'Large Cap' },
      { symbol: 'ABBV', name: 'AbbVie', marketCap: 'Large Cap' },
      { symbol: 'MRK', name: 'Merck', marketCap: 'Large Cap' },
    ],
  },
  {
    id: 'finance',
    name: 'Finance',
    icon: '🏦',
    description: 'Financial services and banking stocks',
    color: '#ffc107',
    order: 3,
    stocks: [
      { symbol: 'JPM', name: 'JP Morgan', marketCap: 'Large Cap' },
      { symbol: 'BAC', name: 'Bank of America', marketCap: 'Large Cap' },
      { symbol: 'V', name: 'Visa', marketCap: 'Large Cap' },
      { symbol: 'MA', name: 'Mastercard', marketCap: 'Large Cap' },
      { symbol: 'GS', name: 'Goldman Sachs', marketCap: 'Large Cap' },
      { symbol: 'MS', name: 'Morgan Stanley', marketCap: 'Large Cap' },
    ],
  },
];

async function seedDatabase() {
  try {
    await mongoose.connect(process.env.MONGODB_URI!);
    console.log('Connected to MongoDB');

    // Clear existing data
    await Category.deleteMany({});
    console.log('Cleared existing categories');

    // Insert seed data
    await Category.insertMany(seedData);
    console.log('Seed data inserted successfully');

    process.exit(0);
  } catch (error) {
    console.error('Seed error:', error);
    process.exit(1);
  }
}

seedDatabase();
