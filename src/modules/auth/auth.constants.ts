export const ACCESS_TOKEN_EXPIRES_IN = '7d';
export const REFRESH_TOKEN_EXPIRES_IN = '30d';

export const REFRESH_TOKEN_COOKIE_NAME = 'refreshToken';

export const COOKIE_OPTIONS = {
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: (process.env.NODE_ENV === 'production' ? 'none' : 'lax') as 'none' | 'lax',
  maxAge: 30 * 24 * 60 * 60 * 1000, // 30 days
};
