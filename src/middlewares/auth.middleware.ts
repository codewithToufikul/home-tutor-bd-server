import type { NextFunction, Request, Response } from 'express';
import { AppError } from '../errors/AppError.js';
import { User } from '../modules/user/user.model.js';
import { verifyToken } from '../utils/jwt.js';

export interface CustomRequest extends Request {
  user?: {
    userId: string;
    email?: string | undefined;
    role: string;
  };
}

export const auth = (...requiredRoles: string[]) => {
  return async (req: CustomRequest, _res: Response, next: NextFunction) => {
    try {
      const token = req.headers.authorization?.split(' ')[1];

      if (!token) {
        throw new AppError(401, 'You are not authorized! Token missing.');
      }

      const jwtSecret = process.env.JWT_ACCESS_SECRET || 'fallback_access_secret';
      const decoded = verifyToken(token, jwtSecret);

      const user = await User.findById(decoded.userId);
      if (!user) {
        throw new AppError(404, 'This user is no longer found!');
      }

      if (user.status === 'blocked') {
        throw new AppError(403, 'This user is blocked!');
      }

      if (requiredRoles.length) {
        const userRole = user.role;
        const isSuperAdmin = userRole === 'super_admin';
        const hasDirectRole = requiredRoles.includes(userRole);
        const hasAdminAccess = isSuperAdmin && (requiredRoles.includes('admin') || requiredRoles.includes('moderator'));
        const hasModAccess = userRole === 'admin' && requiredRoles.includes('moderator');

        if (!hasDirectRole && !hasAdminAccess && !hasModAccess) {
          throw new AppError(403, 'You have no permission to access this resource!');
        }
      }

      req.user = decoded;
      next();
    } catch (error) {
      next(error);
    }
  };
};

export const optionalAuth = () => {
  return async (req: CustomRequest, _res: Response, next: NextFunction) => {
    try {
      const token = req.headers.authorization?.split(' ')[1];
      if (token) {
        const jwtSecret = process.env.JWT_ACCESS_SECRET || 'fallback_access_secret';
        const decoded = verifyToken(token, jwtSecret);
        const user = await User.findById(decoded.userId);
        if (user && user.status !== 'blocked') {
          req.user = decoded;
        }
      }
      next();
    } catch {
      // Ignore token verification errors for optional auth and proceed as guest
      next();
    }
  };
};
