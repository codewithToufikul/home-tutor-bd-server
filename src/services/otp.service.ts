const otpStore = new Map<string, { otp: string; expiresAt: number }>();

export const generateOTP = (email: string): string => {
  const otp = Math.floor(100000 + Math.random() * 900000).toString();
  const expiresAt = Date.now() + 10 * 60 * 1000; // 10 minutes validity
  otpStore.set(email.toLowerCase(), { otp, expiresAt });
  return otp;
};

export const verifyOTP = (email: string, givenOTP: string): boolean => {
  const record = otpStore.get(email.toLowerCase());
  if (!record) return false;
  if (Date.now() > record.expiresAt) {
    otpStore.delete(email.toLowerCase());
    return false;
  }
  const isValid = record.otp === givenOTP;
  if (isValid) {
    otpStore.delete(email.toLowerCase());
  }
  return isValid;
};
