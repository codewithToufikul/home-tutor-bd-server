import { Resend } from 'resend';
import nodemailer from 'nodemailer';
import dotenv from 'dotenv';

dotenv.config();

// ─── Resend Setup ─────────────────────────────────────────────────────────────
const getResendClient = () => {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) return null;
  return new Resend(apiKey);
};

// ─── Nodemailer Fallback Setup ───────────────────────────────────────────────
export const getMailTransporter = () => {
  const host = process.env.SMTP_HOST || 'mail.hometutorproviderbd.com';
  const port = parseInt(process.env.SMTP_PORT || '465', 10);
  const user = process.env.SMTP_USER || 'hello@hometutorproviderbd.com';
  const pass = process.env.SMTP_PASS || '_M*yumO*!dakw$aR';

  return nodemailer.createTransport({
    host,
    port,
    secure: port === 465,
    auth: {
      user,
      pass,
    },
    tls: {
      rejectUnauthorized: false,
    },
  });
};

/**
 * Send OTP Verification Email via Resend (HTTPS API - 100% cPanel compatible)
 * with graceful Nodemailer fallback if Resend API key is not yet set.
 */
export const sendOTPEmail = async (to: string, otp: string, userName?: string): Promise<boolean> => {
  const recipientName = userName || 'Valued User';
  const plainTextMessage = `Hello ${recipientName},\n\nYour Home Tutor Provider BD verification code is: ${otp}\n\nThis code will expire in 10 minutes. Please do not share this code with anyone.\n\nIf you did not request this, you can safely ignore this email.\n\nBest regards,\nHome Tutor Provider BD Team\nHelpline: +880 1928-325460`;

  const htmlContent = `
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Email Verification Code</title>
    </head>
    <body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #f8fafc; color: #1e293b;">
      <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f8fafc; padding: 40px 10px;">
        <tr>
          <td align="center">
            <table width="100%" max-width="540px" cellpadding="0" cellspacing="0" style="max-width: 540px; background-color: #ffffff; border-radius: 24px; overflow: hidden; box-shadow: 0 10px 30px rgba(0, 31, 63, 0.08); border: 1px solid #e2e8f0;">
              
              <!-- Header -->
              <tr>
                <td style="background: linear-gradient(135deg, #001F3F 0%, #003366 100%); padding: 36px 30px; text-align: center;">
                  <h1 style="color: #ffffff; font-size: 24px; font-weight: 800; margin: 0; letter-spacing: -0.5px;">
                    Home Tutor Provider <span style="color: #10b981;">BD</span>
                  </h1>
                  <p style="color: rgba(255, 255, 255, 0.8); font-size: 13px; margin: 6px 0 0 0; font-weight: 500;">
                    #1 Verified Tutor Platform in Bangladesh
                  </p>
                </td>
              </tr>

              <!-- Content Body -->
              <tr>
                <td style="padding: 36px 32px 28px 32px;">
                  <h2 style="color: #0f172a; font-size: 20px; font-weight: 700; margin: 0 0 12px 0;">
                    Hello, ${recipientName}!
                  </h2>
                  <p style="color: #475569; font-size: 14px; line-height: 22px; margin: 0 0 24px 0;">
                    Thank you for choosing <strong>Home Tutor Provider BD</strong>. Please use the following 6-digit One-Time Password (OTP) to verify your email address and activate your account:
                  </p>

                  <!-- OTP Box -->
                  <div style="background: #f0fdf4; border: 2px dashed #10b981; border-radius: 16px; padding: 24px 16px; text-align: center; margin: 0 0 24px 0;">
                    <span style="font-size: 12px; font-weight: 700; color: #047857; text-transform: uppercase; letter-spacing: 1.5px; display: block; margin-bottom: 8px;">
                      Verification Code
                    </span>
                    <span style="font-family: 'Courier New', Courier, monospace; font-size: 38px; font-weight: 800; color: #065f46; letter-spacing: 8px; display: inline-block;">
                      ${otp}
                    </span>
                  </div>

                  <div style="background-color: #f8fafc; border-radius: 12px; padding: 14px 16px; margin-bottom: 24px;">
                    <p style="margin: 0; font-size: 12px; color: #64748b; line-height: 18px;">
                      ⏱️ <strong>Note:</strong> This verification code is valid for <strong>10 minutes</strong>. For your security, never share this OTP with anyone.
                    </p>
                  </div>

                  <p style="color: #475569; font-size: 13px; line-height: 20px; margin: 0;">
                    If you did not request this verification, please safely ignore this email or contact our support team.
                  </p>
                </td>
              </tr>

              <!-- Footer -->
              <tr>
                <td style="background-color: #f8fafc; padding: 24px 32px; text-align: center; border-top: 1px solid #e2e8f0;">
                  <p style="color: #64748b; font-size: 12px; margin: 0 0 6px 0;">
                    Home Tutor Provider BD • Helpline: +880 1928-325460
                  </p>
                  <p style="color: #94a3b8; font-size: 11px; margin: 0;">
                    © ${new Date().getFullYear()} Home Tutor Provider BD. All rights reserved.
                  </p>
                </td>
              </tr>

            </table>
          </td>
        </tr>
      </table>
    </body>
    </html>
  `;

  // 1️⃣ Try Resend First (Recommended, uses HTTPS Port 443 — works everywhere!)
  const resend = getResendClient();
  if (resend) {
    try {
      // Verified domain sender — hardcoded to avoid cPanel env variable parsing issues with spaces/< >
      const from = 'Home Tutor Provider BD <hello@hometutorproviderbd.com>';
      const replyTo = 'hello@hometutorproviderbd.com';

      const { data, error } = await resend.emails.send({
        from,
        to: [to],
        replyTo,
        subject: `${otp} is your Home Tutor Provider BD verification code`,
        html: htmlContent,
        text: plainTextMessage,
      });

      if (error) {
        console.error('❌ [Resend Error]:', error.message || error);
        // Fall back to nodemailer if Resend returned an error
      } else {
        console.log(`✉️ [Resend Email Sent] OTP email sent successfully to ${to} (ID: ${data?.id})`);
        return true;
      }
    } catch (resendErr) {
      console.warn('⚠️ [Resend Exception] Falling back to SMTP transporter:', resendErr instanceof Error ? resendErr.message : resendErr);
    }
  }

  // 2️⃣ Fallback to Nodemailer SMTP
  try {
    const rawFrom = process.env.EMAIL_FROM || 'hello@hometutorproviderbd.com';
    const from = rawFrom.includes('<') ? rawFrom : `"Home Tutor Provider BD" <${rawFrom}>`;
    const transporter = getMailTransporter();

    const info = await transporter.sendMail({
      from,
      to,
      replyTo: 'hello@hometutorproviderbd.com',
      subject: `${otp} is your Home Tutor Provider BD verification code`,
      text: plainTextMessage,
      headers: {
        'X-Priority': '1',
        'X-MSMail-Priority': 'High',
        'Importance': 'High',
      },
      html: htmlContent,
    });

    console.log(`✉️ [SMTP Real Email Sent] OTP email sent successfully to ${to} (MessageID: ${info.messageId})`);
    return true;
  } catch (err) {
    console.error(`❌ [Email Error] Failed to send email to ${to}:`, err instanceof Error ? err.message : err);
    return false;
  }
};

/**
 * Send Password Reset OTP Email via Resend / Nodemailer
 */
export const sendPasswordResetEmail = async (to: string, otp: string, userName?: string): Promise<boolean> => {
  const recipientName = userName || 'Valued User';
  const plainTextMessage = `Hello ${recipientName},\n\nYour Home Tutor Provider BD password reset code is: ${otp}\n\nThis code will expire in 10 minutes. Please do not share this code with anyone.\n\nIf you did not request a password reset, you can safely ignore this email.\n\nBest regards,\nHome Tutor Provider BD Team\nHelpline: +880 1928-325460`;

  const htmlContent = `
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Reset Your Password</title>
    </head>
    <body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #f8fafc; color: #1e293b;">
      <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f8fafc; padding: 40px 10px;">
        <tr>
          <td align="center">
            <table width="100%" max-width="540px" cellpadding="0" cellspacing="0" style="max-width: 540px; background-color: #ffffff; border-radius: 24px; overflow: hidden; box-shadow: 0 10px 30px rgba(0, 31, 63, 0.08); border: 1px solid #e2e8f0;">
              
              <!-- Header -->
              <tr>
                <td style="background: linear-gradient(135deg, #001F3F 0%, #003366 100%); padding: 36px 30px; text-align: center;">
                  <h1 style="color: #ffffff; font-size: 24px; font-weight: 800; margin: 0; letter-spacing: -0.5px;">
                    Home Tutor Provider <span style="color: #10b981;">BD</span>
                  </h1>
                  <p style="color: rgba(255, 255, 255, 0.8); font-size: 13px; margin: 6px 0 0 0; font-weight: 500;">
                    Password Reset Security Verification
                  </p>
                </td>
              </tr>

              <!-- Content Body -->
              <tr>
                <td style="padding: 36px 32px 28px 32px;">
                  <h2 style="color: #0f172a; font-size: 20px; font-weight: 700; margin: 0 0 12px 0;">
                    Hello, ${recipientName}!
                  </h2>
                  <p style="color: #475569; font-size: 14px; line-height: 22px; margin: 0 0 24px 0;">
                    We received a request to reset your <strong>Home Tutor Provider BD</strong> account password. Please use the following 6-digit One-Time Password (OTP) to set a new password:
                  </p>

                  <!-- OTP Box -->
                  <div style="background: #f0fdf4; border: 2px dashed #10b981; border-radius: 16px; padding: 24px 16px; text-align: center; margin: 0 0 24px 0;">
                    <span style="font-size: 12px; font-weight: 700; color: #047857; text-transform: uppercase; letter-spacing: 1.5px; display: block; margin-bottom: 8px;">
                      Password Reset Code
                    </span>
                    <span style="font-family: 'Courier New', Courier, monospace; font-size: 38px; font-weight: 800; color: #065f46; letter-spacing: 8px; display: inline-block;">
                      ${otp}
                    </span>
                  </div>

                  <div style="background-color: #fffbeb; border: 1px solid #fef3c7; border-radius: 12px; padding: 14px 16px; margin-bottom: 24px;">
                    <p style="margin: 0; font-size: 12px; color: #92400e; line-height: 18px;">
                      ⏱️ <strong>Important:</strong> This reset code is valid for <strong>10 minutes</strong>. If you did not request a password reset, please ignore this email and your password will remain unchanged.
                    </p>
                  </div>

                  <p style="color: #475569; font-size: 13px; line-height: 20px; margin: 0;">
                    For any assistance, feel free to contact our 24/7 support team.
                  </p>
                </td>
              </tr>

              <!-- Footer -->
              <tr>
                <td style="background-color: #f8fafc; padding: 24px 32px; text-align: center; border-top: 1px solid #e2e8f0;">
                  <p style="color: #64748b; font-size: 12px; margin: 0 0 6px 0;">
                    Home Tutor Provider BD • Helpline: +880 1928-325460
                  </p>
                  <p style="color: #94a3b8; font-size: 11px; margin: 0;">
                    © ${new Date().getFullYear()} Home Tutor Provider BD. All rights reserved.
                  </p>
                </td>
              </tr>

            </table>
          </td>
        </tr>
      </table>
    </body>
    </html>
  `;

  // 1️⃣ Try Resend First
  const resend = getResendClient();
  if (resend) {
    try {
      const from = 'Home Tutor Provider BD <hello@hometutorproviderbd.com>';
      const replyTo = 'hello@hometutorproviderbd.com';

      const { data, error } = await resend.emails.send({
        from,
        to: [to],
        replyTo,
        subject: `🔐 ${otp} is your password reset code - Home Tutor Provider BD`,
        html: htmlContent,
        text: plainTextMessage,
      });

      if (error) {
        console.error('❌ [Resend Error]:', error.message || error);
      } else {
        console.log(`✉️ [Resend Email Sent] Reset password email sent successfully to ${to} (ID: ${data?.id})`);
        return true;
      }
    } catch (resendErr) {
      console.warn('⚠️ [Resend Exception] Falling back to SMTP transporter:', resendErr instanceof Error ? resendErr.message : resendErr);
    }
  }

  // 2️⃣ Fallback to Nodemailer SMTP
  try {
    const rawFrom = process.env.EMAIL_FROM || 'hello@hometutorproviderbd.com';
    const from = rawFrom.includes('<') ? rawFrom : `"Home Tutor Provider BD" <${rawFrom}>`;
    const transporter = getMailTransporter();

    const info = await transporter.sendMail({
      from,
      to,
      replyTo: 'hello@hometutorproviderbd.com',
      subject: `🔐 ${otp} is your password reset code - Home Tutor Provider BD`,
      text: plainTextMessage,
      headers: {
        'X-Priority': '1',
        'X-MSMail-Priority': 'High',
        'Importance': 'High',
      },
      html: htmlContent,
    });

    console.log(`✉️ [SMTP Real Email Sent] Reset password email sent successfully to ${to} (MessageID: ${info.messageId})`);
    return true;
  } catch (err) {
    console.error(`❌ [Email Error] Failed to send reset email to ${to}:`, err instanceof Error ? err.message : err);
    return false;
  }
};
