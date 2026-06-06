import { Request, Response } from 'express';

export function notFound(_req: Request, res: Response): void {
  try {
    // eslint-disable-next-line no-console
    console.warn(`notFound -> ${_req.method} ${_req.originalUrl}`);
  } catch (e) {
    // ignore
  }
  res.status(404).json({ message: 'Route not found' });
}
