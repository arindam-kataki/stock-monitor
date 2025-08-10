// src/app/core/models/stock.models.ts

/**
 * Stock Interface
 */
export interface Stock {
  symbol: string;
  name: string;
  price?: number;
  change?: number;
  changePercent?: number;
  volume?: number;
  marketCap?: string;
  sector?: string; // Optional sector field
  description?: string;
}

/**
 * Category Interface (used as templates for ribbons)
 */
export interface Category {
  id: string;
  name: string;
  icon: string;
  description?: string;
  color?: string;
  order_index?: number;
  stocks: Stock[];
  isActive?: boolean;
}

/**
 * Ribbon Interface (user-created category instances)
 */
export interface Ribbon {
  id: number;
  name: string;
  categoryId: string;
  categoryName?: string;
  icon: string;
  color: string;
  orderIndex: number;
  isActive: boolean;
  selectedStocks: string[]; // Array of stock symbols
  createdAt?: string;
  updatedAt?: string;
}

/**
 * Chart Data Interface
 */
export interface ChartData {
  symbol: string;
  range: string;
  count: number;
  data: ChartDataPoint[];
}

/**
 * Chart Data Point
 */
export interface ChartDataPoint {
  date?: string;
  timestamp?: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

/**
 * Stock Price Data
 */
export interface StockPrice {
  symbol: string;
  price: number;
  change: number;
  changePercent: number;
  volume: number;
  timestamp: string;
}

/**
 * User Selection Interface
 */
export interface UserSelection {
  userId?: string;
  categoryId: string;
  symbol: string;
  selected: boolean;
  selectedAt?: string;
}

/**
 * Stock Statistics
 */
export interface StockStats {
  symbol: string;
  high52Week: number;
  low52Week: number;
  avgVolume: number;
  marketCap: string;
  peRatio?: number;
  dividend?: number;
  beta?: number;
}

/**
 * Time Range Options
 */
export type TimeRange = '1D' | '5D' | '1M' | '3M' | '6M' | '1Y' | '5Y' | 'MAX';

/**
 * Sort Options
 */
export interface SortOption {
  field: 'symbol' | 'name' | 'price' | 'change' | 'volume' | 'marketCap';
  direction: 'asc' | 'desc';
}

/**
 * Filter Options
 */
export interface FilterOptions {
  categories?: string[];
  minPrice?: number;
  maxPrice?: number;
  minVolume?: number;
  sectors?: string[];
  searchQuery?: string;
}

/**
 * Dashboard View Mode
 */
export type ViewMode = 'grid' | 'list' | 'chart' | 'table';

/**
 * Notification Type
 */
export interface StockNotification {
  id: string;
  type: 'price_alert' | 'volume_spike' | 'news' | 'earnings';
  symbol: string;
  message: string;
  timestamp: string;
  read: boolean;
  severity: 'info' | 'warning' | 'success' | 'error';
}

/**
 * Watchlist Interface
 */
export interface Watchlist {
  id: number;
  name: string;
  symbols: string[];
  createdAt: string;
  updatedAt: string;
}

/**
 * Export Configuration
 */
export interface ExportConfig {
  ribbons: Ribbon[];
  settings: any;
  exportDate: string;
  version?: string;
}
