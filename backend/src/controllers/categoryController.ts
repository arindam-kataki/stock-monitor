import { Request, Response } from 'express';
import Category from '../models/Category';

export const categoryController = {
  // Get all categories
  async getAllCategories(req: Request, res: Response) {
    try {
      const categories = await Category.find({ isActive: true }).sort('order');
      res.json(categories);
    } catch (error) {
      res.status(500).json({ error: 'Failed to fetch categories' });
    }
  },

  // Get single category
  async getCategory(req: Request, res: Response) {
    try {
      const category = await Category.findOne({ id: req.params.id });
      if (!category) {
        return res.status(404).json({ error: 'Category not found' });
      }
      res.json(category);
    } catch (error) {
      res.status(500).json({ error: 'Failed to fetch category' });
    }
  },

  // Create new category
  async createCategory(req: Request, res: Response) {
    try {
      const category = new Category(req.body);
      await category.save();
      res.status(201).json(category);
    } catch (error) {
      res.status(400).json({ error: 'Failed to create category' });
    }
  },

  // Update category
  async updateCategory(req: Request, res: Response) {
    try {
      const category = await Category.findOneAndUpdate(
        { id: req.params.id },
        req.body,
        { new: true }
      );
      if (!category) {
        return res.status(404).json({ error: 'Category not found' });
      }
      res.json(category);
    } catch (error) {
      res.status(400).json({ error: 'Failed to update category' });
    }
  },

  // Add stock to category
  async addStock(req: Request, res: Response) {
    try {
      const category = await Category.findOne({ id: req.params.id });
      if (!category) {
        return res.status(404).json({ error: 'Category not found' });
      }

      category.stocks.push(req.body);
      await category.save();
      res.json(category);
    } catch (error) {
      res.status(400).json({ error: 'Failed to add stock' });
    }
  },

  // Remove stock from category
  async removeStock(req: Request, res: Response) {
    try {
      const category = await Category.findOne({ id: req.params.id });
      if (!category) {
        return res.status(404).json({ error: 'Category not found' });
      }

      category.stocks = category.stocks.filter(
        (stock) => stock.symbol !== req.params.symbol
      );
      await category.save();
      res.json(category);
    } catch (error) {
      res.status(400).json({ error: 'Failed to remove stock' });
    }
  },
};
