import { z } from 'zod';

const urlPattern = /(https?:\/\/|www\.|\.com|\.net|\.org|\.ly|\.xyz|\.top|\.click|\.ru|\.tr|bit\.ly|t\.me)/i;

const registerValidationSchema = z.object({
  body: z.object({
    name: z
      .string({ message: 'Name is required' })
      .trim()
      .min(2, 'Name must be at least 2 characters')
      .max(60, 'Name cannot exceed 60 characters')
      .refine((val) => !urlPattern.test(val), {
        message: 'Name cannot contain links, URLs, or promotional text',
      }),
    email: z.string({ message: 'Email is required' }).email('Invalid email address').toLowerCase().trim(),
    phone: z.string().optional(),
    location: z.string().optional(),
    gender: z.string().optional(),
    password: z.string({ message: 'Password is required' }).min(6, 'Password must be at least 6 characters'),
    role: z.enum(['tutor', 'student', 'guardian', 'coaching'], { message: 'Invalid role' }),
    tradeLicense: z.string().optional(),
    // Honeypot field (hidden in UI, bots auto-fill it)
    website: z.string().optional(),
  }),
});

const loginValidationSchema = z.object({
  body: z.object({
    email: z.string({ message: 'Email is required' }).email('Invalid email address').toLowerCase().trim(),
    password: z.string({ message: 'Password is required' }),
  }),
});

const verifyOTPValidationSchema = z.object({
  body: z.object({
    email: z.string({ message: 'Email is required' }).email('Invalid email address').toLowerCase().trim(),
    otp: z.string({ message: 'OTP is required' }).length(6, 'OTP must be 6 digits'),
  }),
});

const refreshTokenValidationSchema = z.object({
  cookies: z.object({
    refreshToken: z.string({ message: 'Refresh token is required' }),
  }).optional(),
  body: z.object({
    refreshToken: z.string().optional(),
  }).optional(),
});

export const AuthValidation = {
  registerValidationSchema,
  loginValidationSchema,
  verifyOTPValidationSchema,
  refreshTokenValidationSchema,
};
