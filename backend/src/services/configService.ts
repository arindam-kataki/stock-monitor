// backend/src/services/configService.ts
import Database from 'better-sqlite3';

export class ConfigurationService {
  private db: Database.Database;

  constructor(db: Database.Database) {
    this.db = db;
  }

  // Get all categories with their stocks
  getAllCategories() {
    const categories = this.db
      .prepare(
        `
      SELECT * FROM categories 
      WHERE is_active = 1 
      ORDER BY order_index
    `
      )
      .all();

    // For each category, get its stocks
    const getCategoryStocks = this.db.prepare(`
      SELECT * FROM stock_metadata 
      WHERE category_id = ? AND is_active = 1
    `);

    return categories.map((category) => ({
      ...(category as any),
      stocks: getCategoryStocks.all((category as any).id),
    }));
  }

  updateCategoryName(categoryId: string, newName: string) {
    return this.db
      .prepare(
        `
        UPDATE categories 
        SET name = ?, updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `
      )
      .run(newName, categoryId);
  }

  // Get user's selected stocks
  getUserSelections(userId = 'default') {
    return this.db
      .prepare(
        `
      SELECT 
        us.category_id,
        us.symbol,
        sm.name as stock_name,
        c.name as category_name
      FROM user_selections us
      JOIN stock_metadata sm ON us.symbol = sm.symbol
      JOIN categories c ON us.category_id = c.id
      WHERE us.user_id = ? AND us.selected = 1
    `
      )
      .all(userId);
  }

  // Toggle stock selection
  toggleStockSelection(userId: string, categoryId: string, symbol: string) {
    const existing = this.db
      .prepare(
        `
      SELECT selected FROM user_selections 
      WHERE user_id = ? AND category_id = ? AND symbol = ?
    `
      )
      .get(userId, categoryId, symbol);

    if (existing) {
      // Toggle existing selection
      return this.db
        .prepare(
          `
        UPDATE user_selections 
        SET selected = ?, selected_at = CURRENT_TIMESTAMP
        WHERE user_id = ? AND category_id = ? AND symbol = ?
      `
        )
        .run(!(existing as any)?.selected, userId, categoryId, symbol);
    } else {
      // Create new selection
      return this.db
        .prepare(
          `
        INSERT INTO user_selections (user_id, category_id, symbol, selected)
        VALUES (?, ?, ?, 1)
      `
        )
        .run(userId, categoryId, symbol);
    }
  }

  // Get settings
  getSettings(userId = 'default') {
    const rows = this.db
      .prepare(
        `
      SELECT key, value FROM settings WHERE user_id = ?
    `
      )
      .all(userId);

    // Convert to object
    return rows.reduce((acc, row) => {
      (acc as any)[(row as any).key] = JSON.parse((row as any).value);
      return acc;
    }, {} as any);
  }

  // Update setting
  updateSetting(userId: string, key: string, value: any) {
    return this.db
      .prepare(
        `
      INSERT OR REPLACE INTO settings (key, value, user_id, updated_at)
      VALUES (?, ?, ?, CURRENT_TIMESTAMP)
    `
      )
      .run(key, JSON.stringify(value), userId);
  }

  // Bulk update settings
  updateSettings(userId: string, settings: Record<string, any>) {
    const stmt = this.db.prepare(`
      INSERT OR REPLACE INTO settings (key, value, user_id, updated_at)
      VALUES (?, ?, ?, CURRENT_TIMESTAMP)
    `);

    const transaction = this.db.transaction(() => {
      for (const [key, value] of Object.entries(settings)) {
        stmt.run(key, JSON.stringify(value), userId);
      }
    });

    return transaction();
  }
}
