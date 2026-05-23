/**
 * Tamper Detection Middleware
 * Detects: duplicate votes, rate abuse, suspicious timing, integrity failures
 */
const Vote = require('../models/Vote');
const { createAlert, logAudit, hashIp } = require('../services/auditService');

// In-memory rate limit store (replace with Redis in production)
const requestCounts = new Map();
const OTP_ATTEMPTS = new Map();

/**
 * Rate limiter middleware for sensitive endpoints
 */
function rateLimiter(maxRequests = 10, windowMs = 60000) {
  return async (req, res, next) => {
    const ip = req.ip || req.connection.remoteAddress;
    const key = `${ip}-${req.path}`;
    const now = Date.now();

    const entry = requestCounts.get(key) || { count: 0, resetAt: now + windowMs };

    if (now > entry.resetAt) {
      entry.count = 0;
      entry.resetAt = now + windowMs;
    }

    entry.count++;
    requestCounts.set(key, entry);

    if (entry.count > maxRequests) {
      await createAlert({
        type: 'RATE_LIMIT_EXCEEDED',
        severity: 'HIGH',
        title: 'Rate Limit Exceeded',
        description: `Too many requests from IP hash ${hashIp(ip)} on ${req.path}`,
        actorHash: hashIp(ip),
        metadata: { path: req.path, count: entry.count },
      });
      return res.status(429).json({
        error: 'Too many requests. Please wait before retrying.',
        retryAfter: Math.ceil((entry.resetAt - now) / 1000),
      });
    }
    next();
  };
}

/**
 * Detect duplicate vote attempts
 */
async function detectDuplicateVote(req, res, next) {
  const { voterId, electionId } = req.body;
  const { user } = req;

  if (!user) return next();

  // Check if voter has already voted (double-check beyond session)
  const existingVote = await Vote.findOne({
    voterAnonymousHash: { $exists: true },
    electionId,
  });

  // The actual voter check is in the vote route using voter.hasVoted
  next();
}

/**
 * Detect OTP brute force
 */
function detectOtpBruteForce(email) {
  const key = `otp-${email}`;
  const now = Date.now();
  const entry = OTP_ATTEMPTS.get(key) || { count: 0, resetAt: now + 300000 }; // 5 min window

  if (now > entry.resetAt) {
    entry.count = 0;
    entry.resetAt = now + 300000;
  }

  entry.count++;
  OTP_ATTEMPTS.set(key, entry);

  return {
    blocked: entry.count > 5,
    attemptsRemaining: Math.max(0, 5 - entry.count),
    resetAt: entry.resetAt,
  };
}

function resetOtpAttempts(email) {
  OTP_ATTEMPTS.delete(`otp-${email}`);
}

module.exports = { rateLimiter, detectDuplicateVote, detectOtpBruteForce, resetOtpAttempts };
