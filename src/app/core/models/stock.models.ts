export interface Stock {
  symbol: string;
  name: string;
  price: number;
  previousClose: number;
  change: number;
  changePercent: number;
  volume: number;
  marketCap?: number;
  dayHigh?: number;
  dayLow?: number;
}

export interface StockData {
  timestamp: Date;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export interface Category {
  id: string;
  name: string;
  icon: string;
  stocks: Stock[];
  selected?: boolean;
}

export enum TimeRange {
  ONE_DAY = '1D',
  FIVE_DAYS = '5D',
  ONE_MONTH = '1M',
  SIX_MONTHS = '6M',
  ONE_YEAR = '1Y',
  FIVE_YEARS = '5Y',
}

export interface CycleSettings {
  enabled: boolean;
  intervalSeconds: number;
  categories: string[];
}
