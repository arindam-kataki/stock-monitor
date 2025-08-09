// backend/src/routes/configRoutes.ts
import { Router, Request, Response } from 'express';
import stockDb from '../services/sqliteService';

const router = Router();

// Get all categories with stocks
router.get('/categories', (req: Request, res: Response) => {
  try {
    const categories = stockDb.getAllCategories();
    res.json(categories);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch categories' });
  }
});

// Get user selections
router.get('/selections/:userId?', (req: Request, res: Response) => {
  try {
    const userId = req.params.userId || 'default';
    const selections = stockDb.getUserSelections(userId);
    res.json(selections);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch selections' });
  }
});

// Toggle stock selection
router.post('/selections/toggle', (req: Request, res: Response) => {
  try {
    const { userId = 'default', categoryId, symbol } = req.body;
    stockDb.toggleStockSelection(userId, categoryId, symbol);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: 'Failed to toggle selection' });
  }
});

// Get settings
router.get('/settings/:userId?', (req: Request, res: Response) => {
  try {
    const userId = req.params.userId || 'default';
    const settings = stockDb.getSettings(userId);
    res.json(settings);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch settings' });
  }
});

// Update settings
router.put('/settings/:userId?', (req: Request, res: Response) => {
  try {
    const userId = req.params.userId || 'default';
    Object.entries(req.body).forEach(([key, value]) => {
      stockDb.updateSetting(userId, key, value);
    });
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: 'Failed to update settings' });
  }
});

// Database stats (admin)
router.get('/admin/stats', (req: Request, res: Response) => {
  try {
    const stats = stockDb.getDatabaseStats();
    res.json(stats);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch database stats' });
  }
});

export default router;
