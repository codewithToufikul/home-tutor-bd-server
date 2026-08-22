import nodemailer from 'nodemailer';

const SMTP_HOST = process.env.SMTP_HOST || '';
const SMTP_PORT = parseInt(process.env.SMTP_PORT || '587', 10);
const SMTP_USER = process.env.SMTP_USER || '';
const SMTP_PASS = process.env.SMTP_PASS || '';
const EMAIL_FROM = process.env.EMAIL_FROM || '"Home Tutor BD" <noreply@hometutorbd.com>';

const transporter = (SMTP_USER && SMTP_PASS)
  ? nodemailer.createTransport({
      host: SMTP_HOST || 'smtp.gmail.com',
      port: SMTP_PORT,
      secure: SMTP_PORT === 465,
      auth: {
        user: SMTP_USER,
        pass: SMTP_PASS,
      },
    })
  : null;

export const sendOTPEmail = async (to: string, otp: string): Promise<boolean> => {
  if (transporter) {
    try {
      await transporter.sendMail({
        from: EMAIL_FROM,
        to,
        subject: '🏠 Home Tutor BD - Your Email Verification OTP',
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 500px; margin: auto; padding: 20px; border: 1px solid #e0e0e0; border-radius: 12px;">
            <h2 style="color: #2563eb; text-align: center;">Welcome to Home Tutor BD!</h2>
            <p>Hello,</p>
            <p>Your 6-digit OTP code for email verification is:</p>
            <div style="background-color: #f1f5f9; padding: 15px; text-align: center; border-radius: 8px; font-size: 28px; font-weight: bold; letter-spacing: 5px; color: #1e293b;">
              ${otp}
            </div>
            <p style="color: #64748b; font-size: 13px; margin-top: 20px;">This code will expire in 10 minutes. If you did not request this, please ignore this email.</p>
          </div>
        `,
      });
      console.log(`✉️ [SMTP Real Email Sent] OTP sent successfully to ${to}`);
      return true;
    } catch (err) {
      console.error(`❌ [SMTP Error] Failed to send email to ${to}:`, err instanceof Error ? err.message : err);
    }
  }

  // High-visibility terminal output for development mode
  console.log(`
\x1b[36m╔═════════════════════════════════════════════════════════════╗
║ 📩 [DEV MODE] EMAIL OTP SIMULATOR                           ║
╠═════════════════════════════════════════════════════════════╣
║ 👤 To      : \x1b[33m${to.padEnd(47, ' ')}\x1b[36m║
║ 🔑 OTP CODE: \x1b[1m\x1b[32m${otp.padEnd(47, ' ')}\x1b[0m\x1b[36m║
║ ⏳ Expires : 10 minutes                                     ║
╚═════════════════════════════════════════════════════════════╝\x1b[0m
  `);
  return true;
};
