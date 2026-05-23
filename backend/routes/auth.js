const express = require('express');
const router = express.Router();
const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const Voter = require('../models/Voter');
const { kyberGenerateKeypair, dilithiumGenerateKeypair } = require('../pqcService');
const { logAudit, createAlert, hashIp } = require('../services/auditService');
const { detectOtpBruteForce, resetOtpAttempts, rateLimiter } = require('../middleware/tamperDetect');
const { sendOtpEmail } = require('../services/emailService');
const { sendSmsOtp } = require('../services/smsService');
const bcrypt = require('bcryptjs');

const JWT_SECRET = process.env.JWT_SECRET || 'quantumvote-secret-2026-pqc';

// In-memory OTP store (in production: Redis)
const otpStore = new Map();

// ─── POST /api/auth/admin-login ──────────────────────────────────────────────
router.post('/admin-login', rateLimiter(5, 60000), async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) return res.status(400).json({ error: 'Email and password required' });

    const voter = await Voter.findOne({ email: email.toLowerCase() });
    if (!voter || voter.role !== 'admin') {
      return res.status(401).json({ error: 'Invalid admin credentials' });
    }

    const isMatch = await bcrypt.compare(password, voter.password);
    if (!isMatch) {
      await createAlert({ type: 'INVALID_LOGIN', severity: 'HIGH', title: 'Failed admin login attempt', actorHash: voter._id.toString() });
      return res.status(401).json({ error: 'Invalid admin credentials' });
    }

    // Generate JWT
    const token = jwt.sign({ id: voter._id, role: voter.role }, JWT_SECRET, { expiresIn: '12h' });

    await logAudit({ event: `Admin logged in: ${voter.email}`, eventType: 'AUTH', severity: 'INFO', actorHash: voter._id.toString(), ipHash: hashIp(req.ip || '127.0.0.1') });

    res.json({
      success: true,
      token,
      voter: {
        id: voter._id,
        email: voter.email,
        name: voter.name,
        role: voter.role,
      }
    });
  } catch (err) {
    console.error('[Auth] admin-login error:', err);
    res.status(500).json({ error: 'Login failed' });
  }
});

// ─── POST /api/auth/send-otp ─────────────────────────────────────────────────
router.post('/send-otp', rateLimiter(5, 60000), async (req, res) => {
  try {
    const { email, name } = req.body;
    if (!email) return res.status(400).json({ error: 'Email is required' });

    const emailLower = email.toLowerCase().trim();

    // Generate 6-digit OTP
    const otp = crypto.randomInt(100000, 999999).toString();
    const expiry = Date.now() + 10 * 60 * 1000; // 10 minutes

    // Upsert voter record
    let voter = await Voter.findOne({ email: emailLower });
    if (!voter) {
      voter = new Voter({ email: emailLower, name: name || 'Voter', voterId: crypto.randomUUID() });
    }
    voter.otp = crypto.createHash('sha256').update(otp).digest('hex');
    voter.otpExpiry = new Date(expiry);
    voter.otpAttempts = 0;
    await voter.save();

    // Store OTP in memory for quick verification
    otpStore.set(emailLower, { otp, expiry });

    // Log audit
    await logAudit({
      event: `OTP sent to ${emailLower}`,
      eventType: 'AUTH',
      severity: 'INFO',
      actorHash: crypto.createHash('sha256').update(emailLower).digest('hex').slice(0, 16),
      ipHash: hashIp(req.ip || '127.0.0.1'),
    });

    // Send real email via Gmail SMTP (or demo mode if not configured)
    const emailResult = await sendOtpEmail(emailLower, otp, voter.name || name || 'Voter');

    res.json({
      success: true,
      message: emailResult.sent
        ? `OTP sent to ${emailLower}`
        : 'OTP generated (demo mode — email not configured)',
      // Show OTP in response only when email was NOT sent (demo mode)
      demoOtp: emailResult.sent ? undefined : otp,
      emailSent: emailResult.sent,
      expiresIn: 600,
    });
  } catch (err) {
    console.error('[Auth] send-otp error:', err);
    res.status(500).json({ error: 'Failed to send OTP' });
  }
});

// ─── POST /api/auth/verify-otp ───────────────────────────────────────────────
router.post('/verify-otp', rateLimiter(10, 60000), async (req, res) => {
  try {
    const { email, otp } = req.body;
    if (!email || !otp) return res.status(400).json({ error: 'Email and OTP required' });

    const emailLower = email.toLowerCase().trim();

    // Brute force detection
    const bruteForce = detectOtpBruteForce(emailLower);
    if (bruteForce.blocked) {
      await createAlert({
        type: 'BRUTE_FORCE_OTP',
        severity: 'HIGH',
        title: 'OTP Brute Force Detected',
        description: `Multiple failed OTP attempts for ${emailLower}`,
        actorHash: crypto.createHash('sha256').update(emailLower).digest('hex').slice(0, 16),
      });
      return res.status(429).json({ error: 'Too many OTP attempts. Please request a new OTP.' });
    }

    const stored = otpStore.get(emailLower);
    if (!stored || Date.now() > stored.expiry) {
      return res.status(400).json({ error: 'OTP expired. Please request a new one.' });
    }

    if (stored.otp !== otp.trim()) {
      return res.status(401).json({
        error: 'Invalid OTP',
        attemptsRemaining: bruteForce.attemptsRemaining,
      });
    }

    // OTP valid — clear it
    otpStore.delete(emailLower);
    resetOtpAttempts(emailLower);

    const voter = await Voter.findOne({ email: emailLower });
    if (!voter) return res.status(404).json({ error: 'Voter not found' });

    // Generate PQC keypairs for this session
    const kyberKeypair = kyberGenerateKeypair();
    const dilithiumKeypair = dilithiumGenerateKeypair();

    voter.kyberPublicKey = kyberKeypair.publicKey;
    voter.dilithiumPublicKey = dilithiumKeypair.publicKey;
    voter.isVerified = true;
    voter.lastLogin = new Date();
    await voter.save();

    // Issue JWT
    const token = jwt.sign(
      {
        id: voter._id,
        email: voter.email,
        role: voter.role,
        hasVoted: voter.hasVoted,
        name: voter.name,
      },
      JWT_SECRET,
      { expiresIn: '2h' }
    );

    await logAudit({
      event: `Voter authenticated: ${emailLower}`,
      eventType: 'AUTH',
      severity: 'INFO',
      actorHash: voter._id.toString(),
      ipHash: hashIp(req.ip || '127.0.0.1'),
    });

    res.json({
      success: true,
      token,
      voter: {
        id: voter._id,
        email: voter.email,
        name: voter.name,
        role: voter.role,
        hasVoted: voter.hasVoted,
      },
      // PQC session keys (private keys stay client-side in real impl)
      pqcSession: {
        kyberPublicKey: kyberKeypair.publicKey,
        kyberPrivateKey: kyberKeypair.privateKey, // Demo only
        dilithiumPublicKey: dilithiumKeypair.publicKey,
        dilithiumPrivateKey: dilithiumKeypair.privateKey, // Demo only
        algorithm: 'CRYSTALS-Kyber-1024 + Dilithium-3',
      },
    });
  } catch (err) {
    console.error('[Auth] verify-otp error:', err);
    res.status(500).json({ error: 'Verification failed' });
  }
});

// ─── POST /api/auth/send-mobile-otp ──────────────────────────────────────────
router.post('/send-mobile-otp', authenticate, rateLimiter(5, 60000), async (req, res) => {
  try {
    const { phone, aadhaar } = req.body;
    if (!phone || !aadhaar) return res.status(400).json({ error: 'Phone and Aadhaar required' });

    const voter = await Voter.findById(req.user.id);
    if (!voter) return res.status(404).json({ error: 'Voter not found' });

    const otp = crypto.randomInt(100000, 999999).toString();
    const expiry = Date.now() + 5 * 60 * 1000; // 5 mins

    // Save masked aadhaar for audit
    voter.aadhaarLast4 = aadhaar.slice(-4);
    await voter.save();

    // Store in memory
    otpStore.set(phone, { otp, expiry });

    const smsResult = await sendSmsOtp(phone, otp);

    res.json({
      success: true,
      message: smsResult.sent ? `SMS sent to ${phone}` : 'SMS generated (demo mode)',
      demoOtp: smsResult.sent ? undefined : otp,
    });
  } catch (err) {
    console.error('[Auth] send-mobile-otp error:', err);
    res.status(500).json({ error: 'Failed to send mobile OTP' });
  }
});

// ─── POST /api/auth/verify-mobile-otp ────────────────────────────────────────
router.post('/verify-mobile-otp', authenticate, rateLimiter(10, 60000), async (req, res) => {
  try {
    const { phone, otp } = req.body;
    if (!phone || !otp) return res.status(400).json({ error: 'Phone and OTP required' });

    const stored = otpStore.get(phone);
    if (!stored || Date.now() > stored.expiry) {
      return res.status(400).json({ error: 'OTP expired. Please request a new one.' });
    }

    if (stored.otp !== otp.trim()) {
      return res.status(401).json({ error: 'Invalid SMS OTP' });
    }

    otpStore.delete(phone);

    res.json({ success: true, message: 'Phone verified successfully' });
  } catch (err) {
    res.status(500).json({ error: 'Verification failed' });
  }
});

// ─── GET /api/auth/me ────────────────────────────────────────────────────────
router.get('/me', authenticate, async (req, res) => {
  try {
    const voter = await Voter.findById(req.user.id).select('-otp');
    if (!voter) return res.status(404).json({ error: 'Voter not found' });
    res.json({ voter });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch profile' });
  }
});

// ─── Auth Middleware ──────────────────────────────────────────────────────────
function authenticate(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'No token provided' });
  }
  try {
    const token = authHeader.split(' ')[1];
    req.user = jwt.verify(token, JWT_SECRET);
    next();
  } catch {
    res.status(401).json({ error: 'Invalid or expired token' });
  }
}

module.exports = router;
module.exports.authenticate = authenticate;
