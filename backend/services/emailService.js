const nodemailer = require('nodemailer');

/**
 * Email Service — Nodemailer with Gmail SMTP
 * Plug in your Gmail + App Password in backend/.env
 */

// Create transporter (lazy — only used when credentials are set)
function createTransporter() {
  const user = process.env.GMAIL_USER;
  const pass = process.env.GMAIL_APP_PASSWORD;

  if (!user || !pass) {
    console.warn('[Email] ⚠️  Gmail credentials not set — using demo mode (OTP shown in response)');
    return null;
  }

  return nodemailer.createTransport({
    host: 'smtp.gmail.com',
    port: 587,
    secure: false, // TLS
    auth: { user, pass },
    tls: { rejectUnauthorized: false },
  });
}

/**
 * Generate beautiful HTML email for OTP
 */
function buildOtpEmailHtml(otp, name = 'Voter') {
  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8"/>
  <meta name="viewport" content="width=device-width,initial-scale=1"/>
  <title>QuantumVote OTP</title>
</head>
<body style="margin:0;padding:0;background:#000000;font-family:'Helvetica Neue',Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#000000;padding:40px 20px;">
    <tr><td align="center">
      <table width="560" cellpadding="0" cellspacing="0" style="background:#0a0a0a;border:1px solid rgba(255,255,255,0.1);border-radius:12px;overflow:hidden;max-width:560px;width:100%;">

        <!-- Header -->
        <tr>
          <td style="padding:28px 36px;border-bottom:1px solid rgba(255,255,255,0.07);">
            <table width="100%" cellpadding="0" cellspacing="0">
              <tr>
                <td>
                  <table cellpadding="0" cellspacing="0">
                    <tr>
                      <td style="width:28px;height:28px;border:1.5px solid #ffffff;border-radius:5px;text-align:center;vertical-align:middle;font-size:14px;color:#fff;">⚛</td>
                      <td style="padding-left:10px;font-size:1rem;font-weight:900;color:#ffffff;letter-spacing:-0.02em;">QuantumVote</td>
                    </tr>
                  </table>
                </td>
                <td align="right" style="font-size:0.7rem;color:#555555;letter-spacing:0.08em;font-family:'Courier New',monospace;">SECURE AUTHENTICATION</td>
              </tr>
            </table>
          </td>
        </tr>

        <!-- Body -->
        <tr>
          <td style="padding:36px;">
            <p style="color:#a0a0a0;font-size:0.9rem;margin:0 0 24px;">Hello, <strong style="color:#ffffff;">${name}</strong></p>
            <h1 style="color:#ffffff;font-size:1.4rem;font-weight:900;margin:0 0 8px;letter-spacing:-0.02em;">Your Verification Code</h1>
            <p style="color:#555555;font-size:0.85rem;margin:0 0 28px;">Use this one-time code to access your secure ballot. It expires in <strong style="color:#a0a0a0;">10 minutes</strong>.</p>

            <!-- OTP Box -->
            <table width="100%" cellpadding="0" cellspacing="0">
              <tr>
                <td align="center" style="padding:28px;background:rgba(255,255,255,0.04);border:1px solid rgba(255,255,255,0.12);border-radius:10px;">
                  <div style="font-family:'Courier New',monospace;font-size:2.8rem;font-weight:900;letter-spacing:0.4em;color:#ffffff;padding-right:-0.4em;">${otp}</div>
                  <p style="color:#555555;font-size:0.75rem;margin:10px 0 0;letter-spacing:0.05em;">ONE-TIME PASSWORD</p>
                </td>
              </tr>
            </table>

            <div style="height:1px;background:rgba(255,255,255,0.06);margin:28px 0;"></div>

            <!-- Security info -->
            <table width="100%" cellpadding="0" cellspacing="0">
              <tr>
                <td style="padding-bottom:12px;">
                  <table cellpadding="0" cellspacing="0"><tr>
                    <td style="font-size:0.82rem;color:#555555;">🔐</td>
                    <td style="padding-left:8px;font-size:0.82rem;color:#555555;">Encrypted with <strong style="color:#a0a0a0;">CRYSTALS-Kyber-1024</strong> post-quantum cryptography</td>
                  </tr></table>
                </td>
              </tr>
              <tr>
                <td style="padding-bottom:12px;">
                  <table cellpadding="0" cellspacing="0"><tr>
                    <td style="font-size:0.82rem;color:#555555;">✍</td>
                    <td style="padding-left:8px;font-size:0.82rem;color:#555555;">Signed with <strong style="color:#a0a0a0;">CRYSTALS-Dilithium-3</strong> digital signature</td>
                  </tr></table>
                </td>
              </tr>
              <tr>
                <td>
                  <table cellpadding="0" cellspacing="0"><tr>
                    <td style="font-size:0.82rem;color:#555555;">⚠</td>
                    <td style="padding-left:8px;font-size:0.82rem;color:#555555;">Never share this code. QuantumVote will never ask for your OTP by phone or chat.</td>
                  </tr></table>
                </td>
              </tr>
            </table>
          </td>
        </tr>

        <!-- Footer -->
        <tr>
          <td style="padding:20px 36px;border-top:1px solid rgba(255,255,255,0.06);">
            <table width="100%" cellpadding="0" cellspacing="0">
              <tr>
                <td style="font-size:0.72rem;color:#333333;font-family:'Courier New',monospace;">QUANTUMVOTE · SDG 16 · NIST FIPS 203/204</td>
                <td align="right" style="font-size:0.72rem;color:#333333;font-family:'Courier New',monospace;">QUANTUM-RESISTANT</td>
              </tr>
            </table>
          </td>
        </tr>

      </table>
    </td></tr>
  </table>
</body>
</html>`;
}

/**
 * Send OTP email
 * @param {string} to - recipient email
 * @param {string} otp - 6-digit OTP
 * @param {string} name - voter name
 * @returns {Promise<{ sent: boolean, messageId?: string, error?: string }>}
 */
async function sendOtpEmail(to, otp, name = 'Voter') {
  const transporter = createTransporter();

  if (!transporter) {
    // Demo mode — log OTP to console
    console.log(`\n🔑 [DEMO OTP] ${to}: ${otp}\n`);
    return { sent: false, demo: true };
  }

  try {
    const info = await transporter.sendMail({
      from: `"QuantumVote ⚛" <${process.env.GMAIL_USER}>`,
      to,
      subject: `${otp} — Your QuantumVote Verification Code`,
      text: `Your QuantumVote OTP: ${otp}\n\nValid for 10 minutes.\n\nQuantumVote — Quantum-Resistant Digital Voting`,
      html: buildOtpEmailHtml(otp, name),
    });
    console.log(`[Email] ✅ OTP sent to ${to} — MessageId: ${info.messageId}`);
    return { sent: true, messageId: info.messageId };
  } catch (err) {
    console.error(`[Email] ❌ Failed to send to ${to}:`, err.message);
    return { sent: false, error: err.message };
  }
}

/**
 * Verify SMTP connection (run at startup)
 */
async function verifyEmailConnection() {
  const transporter = createTransporter();
  if (!transporter) return false;
  try {
    await transporter.verify();
    console.log('[Email] ✅ Gmail SMTP connection verified');
    return true;
  } catch (err) {
    console.error('[Email] ❌ Gmail SMTP verification failed:', err.message);
    console.error('[Email] Check GMAIL_USER and GMAIL_APP_PASSWORD in backend/.env');
    return false;
  }
}

module.exports = { sendOtpEmail, verifyEmailConnection };
