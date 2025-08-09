// backend/src/routes/configRoutes.ts
import { Router } from 'express';
import { ConfigurationService } from '../services/configService';
import { StockDatabase } from '../services/sqliteService';

const router = Router();
const db = new StockDatabase();
const configService = new ConfigurationService(db.getDatabase());

// Get all categories with stocks
router.get('/categories', (req, res) => {
  try {
    const categories = configService.getAllCategories();
    res.json(categories);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch categories' });
  }
});

// Get user selections
router.get('/selections/:userId?', (req, res) => {
  const userId = req.params.userId || 'default';
  try {
    const selections = configService.getUserSelections(userId);
    res.json(selections);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch selections' });
  }
});

// Toggle stock selection
router.post('/selections/toggle', (req, res) => {
  const { userId = 'default', categoryId, symbol } = req.body;
  try {
    configService.toggleStockSelection(userId, categoryId, symbol);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: 'Failed to toggle selection' });
  }
});

// Get settings
router.get('/settings/:userId?', (req, res) => {
  const userId = req.params.userId || 'default';
  try {
    const settings = configService.getSettings(userId);
    res.json(settings);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch settings' });
  }
});

// Update settings
router.put('/settings/:userId?', (req, res) => {
  const userId = req.params.userId || 'default';
  try {
    configService.updateSettings(userId, req.body);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: 'Failed to update settings' });
  }
});

export default router;
