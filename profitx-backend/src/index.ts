import 'dotenv/config';
import cors from 'cors';
import express from 'express';
import { config } from './config';
import { readData } from './db/store';
import { requireAuth } from './middleware/auth';
import { errorHandler } from './middleware/error-handler';
import { notFound } from './middleware/not-found';
import { authRouter } from './routes/auth';
import { dataRouter } from './routes/data';
import { financeRouter } from './routes/finance';
import { healthRouter } from './routes/health';
import { savingRouter } from './routes/saving';
import { settingsRouter } from './routes/settings';

const app = express();

app.use(cors({ origin: config.corsOrigin }));
app.use(express.json());

app.get('/', (_req, res) => {
  res.json({
    service: 'profitx-backend',
    message: 'Backend is running',
    docs: '/api/health',
  });
});

app.use('/api', healthRouter);
app.use('/api', authRouter);
app.use('/api', requireAuth, settingsRouter);
app.use('/api', requireAuth, dataRouter);
app.use('/api', requireAuth, financeRouter);
app.use('/api', requireAuth, savingRouter);

app.use(notFound);
app.use(errorHandler);

async function startServer(): Promise<void> {
  const maxRetries = Number(process.env.STARTUP_RETRIES ?? 5);
  const baseDelayMs = Number(process.env.STARTUP_RETRY_DELAY_MS ?? 2000);

  let attempt = 0;
  while (true) {
    try {
      attempt += 1;
      // eslint-disable-next-line no-console
      console.log(`Starting initialization (attempt ${attempt}/${maxRetries})`);
      await readData();
      break;
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error(`Initialization attempt ${attempt} failed:`, err);
      if (attempt >= maxRetries) {
        // eslint-disable-next-line no-console
        console.error('Max initialization attempts reached, exiting.');
        throw err;
      }
      const waitMs = baseDelayMs * attempt;
      // eslint-disable-next-line no-console
      console.log(`Retrying initialization in ${waitMs}ms...`);
      await new Promise((r) => setTimeout(r, waitMs));
    }
  }

  const PORT = Number(process.env.PORT ?? config.port ?? 5000);

  app.listen(PORT, '0.0.0.0', () => {
    // eslint-disable-next-line no-console
    console.log(`ProfitX backend listening on port ${PORT}`);
  });
}

startServer().catch((error) => {
  // eslint-disable-next-line no-console
  console.error('Failed to start backend after retries:', error?.stack ?? error);
  process.exit(1);
});
