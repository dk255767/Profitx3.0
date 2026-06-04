import { Router } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { z } from 'zod';
import {
  addFinancePaymentByUser,
  createFinanceVendor,
  listFinanceVendorsByUser,
  patchFinanceVendorByUser,
} from '../db/store';
import { getAuthUserId } from '../middleware/auth';
import { FinanceVendor, PaymentRecord } from '../types';

const paymentSchema = z.object({
  amount: z.number().positive(),
  month: z.string().min(3),
  year: z.string().min(4),
  paidOn: z.string().optional(),
});

const vendorSchema = z.object({
  name: z.string().trim().min(1),
  loanDate: z.string().trim().min(1),
  loanAmount: z.number().nonnegative(),
});

const patchVendorSchema = z.object({
  name: z.string().trim().min(1).optional(),
  loanDate: z.string().trim().min(1).optional(),
  loanAmount: z.number().nonnegative().optional(),
});

export const financeRouter = Router();

financeRouter.get('/finance/vendors', async (req, res) => {
  try {
    const userId = getAuthUserId(req);
    const vendors = await listFinanceVendorsByUser(userId);
    res.json(vendors);
  } catch (error) {
    console.error('Error reading finance vendors:', error);
    res.status(500).json({
      message: 'Failed to read finance vendors',
      detail: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

financeRouter.get('/finance/summary', async (req, res) => {
  try {
    const userId = getAuthUserId(req);
    const vendors = await listFinanceVendorsByUser(userId);
    const totalLoan = vendors.reduce((sum: number, v: FinanceVendor) => sum + v.loanAmount, 0);
    const totalPaid = vendors.reduce(
      (sum: number, v: FinanceVendor) => sum + v.payments.reduce((acc: number, payment: PaymentRecord) => acc + payment.amount, 0),
      0,
    );

    res.json({
      totalLoan,
      totalPaid,
      remaining: Math.max(totalLoan - totalPaid, 0),
      vendorCount: vendors.length,
    });
  } catch (error) {
    console.error('Error reading finance summary:', error);
    res.status(500).json({
      message: 'Failed to read finance summary',
      detail: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

financeRouter.post('/finance/vendors', async (req, res) => {
  const parsed = vendorSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ message: 'Invalid payload', issues: parsed.error.flatten() });
  }

  try {
    const userId = getAuthUserId(req);
    const vendor: FinanceVendor = {
      id: uuidv4(),
      name: parsed.data.name,
      loanDate: parsed.data.loanDate,
      loanAmount: parsed.data.loanAmount,
      payments: [],
    };

    await createFinanceVendor({
      userId,
      id: vendor.id,
      name: vendor.name,
      loanDate: vendor.loanDate,
      loanAmount: vendor.loanAmount,
    });

    return res.status(201).json(vendor);
  } catch (error) {
    console.error('Error creating vendor:', error);
    return res.status(500).json({
      message: 'Failed to create vendor',
      detail: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

financeRouter.patch('/finance/vendors/:id', async (req, res) => {
  const parsed = patchVendorSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ message: 'Invalid payload', issues: parsed.error.flatten() });
  }

  try {
    const userId = getAuthUserId(req);
    const vendor = await patchFinanceVendorByUser(userId, req.params.id, {
      name: parsed.data.name,
      loanDate: parsed.data.loanDate,
      loanAmount: parsed.data.loanAmount,
    });
    if (!vendor) {
      return res.status(404).json({ message: 'Vendor not found' });
    }

    return res.json(vendor);
  } catch (error) {
    console.error('Error updating vendor:', error);
    return res.status(500).json({
      message: 'Failed to update vendor',
      detail: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

financeRouter.post('/finance/vendors/:id/payments', async (req, res) => {
  const parsed = paymentSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ message: 'Invalid payload', issues: parsed.error.flatten() });
  }

  try {
    const userId = getAuthUserId(req);

    const payment = {
      amount: parsed.data.amount,
      month: parsed.data.month,
      year: parsed.data.year,
      paidOn: parsed.data.paidOn ?? new Date().toISOString().slice(0, 10),
      timestamp: Date.now(),
    };

    const created = await addFinancePaymentByUser(userId, req.params.id, payment);
    if (!created) {
      return res.status(404).json({ message: 'Vendor not found' });
    }

    return res.status(201).json(created);
  } catch (error) {
    console.error('Error adding payment:', error);
    return res.status(500).json({
      message: 'Failed to save payment',
      detail: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});
