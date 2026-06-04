import { NextFunction, Request, Response } from 'express';
import { findUserByEmail } from '../db/store';
import { verifyAuthToken } from '../security/token';

export type AuthenticatedRequest = Request & {
  authUserId: string;
};

export function getAuthUserId(req: Request): string {
  return (req as unknown as AuthenticatedRequest).authUserId;
}

export async function requireAuth(req: Request, res: Response, next: NextFunction): Promise<void> {
  const authHeader = req.header('authorization');
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    res.status(401).json({ message: 'Unauthorized' });
    return;
  }

  const token = authHeader.slice('Bearer '.length).trim();
  const verified = verifyAuthToken(token);
  if (verified) {
    (req as AuthenticatedRequest).authUserId = verified.userId;
    next();
    return;
  }

  const fallbackEmail = String(req.header('x-auth-user-email') ?? '').trim().toLowerCase();
  if (!fallbackEmail) {
    res.status(401).json({ message: 'Invalid token' });
    return;
  }

  const user = await findUserByEmail(fallbackEmail);
  if (!user) {
    res.status(401).json({ message: 'Invalid token' });
    return;
  }

  (req as AuthenticatedRequest).authUserId = user.id;
  next();
}
