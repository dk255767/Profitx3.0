import { Router } from 'express';
import { z } from 'zod';
import { getFinanceSnapshotByUser, saveFinanceSnapshotByUser } from '../db/store';
import { getAuthUserId } from '../middleware/auth';

const incomeRowSchema = z.object({
  id: z.string(),
  date: z.string(),
  cash: z.string(),
  gpay: z.string(),
  malliKadai: z.string(),
  market: z.string(),
});

const additionalRowSchema = z.object({
  id: z.string(),
  date: z.string(),
  egg: z.string(),
  piece: z.string(),
  potato: z.string(),
  gas: z.string(),
  fuel: z.string(),
});

const snapshotSchema = z.object({
  incomeRows: z.array(incomeRowSchema),
  addRows: z.array(additionalRowSchema),
});

export const dataRouter = Router();

dataRouter.get('/data/snapshot', async (req, res) => {
  try {
    const userId = getAuthUserId(req);
    const snapshot = await getFinanceSnapshotByUser(userId);
    return res.json(snapshot);
  } catch (error) {
    console.error('Error reading finance snapshot:', error);
    return res.status(500).json({
      message: 'Failed to read data snapshot',
      detail: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

dataRouter.put('/data/snapshot', async (req, res) => {
  const parsed = snapshotSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ message: 'Invalid payload', issues: parsed.error.flatten() });
  }

  try {
    const userId = getAuthUserId(req);
    await saveFinanceSnapshotByUser(userId, parsed.data);
    return res.json(parsed.data);
  } catch (error) {
    console.error('Error saving finance snapshot:', error);
    return res.status(500).json({
      message: 'Failed to save data snapshot',
      detail: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});
