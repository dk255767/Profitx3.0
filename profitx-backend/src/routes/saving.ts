import { Router } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { z } from 'zod';
import {
  addSavingDepositByUser,
  createSavingCard,
  listSavingCardsByUser,
  patchSavingCardByUser,
} from '../db/store';
import { getAuthUserId } from '../middleware/auth';
import { SavingCard, PaymentRecord } from '../types';

const depositSchema = z.object({
  amount: z.number().positive(),
  month: z.string().min(3),
  year: z.string().min(4),
  paidOn: z.string().optional(),
});

const savingCardSchema = z.object({
  name: z.string().trim().min(1),
  startedOn: z.string().trim().min(1),
  initialAmount: z.number().nonnegative(),
});

const patchSavingCardSchema = z.object({
  name: z.string().trim().min(1).optional(),
  startedOn: z.string().trim().min(1).optional(),
  initialAmount: z.number().nonnegative().optional(),
});

export const savingRouter = Router();

savingRouter.get('/saving/cards', async (req, res) => {
  try {
    const userId = getAuthUserId(req);
    const cards = await listSavingCardsByUser(userId);
    res.json(cards);
  } catch (error) {
    console.error('Error reading saving cards:', error);
    res.status(500).json({
      message: 'Failed to read saving cards',
      detail: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

savingRouter.get('/saving/summary', async (req, res) => {
  try {
    const userId = getAuthUserId(req);
    const cards = await listSavingCardsByUser(userId);
    const initial = cards.reduce((sum: number, c: SavingCard) => sum + c.initialAmount, 0);
    const deposits = cards.reduce(
      (sum: number, c: SavingCard) => sum + c.deposits.reduce((acc: number, payment: PaymentRecord) => acc + payment.amount, 0),
      0,
    );

    res.json({
      initial,
      deposits,
      totalSaved: initial + deposits,
      cardCount: cards.length,
    });
  } catch (error) {
    console.error('Error reading saving summary:', error);
    res.status(500).json({
      message: 'Failed to read saving summary',
      detail: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

savingRouter.post('/saving/cards', async (req, res) => {
  const parsed = savingCardSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ message: 'Invalid payload', issues: parsed.error.flatten() });
  }

  try {
    const userId = getAuthUserId(req);
    const card: SavingCard = {
      id: uuidv4(),
      name: parsed.data.name,
      startedOn: parsed.data.startedOn,
      initialAmount: parsed.data.initialAmount,
      deposits: [],
    };

    await createSavingCard({
      userId,
      id: card.id,
      name: card.name,
      startedOn: card.startedOn,
      initialAmount: card.initialAmount,
    });

    return res.status(201).json(card);
  } catch (error) {
    console.error('Error creating saving card:', error);
    return res.status(500).json({ 
      message: 'Failed to create saving card',
      detail: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

savingRouter.patch('/saving/cards/:id', async (req, res) => {
  const parsed = patchSavingCardSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ message: 'Invalid payload', issues: parsed.error.flatten() });
  }

  try {
    const userId = getAuthUserId(req);
    const card = await patchSavingCardByUser(userId, req.params.id, {
      name: parsed.data.name,
      startedOn: parsed.data.startedOn,
      initialAmount: parsed.data.initialAmount,
    });
    if (!card) {
      return res.status(404).json({ message: 'Saving card not found' });
    }

    return res.json(card);
  } catch (error) {
    console.error('Error updating saving card:', error);
    return res.status(500).json({
      message: 'Failed to update saving card',
      detail: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

savingRouter.post('/saving/cards/:id/deposits', async (req, res) => {
  const parsed = depositSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ message: 'Invalid payload', issues: parsed.error.flatten() });
  }

  try {
    const userId = getAuthUserId(req);

    const deposit = {
      amount: parsed.data.amount,
      month: parsed.data.month,
      year: parsed.data.year,
      paidOn: parsed.data.paidOn ?? new Date().toISOString().slice(0, 10),
      timestamp: Date.now(),
    };

    const created = await addSavingDepositByUser(userId, req.params.id, deposit);
    if (!created) {
      return res.status(404).json({ message: 'Saving card not found' });
    }

    return res.status(201).json(created);
  } catch (error) {
    console.error('Error adding deposit to saving card:', error);
    return res.status(500).json({
      message: 'Failed to save deposit',
      detail: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});
