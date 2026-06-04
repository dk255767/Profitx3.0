import { NextFunction, Request, Response } from 'express';

export function errorHandler(error: unknown, _req: Request, res: Response, _next: NextFunction): void {
  if (error instanceof Error) {
    res.status(500).json({
      message: 'Internal server error',
      detail: error.message,
    });
    return;
  }

  res.status(500).json({ message: 'Internal server error' });
}
