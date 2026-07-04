import type { Request, Response, NextFunction } from 'express';
import { Role } from '@prisma/client';
import { AppError } from '../utils/app-error.js';

/**
 * Role-guard middleware factory.
 * Usage: authorize(Role.ADMIN, Role.DOCTOR)
 * Must be used AFTER authenticate middleware.
 */
export function authorize(...allowedRoles: Role[]) {
  return (req: Request, _res: Response, next: NextFunction) => {
    if (!req.user) {
      return next(AppError.unauthorized('Authentication required'));
    }

    if (!allowedRoles.includes(req.user.role as Role)) {
      return next(
        AppError.forbidden(`Access denied. Required roles: ${allowedRoles.join(', ')}`),
      );
    }

    next();
  };
}
