import jwt from 'jsonwebtoken';
import type { Secret, SignOptions } from 'jsonwebtoken';

export interface TJwtPayload {
  userId: string;
  email?: string | undefined;
  role: string;
}

export const createToken = (
  jwtPayload: TJwtPayload,
  secret: Secret,
  expiresIn: string | number,
): string => {
  return jwt.sign(jwtPayload, secret, {
    expiresIn,
  } as SignOptions);
};

export const verifyToken = (token: string, secret: Secret): TJwtPayload => {
  return jwt.verify(token, secret) as TJwtPayload;
};
