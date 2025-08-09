// backend/src/server.ts
import express, { Request, Response } from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import stockRoutes from './routes/stockRoutes';
import configRoutes from './routes/configRoutes';
import stockDb from './services/sqliteService';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());

// Routes
app.use('/api', stockRoutes);
app.use('/api/config', configRoutes);

// Health check
app.get('/api/health', (req: Request, res: Response) => {
  const stats = stockDb.getDatabaseStats();
  res.json({ 
    status: 'OK', 
    message: 'Server is running with SQLite',
    database: {
      totalStocks: stats.totalStocks.count,
      size: stats.databaseSize
    }
  });
});

// Start server
app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
  console.log('Database: SQLite (stocks.db)');
});

// Graceful shutdown
process.on('SIGINT', () => {
  console.log('\nShutting down gracefully...');
  stockDb.close();
  process.exit(0);
});