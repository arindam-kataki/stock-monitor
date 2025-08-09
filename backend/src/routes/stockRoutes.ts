// backend/src/routes/stockRoutes.ts
import { Router, Request, Response } from 'express';
import stockDb from '../services/sqliteService';

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

// Update real-time price
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

export default router;
