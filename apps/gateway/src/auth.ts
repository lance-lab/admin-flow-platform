import type { NextFunction, Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import { config } from './config.js';

export interface GatewayUser {
  id: string;
  email: string;
  displayName: string;
  locale: 'sk' | 'en';
  permissions: string[];
}

declare global {
  namespace Express {
    interface Request {
      user?: GatewayUser;
    }
  }
}

export function signUser(user: GatewayUser) {
  return jwt.sign(user, config.jwtSecret, { expiresIn: '8h' });
}

export function authenticate(req: Request, res: Response, next: NextFunction) {
  const header = req.header('authorization');
  const token = header?.startsWith('Bearer ') ? header.slice('Bearer '.length) : undefined;

  if (!token) {
    res.status(401).json({ message: 'Missing bearer token' });
    return;
  }

  try {
    req.user = jwt.verify(token, config.jwtSecret) as GatewayUser;
    next();
  } catch {
    res.status(401).json({ message: 'Invalid or expired token' });
  }
}

export function requirePermission(permission: string) {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.user?.permissions.includes(permission)) {
      res.status(403).json({ message: `Missing permission: ${permission}` });
      return;
    }

    next();
  };
}
