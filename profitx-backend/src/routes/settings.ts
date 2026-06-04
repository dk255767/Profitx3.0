import { Router } from 'express';
import { z } from 'zod';
import { readData, writeData } from '../db/store';

const settingsSchema = z.object({
  shopName: z.string().trim().min(1),
  ownerName: z.string().trim().min(1).optional(),
});

export const settingsRouter = Router();

settingsRouter.get('/settings/shop', async (_req, res) => {
  try {
    const data = await readData();
    res.json(data.settings);
  } catch (error) {
    console.error('Error reading settings:', error);
    res.status(500).json({
      message: 'Failed to read settings',
      detail: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

settingsRouter.put('/settings/shop', async (req, res) => {
  const parsed = settingsSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ message: 'Invalid payload', issues: parsed.error.flatten() });
  }

  try {
    const data = await readData();
    data.settings.shopName = parsed.data.shopName;
    if (parsed.data.ownerName) {
      data.settings.ownerName = parsed.data.ownerName;
    }
    await writeData(data);

    return res.json(data.settings);
  } catch (error) {
    console.error('Error updating settings:', error);
    return res.status(500).json({
      message: 'Failed to update settings',
      detail: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});
