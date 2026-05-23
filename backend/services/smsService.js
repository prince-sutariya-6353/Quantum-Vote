/**
 * SMS Service — Fast2SMS (Popular for Indian developers/hackathons with free credit)
 * Get your free API key at: https://www.fast2sms.com
 */

async function sendSmsOtp(phone, otp) {
  const apiKey = process.env.FAST2SMS_API_KEY;

  if (!apiKey || apiKey.length < 10 || apiKey === 'your_fast2sms_api_key_here') {
    console.warn('[SMS] ⚠️  Fast2SMS API key not set — using demo mode (OTP shown below)');
    console.log(`\n📱 [DEMO SMS OTP] Sent to ${phone}: ${otp}\n`);
    return { sent: false, demo: true };
  }

  try {
    // Fast2SMS Route V2 (OTP)
    const url = 'https://www.fast2sms.com/dev/bulkV2';
    const params = new URLSearchParams({
      authorization: apiKey,
      route: 'q',
      message: `Your QuantumVote Aadhaar verification OTP is: ${otp}`,
      language: 'english',
      flash: '0',
      numbers: phone,
    });

    const response = await fetch(`${url}?${params.toString()}`, {
      method: 'GET',
    });

    const data = await response.json();

    if (data.return) {
      console.log(`[SMS] ✅ OTP sent to ${phone} via Fast2SMS`);
      return { sent: true, data };
    } else {
      console.error(`[SMS] ❌ Fast2SMS API Error:`, data.message);
      return { sent: false, error: data.message };
    }
  } catch (err) {
    console.error(`[SMS] ❌ Failed to send to ${phone}:`, err.message);
    return { sent: false, error: err.message };
  }
}

module.exports = { sendSmsOtp };
