import { v4 as uuidv4 } from 'uuid';
import { Router } from 'express';
import { z } from 'zod';
import { createUser, findUserByCredentials, findUserById, upsertUserProfile, findUserBySupabaseId } from '../db/store';
import { createAuthToken } from '../security/token';
import { requireAuth, getAuthUserId } from '../middleware/auth';

const loginSchema = z.union([
  z.object({ supabaseId: z.string().min(1) }),
  z.object({ email: z.string().email(), password: z.string().min(1) }),
]);

const registerSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  shopName: z.string().trim().optional(),
  ownerName: z.string().trim().optional(),
  supabaseId: z.string().optional(),
});

export const authRouter = Router();

authRouter.post('/auth/register', async (req, res) => {
  const parsed = registerSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ message: 'Invalid payload', issues: parsed.error.flatten() });
  }

  try {
    const normalizedEmail = parsed.data.email.trim().toLowerCase();

    // When using Supabase Auth, we do not store plaintext passwords locally.
    // Accept an optional `supabaseId` and persist it instead.
    const newUser = {
      id: uuidv4(),
      email: normalizedEmail,
      // when using Supabase, we keep password null; otherwise persist provided password (will be hashed server-side)
      password: parsed.data.supabaseId ? null : parsed.data.password,
      supabaseId: parsed.data.supabaseId ?? null,
      role: 'staff' as const,
      shopName: parsed.data.shopName ?? '',
      ownerName: parsed.data.ownerName ?? '',
    };

    const created = await createUser(newUser);
    if (!created) {
      return res.status(409).json({ message: 'Email already exists' });
    }

    const token = createAuthToken(newUser.id);

    return res.status(201).json({
      token,
      user: {
        id: newUser.id,
        email: newUser.email,
        role: newUser.role,
        shopName: newUser.shopName,
        ownerName: newUser.ownerName,
        supabaseId: newUser.supabaseId,
      },
    });
  } catch (error) {
    console.error('Error registering user:', error);
    return res.status(500).json({
      message: 'Failed to register user',
      detail: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

authRouter.post('/auth/login', async (req, res) => {
  console.log('Incoming /auth/login', { path: req.path, headers: req.headers, body: req.body });
  const parsed = loginSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ message: 'Invalid payload', issues: parsed.error.flatten() });

  try {
    let user;
    if ('supabaseId' in parsed.data) {
      // Login by Supabase ID (third-party auth)
      user = await findUserBySupabaseId(parsed.data.supabaseId);
    } else {
      user = await findUserByCredentials(parsed.data.email.trim().toLowerCase(), parsed.data.password);
    }

    if (!user) return res.status(401).json({ message: 'Invalid credentials' });

    const token = createAuthToken(user.id);

    return res.json({
      token,
      user: {
        id: user.id,
        email: user.email,
        role: user.role,
        shopName: user.shopName,
        ownerName: user.ownerName,
        supabaseId: (user as any).supabaseId ?? null,
      },
    });
  } catch (error) {
    console.error('Error logging in user:', error);
    return res.status(500).json({ message: 'Failed to login user', detail: error instanceof Error ? error.message : 'Unknown error' });
  }
});

authRouter.get('/auth/me', requireAuth, async (req, res) => {
  try {
    const userId = getAuthUserId(req as any);
    const user = await findUserById(userId);
    if (!user) return res.status(404).json({ message: 'User not found' });

    return res.json({
      id: user.id,
      email: user.email,
      role: user.role,
      shopName: user.shopName,
      ownerName: user.ownerName,
    });
  } catch (error) {
    console.error('Error fetching profile:', error);
    return res.status(500).json({ message: 'Failed to fetch profile', detail: error instanceof Error ? error.message : 'Unknown error' });
  }
});

// Create or update profile (shopName/ownerName) by email.
// Public for now — the client calls this after user fills profile details.
const profileSchema = z.object({
  email: z.string().email(),
  shopName: z.string().trim().optional(),
  ownerName: z.string().trim().optional(),
  supabaseId: z.string().optional(),
});

authRouter.post('/auth/profile', async (req, res) => {
  const parsed = profileSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ message: 'Invalid payload', issues: parsed.error.flatten() });

  try {
    const email = parsed.data.email.trim().toLowerCase();
    const id = await upsertUserProfile(email, parsed.data.shopName, parsed.data.ownerName, parsed.data.supabaseId ?? null);
    return res.json({ id, email, shopName: parsed.data.shopName ?? null, ownerName: parsed.data.ownerName ?? null, supabaseId: parsed.data.supabaseId ?? null });
  } catch (error) {
    console.error('Error upserting profile:', error);
    return res.status(500).json({ message: 'Failed to save profile', detail: error instanceof Error ? error.message : 'Unknown error' });
  }
});
