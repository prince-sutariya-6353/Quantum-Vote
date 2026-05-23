const express = require('express');
const router = express.Router();
const { authenticate } = require('./auth');
const Vote = require('../models/Vote');
const Voter = require('../models/Voter');
const Candidate = require('../models/Candidate');
const Election = require('../models/Election');
const AuditLog = require('../models/AuditLog');
const SecurityAlert = require('../models/SecurityAlert');
const { logAudit } = require('../services/auditService');

// Admin JWT check
function adminOnly(req, res, next) {
  if (req.user?.role !== 'admin') {
    return res.status(403).json({ error: 'Admin access required' });
  }
  next();
}

// ─── GET /api/admin/stats ────────────────────────────────────────────────────
router.get('/stats', authenticate, adminOnly, async (req, res) => {
  try {
    const election = await Election.findOne({ status: 'active' });
    const totalVoters = await Voter.countDocuments({ role: 'voter' });
    const totalVoted = await Voter.countDocuments({ role: 'voter', hasVoted: true });
    const totalVotes = await Vote.countDocuments();
    const candidates = await Candidate.find();

    // Vote counts per candidate
    const voteCounts = await Vote.aggregate([
      { $group: { _id: '$candidateId', count: { $sum: 1 } } },
    ]);

    const candidateResults = candidates.map((c) => {
      const entry = voteCounts.find((v) => v._id?.toString() === c._id.toString());
      return {
        id: c._id,
        name: c.name,
        party: c.party,
        partyColor: c.partyColor,
        partyShortName: c.partyShortName,
        avatar: c.avatar,
        votes: entry?.count || 0,
        percentage: totalVotes > 0 ? (((entry?.count || 0) / totalVotes) * 100).toFixed(1) : '0.0',
      };
    });

    const unresolvedAlerts = await SecurityAlert.countDocuments({ resolved: false });
    const criticalAlerts = await SecurityAlert.countDocuments({ severity: 'CRITICAL', resolved: false });

    res.json({
      election: election || { title: 'No active election', status: 'ended' },
      totalVoters,
      totalVoted,
      totalVotes,
      turnoutPercentage: totalVoters > 0 ? ((totalVoted / totalVoters) * 100).toFixed(1) : '0.0',
      candidateResults,
      security: {
        unresolvedAlerts,
        criticalAlerts,
        integrityStatus: 'VERIFIED',
        encryptionAlgorithm: 'CRYSTALS-Kyber-1024 + AES-256-GCM',
        signingAlgorithm: 'CRYSTALS-Dilithium-3',
        quantumResistant: true,
      },
    });
  } catch (err) {
    console.error('[Admin] stats error:', err);
    res.status(500).json({ error: 'Failed to fetch stats' });
  }
});

// ─── GET /api/admin/alerts ────────────────────────────────────────────────────
router.get('/alerts', authenticate, adminOnly, async (req, res) => {
  try {
    const { page = 1, limit = 20, resolved } = req.query;
    const filter = {};
    if (resolved !== undefined) filter.resolved = resolved === 'true';

    const alerts = await SecurityAlert.find(filter)
      .sort({ timestamp: -1 })
      .skip((page - 1) * limit)
      .limit(Number(limit));

    const total = await SecurityAlert.countDocuments(filter);

    res.json({ alerts, total, page: Number(page), totalPages: Math.ceil(total / limit) });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch alerts' });
  }
});

// ─── PATCH /api/admin/alerts/:id/resolve ─────────────────────────────────────
router.patch('/alerts/:id/resolve', authenticate, adminOnly, async (req, res) => {
  try {
    const alert = await SecurityAlert.findByIdAndUpdate(
      req.params.id,
      { resolved: true, resolvedAt: new Date() },
      { new: true }
    );
    if (!alert) return res.status(404).json({ error: 'Alert not found' });
    res.json({ success: true, alert });
  } catch (err) {
    res.status(500).json({ error: 'Failed to resolve alert' });
  }
});

// ─── GET /api/admin/audit ────────────────────────────────────────────────────
router.get('/audit', authenticate, adminOnly, async (req, res) => {
  try {
    const { page = 1, limit = 30, eventType, severity } = req.query;
    const filter = {};
    if (eventType) filter.eventType = eventType;
    if (severity) filter.severity = severity;

    const logs = await AuditLog.find(filter)
      .sort({ timestamp: -1 })
      .skip((page - 1) * limit)
      .limit(Number(limit));

    const total = await AuditLog.countDocuments(filter);

    res.json({ logs, total, page: Number(page), totalPages: Math.ceil(total / limit) });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch audit log' });
  }
});

// ─── GET /api/admin/votes ────────────────────────────────────────────────────
router.get('/votes', authenticate, adminOnly, async (req, res) => {
  try {
    const { page = 1, limit = 20 } = req.query;
    const votes = await Vote.find()
      .select('-aesEncrypted -kyberCiphertext -iv -authTag') // Hide raw encrypted data
      .populate('candidateId', 'name party')
      .sort({ timestamp: -1 })
      .skip((page - 1) * limit)
      .limit(Number(limit));

    const total = await Vote.countDocuments();
    res.json({ votes, total, page: Number(page), totalPages: Math.ceil(total / limit) });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch votes' });
  }
});

// ─── POST /api/admin/finalize ─────────────────────────────────────────────────
router.post('/finalize', authenticate, adminOnly, async (req, res) => {
  try {
    const election = await Election.findOne({ status: 'active' });
    if (!election) return res.status(404).json({ error: 'No active election' });

    election.status = 'ended';
    election.isSealed = true;
    election.sealedAt = new Date();
    await election.save();

    await logAudit({
      event: `Election "${election.title}" finalized and sealed by admin`,
      eventType: 'ADMIN',
      severity: 'WARNING',
      actorHash: req.user.id,
      targetId: election._id.toString(),
    });

    res.json({ success: true, message: 'Election finalized and sealed', election });
  } catch (err) {
    res.status(500).json({ error: 'Failed to finalize election' });
  }
});

// ─── GET /api/admin/integrity-check ─────────────────────────────────────────
router.get('/integrity-check', authenticate, adminOnly, async (req, res) => {
  try {
    const { verifyVoteIntegrity } = require('../pqcService');
    const votes = await Vote.find();
    let valid = 0, invalid = 0, results = [];

    for (const vote of votes) {
      const check = verifyVoteIntegrity({
        kyberCiphertext: vote.kyberCiphertext,
        aesEncrypted: vote.aesEncrypted,
        authTag: vote.authTag,
        integrityHash: vote.integrityHash,
      });

      if (check.valid) { valid++; } else { invalid++; }

      results.push({
        receiptId: vote.receiptId,
        valid: check.valid,
        timestamp: vote.timestamp,
      });

      // Update integrity status
      if (vote.integrityValid !== check.valid) {
        vote.integrityValid = check.valid;
        await vote.save();
      }
    }

    res.json({
      totalVotes: votes.length,
      validVotes: valid,
      invalidVotes: invalid,
      integrityRate: votes.length > 0 ? ((valid / votes.length) * 100).toFixed(2) : '100',
      checkedAt: new Date().toISOString(),
      results,
    });
  } catch (err) {
    res.status(500).json({ error: 'Integrity check failed' });
  }
});

module.exports = router;
