import express, { Request, Response } from 'express';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import { apiRouter } from './server/routes/api.js';
import { MarketScheduler } from './server/engines/scheduler.js';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = Number(process.env.PORT) || 3000;
const isProd = process.env.NODE_ENV === 'production';

app.use(cors());
app.use(express.json());

// Mount API routes
app.use('/api', apiRouter);

// Start background market scheduler
const scheduler = MarketScheduler.getInstance();
scheduler.start(25); // every 25 seconds

async function startServer() {
  if (!isProd) {
    // Development mode: Mount Vite dev server middlewares
    const { createServer } = await import('vite');
    const vite = await createServer({
      server: {
        middlewareMode: true,
        hmr: process.env.DISABLE_HMR !== 'true',
        watch: process.env.DISABLE_HMR === 'true' ? null : {},
      },
      appType: 'spa',
    });

    app.use(vite.middlewares);
  } else {
    // Production mode: Serve built static files
    const distPath = path.resolve(__dirname, 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req: Request, res: Response) => {
      res.sendFile(path.resolve(distPath, 'index.html'));
    });
  }

  const server = app.listen(PORT, '0.0.0.0', () => {
    console.log(`=======================================================`);
    console.log(`🚀 SOLANA SENTINEL SERVER RUNNING AT: http://localhost:${PORT}`);
    console.log(`📡 Environment: ${isProd ? 'Production' : 'Development'}`);
    console.log(`🛡️ Paper Trading & Market Intelligence: ACTIVE`);
    console.log(`=======================================================`);
  });

  const shutdown = () => {
    console.log('\n[Solana Sentinel] Shutting down gracefully...');
    scheduler.stop();
    server.close(() => {
      console.log('[Solana Sentinel] Server terminated cleanly.');
      process.exit(0);
    });
  };

  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
}

startServer().catch((err) => {
  console.error('[Solana Sentinel] Failed to launch server:', err);
  process.exit(1);
});
