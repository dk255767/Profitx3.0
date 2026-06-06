import { Router } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { z } from 'zod';
import {
  createProduct,
  listProductsByUser,
  patchProductByUser,
  addProductPurchaseByUser,
  deleteProductByUser,
} from '../db/store';
import { getAuthUserId } from '../middleware/auth';
import { ProductItem, PurchaseRecord } from '../types';

const productSchema = z.object({
  name: z.string().trim().min(1),
  createdOn: z.string().trim().min(1),
  totalValue: z.number().nonnegative(),
});

const patchProductSchema = z.object({
  name: z.string().trim().min(1).optional(),
  createdOn: z.string().trim().min(1).optional(),
  totalValue: z.number().nonnegative().optional(),
});

const purchaseSchema = z.object({
  name: z.string().trim().min(1),
  amount: z.number().positive(),
  paidOn: z.string().optional(),
});

export const productRouter = Router();

// Log incoming requests to help debug routing from clients (dev only)
productRouter.use((req, _res, next) => {
  try {
    // eslint-disable-next-line no-console
    console.log(`productRouter -> ${req.method} ${req.path} headers:`, Object.keys(req.headers));
  } catch (e) {
    // ignore
  }
  next();
});

productRouter.get('/products', async (req, res) => {
  try {
    const userId = getAuthUserId(req);
    const products = await listProductsByUser(userId);
    res.json(products);
  } catch (error) {
    console.error('Error reading products:', error);
    res.status(500).json({ message: 'Failed to read products', detail: error instanceof Error ? error.message : 'Unknown error' });
  }
});

productRouter.post('/products', async (req, res) => {
  const parsed = productSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ message: 'Invalid payload', issues: parsed.error.flatten() });
  }

  try {
    const userId = getAuthUserId(req);
    const product: ProductItem = {
      id: uuidv4(),
      name: parsed.data.name,
      createdOn: parsed.data.createdOn,
      totalValue: parsed.data.totalValue,
      purchases: [],
    };

    await createProduct({ userId, id: product.id, name: product.name, createdOn: product.createdOn, totalValue: product.totalValue });
    return res.status(201).json(product);
  } catch (error) {
    console.error('Error creating product:', error);
    return res.status(500).json({ message: 'Failed to create product', detail: error instanceof Error ? error.message : 'Unknown error' });
  }
});

productRouter.patch('/products/:id', async (req, res) => {
  const parsed = patchProductSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ message: 'Invalid payload', issues: parsed.error.flatten() });
  }

  try {
    const userId = getAuthUserId(req);
    const product = await patchProductByUser(userId, req.params.id, {
      name: parsed.data.name,
      createdOn: parsed.data.createdOn,
      totalValue: parsed.data.totalValue,
    });
    if (!product) return res.status(404).json({ message: 'Product not found' });
    return res.json(product);
  } catch (error) {
    console.error('Error updating product:', error);
    return res.status(500).json({ message: 'Failed to update product', detail: error instanceof Error ? error.message : 'Unknown error' });
  }
});

productRouter.delete('/products/:id', async (req, res) => {
  try {
    const userId = getAuthUserId(req);
    const ok = await deleteProductByUser(userId, req.params.id);
    if (!ok) return res.status(404).json({ message: 'Product not found' });
    return res.status(204).end();
  } catch (error) {
    console.error('Error deleting product:', error);
    return res.status(500).json({ message: 'Failed to delete product', detail: error instanceof Error ? error.message : 'Unknown error' });
  }
});

productRouter.post('/products/:id/purchases', async (req, res) => {
  const parsed = purchaseSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ message: 'Invalid payload', issues: parsed.error.flatten() });
  }

  try {
    const userId = getAuthUserId(req);
    const purchase: PurchaseRecord = {
      name: parsed.data.name,
      amount: parsed.data.amount,
      paidOn: parsed.data.paidOn ?? new Date().toISOString().slice(0, 10),
      timestamp: Date.now(),
    };

    const created = await addProductPurchaseByUser(userId, req.params.id, purchase as any);
    if (!created) return res.status(404).json({ message: 'Product not found' });
    return res.status(201).json(created);
  } catch (error) {
    console.error('Error adding purchase:', error);
    return res.status(500).json({ message: 'Failed to add purchase', detail: error instanceof Error ? error.message : 'Unknown error' });
  }
});
