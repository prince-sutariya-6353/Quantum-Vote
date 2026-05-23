const express = require('express');
const router = express.Router();
const crypto = require('crypto');
const { v4: uuidv4 } = require('uuid');
const { authenticate } = require('./auth');
const Vote = require('../models/Vote');
const Voter = require('../models/Voter');
const Candidate = require('../models/Candidate');
const Election = require('../models/Election');
const { encryptVote, verifyVoteIntegrity, dilithiumSign } = require('../pqcService');
const { logAudit, createAlert, hashIp, anonymizeVoterId } = require('../services/auditService');
const { rateLimiter } = require('../middleware/tamperDetect');

// ─── POST /api/votes/cast ────────────────────────────────────────────────────
router.post('/cast', authenticate, rateLimiter(3, 60000), async (req, res) => {
  try {
    const { candidateId, electionId, kyberPublicKey, dilithiumPrivateKey } = req.body;
    const voterId = req.user.id;
    const ip = req.ip || '127.0.0.1';

    if (!candidateId || !electionId) {
      return res.status(400).json({ error: 'Candidate and election are required' });
    }

    // 1. Verify voter hasn't voted
    const voter = await Voter.findById(voterId);
    if (!voter) return res.status(404).json({ error: 'Voter not found' });

    if (voter.hasVoted) {
      await createAlert({
        type: 'DUPLICATE_VOTE_ATTEMPT',
        severity: 'HIGH',
        title: 'Duplicate Vote Attempt Detected',
        description: `Voter ${voter.email} attempted to vote again`,
        actorHash: voter._id.toString(),
        metadata: { candidateId, electionId },
      });
      await logAudit({
        event: 'Duplicate vote attempt blocked',
        eventType: 'SECURITY',
        severity: 'WARNING',
        actorHash: voter._id.toString(),
        ipHash: hashIp(ip),
      });
      return res.status(403).json({ error: 'You have already cast your vote in this election.' });
    }

    // 2. Verify election is active
    const election = await Election.findById(electionId);
    if (!election || election.status !== 'active') {
      return res.status(400).json({ error: 'Election is not currently active' });
    }

    // 3. Verify candidate exists
    const candidate = await Candidate.findById(candidateId);
    if (!candidate) return res.status(404).json({ error: 'Candidate not found' });

    // 4. Generate anonymous voter hash
    const voterAnonymousHash = anonymizeVoterId(voterId, electionId);

    // 5. Encrypt the vote with PQC
    const votePayload = {
      candidateId: candidateId.toString(),
      electionId: electionId.toString(),
      voterHash: voterAnonymousHash,
      timestamp: new Date().toISOString(),
      nonce: crypto.randomBytes(16).toString('hex'),
    };

    const encryptedBallot = encryptVote(votePayload, kyberPublicKey || voter.kyberPublicKey);

    // 6. Sign with Dilithium
    const voteMessage = JSON.stringify({
      integrityHash: encryptedBallot.integrityHash,
      timestamp: votePayload.timestamp,
    });
    const dilithiumSig = dilithiumSign(voteMessage, dilithiumPrivateKey || crypto.randomBytes(32).toString('base64'));

    // 7. Generate receipt ID
    const receiptId = uuidv4();

    // 8. Store encrypted vote
    const vote = await Vote.create({
      receiptId,
      electionId,
      candidateId,
      voterAnonymousHash,
      kyberCiphertext: encryptedBallot.kyberCiphertext,
      aesEncrypted: encryptedBallot.aesEncrypted,
      iv: encryptedBallot.iv,
      authTag: encryptedBallot.authTag,
      dilithiumSignature: dilithiumSig.signature,
      dilithiumPublicKey: voter.dilithiumPublicKey,
      integrityHash: encryptedBallot.integrityHash,
      encryptionMetadata: encryptedBallot.encryptionMetadata,
      ipHash: hashIp(ip),
    });

    // 9. Mark voter as voted
    voter.hasVoted = true;
    await voter.save();

    // 10. Log audit trail
    await logAudit({
      event: `Vote cast for election ${electionId}`,
      eventType: 'VOTE',
      severity: 'INFO',
      actorHash: voterAnonymousHash,
      targetId: receiptId,
      metadata: {
        receiptId,
        integrityHash: encryptedBallot.integrityHash,
        encryptionAlgorithm: 'CRYSTALS-Kyber-1024 + AES-256-GCM',
      },
      ipHash: hashIp(ip),
    });

    res.status(201).json({
      success: true,
      message: 'Your vote has been securely cast and encrypted',
      receipt: {
        receiptId,
        integrityHash: encryptedBallot.integrityHash,
        timestamp: vote.timestamp,
        candidate: { name: candidate.name, party: candidate.party },
        encryptionDetails: encryptedBallot.encryptionMetadata,
        dilithiumSignature: dilithiumSig.signature.substring(0, 40) + '...', // truncated for display
        signatureAlgorithm: 'CRYSTALS-Dilithium-3',
      },
    });
  } catch (err) {
    console.error('[Votes] cast error:', err);
    res.status(500).json({ error: 'Failed to cast vote' });
  }
});

// ─── GET /api/votes/confirm/:receiptId ──────────────────────────────────────
router.get('/confirm/:receiptId', async (req, res) => {
  try {
    const vote = await Vote.findOne({ receiptId: req.params.receiptId })
      .populate('candidateId', 'name party partyColor avatar')
      .populate('electionId', 'title status');

    if (!vote) return res.status(404).json({ error: 'Vote receipt not found' });

    vote.verificationCount += 1;
    await vote.save();

    res.json({
      success: true,
      receipt: {
        receiptId: vote.receiptId,
        timestamp: vote.timestamp,
        candidate: vote.candidateId,
        election: vote.electionId,
        integrityHash: vote.integrityHash,
        encryptionMetadata: vote.encryptionMetadata,
        integrityValid: vote.integrityValid,
        verificationCount: vote.verificationCount,
      },
    });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch receipt' });
  }
});

// ─── GET /api/votes/verify/:hash ─────────────────────────────────────────────
router.get('/verify/:hash', async (req, res) => {
  try {
    const vote = await Vote.findOne({ integrityHash: req.params.hash });
    if (!vote) return res.status(404).json({ valid: false, error: 'Hash not found in ledger' });

    // Re-verify integrity
    const integrityCheck = verifyVoteIntegrity({
      kyberCiphertext: vote.kyberCiphertext,
      aesEncrypted: vote.aesEncrypted,
      authTag: vote.authTag,
      integrityHash: vote.integrityHash,
    });

    await logAudit({
      event: 'Vote integrity verified',
      eventType: 'INTEGRITY',
      severity: 'INFO',
      targetId: vote.receiptId,
      metadata: { hash: req.params.hash, valid: integrityCheck.valid },
    });

    res.json({
      valid: integrityCheck.valid,
      receiptId: vote.receiptId,
      timestamp: vote.timestamp,
      computedHash: integrityCheck.computedHash,
      storedHash: integrityCheck.storedHash,
      verifiedAt: integrityCheck.verifiedAt,
      message: integrityCheck.valid ? 'Vote integrity confirmed — no tampering detected' : 'WARNING: Integrity check failed',
    });
  } catch (err) {
    res.status(500).json({ error: 'Verification failed' });
  }
});

// ─── GET /api/votes/candidates/:electionId ───────────────────────────────────
router.get('/candidates/:electionId', async (req, res) => {
  try {
    const candidates = await Candidate.find({ electionId: req.params.electionId }).sort('position');
    res.json({ candidates });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch candidates' });
  }
});

// ─── GET /api/votes/election ─────────────────────────────────────────────────
router.get('/election', async (req, res) => {
  try {
    const election = await Election.findOne({ status: 'active' });
    if (!election) return res.status(404).json({ error: 'No active election found' });
    const candidates = await Candidate.find({ electionId: election._id }).sort('position');
    res.json({ election, candidates });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch election data' });
  }
});

module.exports = router;
