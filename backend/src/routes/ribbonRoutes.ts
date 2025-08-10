// backend/src/routes/ribbonRoutes.ts

import { Router, Request, Response } from 'express';
import stockDb from '../services/sqliteService';

const router = Router();

// Get user's ribbons
router.get('/:userId?', (req: Request, res: Response) => {
  try {
    const userId = req.params.userId || 'default';
    const ribbons = stockDb.getUserRibbons(userId);
    res.json(ribbons);
  } catch (error) {
    console.error('Error fetching ribbons:', error);
    res.status(500).json({ error: 'Failed to fetch ribbons' });
  }
});

// Get all ribbons (default user)
router.get('/', (req: Request, res: Response) => {
  try {
    const ribbons = stockDb.getUserRibbons('default');
    res.json(ribbons);
  } catch (error) {
    console.error('Error fetching ribbons:', error);
    res.status(500).json({ error: 'Failed to fetch ribbons' });
  }
});

// Create new ribbon
router.post('/', (req: Request, res: Response) => {
  try {
    const {
      userId = 'default',
      name,
      categoryId,
      selectedStocks,
      icon,
      color,
    } = req.body;

    // Create ribbon
    const ribbonId = stockDb.createRibbon({
      userId,
      name,
      categoryId,
      icon: icon || '📊',
      color: color || '#667eea',
      orderIndex: 999, // Will be updated based on existing ribbons
      isActive: true,
    });

    // Add selected stocks
    if (selectedStocks && selectedStocks.length > 0) {
      selectedStocks.forEach((symbol: string) => {
        stockDb.addStockToRibbon(ribbonId, symbol);
      });
    }

    // Return the created ribbon
    const ribbon = stockDb.getRibbon(ribbonId);
    res.status(201).json(ribbon);
  } catch (error) {
    console.error('Error creating ribbon:', error);
    res.status(500).json({ error: 'Failed to create ribbon' });
  }
});

// Update ribbon
router.put('/:id', (req: Request, res: Response) => {
  try {
    const ribbonId = parseInt(req.params.id);
    const { name, selectedStocks, isActive } = req.body;

    if (name !== undefined) {
      stockDb.updateRibbonName(ribbonId, name);
    }

    if (isActive !== undefined) {
      stockDb.updateRibbonActive(ribbonId, isActive);
    }

    if (selectedStocks !== undefined) {
      stockDb.updateRibbonStocks(ribbonId, selectedStocks);
    }

    const ribbon = stockDb.getRibbon(ribbonId);
    res.json(ribbon);
  } catch (error) {
    console.error('Error updating ribbon:', error);
    res.status(500).json({ error: 'Failed to update ribbon' });
  }
});

// Update ribbon name only
router.patch('/:id/name', (req: Request, res: Response) => {
  try {
    const ribbonId = parseInt(req.params.id);
    const { name } = req.body;

    if (!name || !name.trim()) {
      return res.status(400).json({ error: 'Name is required' });
    }

    stockDb.updateRibbonName(ribbonId, name.trim());
    res.json({ success: true });
  } catch (error) {
    console.error('Error updating ribbon name:', error);
    res.status(500).json({ error: 'Failed to update ribbon name' });
  }
});

// Delete ribbon
router.delete('/:id', (req: Request, res: Response) => {
  try {
    const ribbonId = parseInt(req.params.id);
    stockDb.deleteRibbon(ribbonId);
    res.json({ success: true });
  } catch (error) {
    console.error('Error deleting ribbon:', error);
    res.status(500).json({ error: 'Failed to delete ribbon' });
  }
});

// Update ribbon order
router.put('/order/batch', (req: Request, res: Response) => {
  try {
    const updates = req.body;

    if (!Array.isArray(updates)) {
      return res.status(400).json({ error: 'Invalid data format' });
    }

    updates.forEach((update: any) => {
      stockDb.updateRibbonOrder(update.id, update.orderIndex);
    });

    res.json({ success: true });
  } catch (error) {
    console.error('Error updating ribbon order:', error);
    res.status(500).json({ error: 'Failed to update ribbon order' });
  }
});

export default router;
