// backend/src/routes/stockRoutes.ts

import { Router, Request, Response } from 'express';
import stockDb from '../services/sqliteService';
import yahooService from '../services/yahooService'; // <-- ADD THIS IMPORT

const router = Router();

// Get chart data for a stock
router.get('/stocks/:symbol/chart/:range', (req: Request, res: Response) => {
  try {
    const { symbol, range } = req.params;
    const data = stockDb.getChartData(symbol, range);
    res.json({
      symbol,
      range,
      count: data.length,
      data,
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch chart data' });
  }
});

// Get latest prices for all stocks
router.get('/stocks/latest', (req: Request, res: Response) => {
  try {
    const prices = stockDb.getLatestPrices();
    res.json(prices);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch latest prices' });
  }
});

// Get stock statistics
router.get('/stocks/:symbol/stats', (req: Request, res: Response) => {
  try {
    const stats = stockDb.getStockStats(req.params.symbol);
    res.json(stats);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch stock stats' });
  }
});

// Update real-time price (this could be called by your worker)
router.post('/stocks/:symbol/realtime', (req: Request, res: Response) => {
  try {
    const { symbol } = req.params;
    const { price, change, changePercent, volume } = req.body;
    stockDb.updateRealtimePrice(symbol, price, change, changePercent, volume);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: 'Failed to update realtime price' });
  }
});

// NEW: Manually trigger a fetch for testing
router.post('/stocks/fetch/:symbol', async (req: Request, res: Response) => {
  try {
    const { symbol } = req.params;
    console.log(`Manual fetch triggered for ${symbol}`);

    // Fetch from Yahoo
    const quote = await yahooService.fetchCurrentPrice(symbol);

    if (quote) {
      // Save to database
      yahooService.saveQuotesToDatabase(new Map([[symbol, quote]]));

      res.json({
        success: true,
        data: quote,
        message: `Successfully fetched and saved ${symbol}`,
      });
    } else {
      res.status(404).json({
        success: false,
        error: `Could not fetch data for ${symbol}`,
      });
    }
  } catch (error) {
    console.error('Error in manual fetch:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch stock data',
    });
  }
});

// NEW: Fetch all stocks in a category
router.post(
  '/stocks/fetch-category/:categoryId',
  async (req: Request, res: Response) => {
    try {
      const { categoryId } = req.params;

      // Get stocks for this category from your config
      const categories = stockDb.getAllCategories(); // <-- FIXED: Changed from getCategories to getAllCategories
      const category = categories.find((c: any) => c.id === categoryId);

      if (!category) {
        return res.status(404).json({ error: 'Category not found' });
      }

      // Extract symbols from category stocks
      const symbols = category.stocks.map((s: any) => s.symbol);
      console.log(
        `Fetching ${symbols.length} stocks for category ${category.name}`
      );

      // Fetch all prices
      const quotes = await yahooService.fetchMultiplePrices(symbols);

      // Save to database
      yahooService.saveQuotesToDatabase(quotes);

      res.json({
        success: true,
        category: category.name,
        fetched: quotes.size,
        total: symbols.length,
        stocks: Array.from(quotes.values()),
      });
    } catch (error) {
      console.error('Error fetching category:', error);
      res.status(500).json({ error: 'Failed to fetch category stocks' });
    }
  }
);

export default router;
