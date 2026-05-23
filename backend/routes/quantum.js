const express = require('express');
const router = express.Router();
const {
  simulateQuantumAttackOnClassical,
  simulateQuantumAttackOnPQC,
  kyberGenerateKeypair,
  dilithiumGenerateKeypair,
  kyberEncapsulate,
  dilithiumSign,
} = require('../pqcService');
const { logAudit } = require('../services/auditService');

// ─── GET /api/quantum/algorithms ─────────────────────────────────────────────
router.get('/algorithms', (req, res) => {
  res.json({
    algorithms: [
      {
        name: 'CRYSTALS-Kyber-1024',
        type: 'Key Encapsulation Mechanism (KEM)',
        standardization: 'NIST FIPS 203',
        securityLevel: 'NIST Level 5 (256-bit quantum security)',
        description: 'Lattice-based KEM resistant to quantum attacks via LWE hardness',
        keySize: { public: 1568, private: 3168, ciphertext: 1568 },
        quantumResistant: true,
        classicalResistant: true,
        usedFor: 'Encrypting the symmetric session key used for vote encryption',
      },
      {
        name: 'CRYSTALS-Dilithium-3',
        type: 'Digital Signature Scheme',
        standardization: 'NIST FIPS 204',
        securityLevel: 'NIST Level 3 (192-bit quantum security)',
        description: 'Lattice-based signature scheme resistant to Shor\'s algorithm',
        keySize: { public: 1952, private: 4000, signature: 3293 },
        quantumResistant: true,
        classicalResistant: true,
        usedFor: 'Signing each vote for authenticity verification',
      },
      {
        name: 'AES-256-GCM',
        type: 'Symmetric Encryption',
        standardization: 'NIST FIPS 197',
        securityLevel: '128-bit quantum security (Grover)',
        description: 'AEAD cipher for actual vote payload encryption, keyed by Kyber shared secret',
        keySize: { key: 32, iv: 12, authTag: 16 },
        quantumResistant: true,
        classicalResistant: true,
        usedFor: 'Encrypting the actual vote ballot content',
      },
      {
        name: 'SHA-3-256',
        type: 'Hash Function',
        standardization: 'NIST FIPS 202',
        securityLevel: '128-bit quantum security (Grover)',
        description: 'Keccak-based hash function for integrity verification',
        quantumResistant: true,
        classicalResistant: true,
        usedFor: 'Vote integrity hash computation',
      },
    ],
  });
});

// ─── GET /api/quantum/simulate-attack ────────────────────────────────────────
router.get('/simulate-attack', async (req, res) => {
  const classical = simulateQuantumAttackOnClassical();
  const pqc = simulateQuantumAttackOnPQC();

  await logAudit({
    event: 'Quantum attack simulation run',
    eventType: 'SYSTEM',
    severity: 'INFO',
    metadata: { simulationType: 'DEMO' },
  });

  res.json({ classical, pqc, simulatedAt: new Date().toISOString() });
});

// ─── GET /api/quantum/demo-keygen ────────────────────────────────────────────
router.get('/demo-keygen', (req, res) => {
  const kyber = kyberGenerateKeypair();
  const dilithium = dilithiumGenerateKeypair();

  // Demo encapsulation
  const { sharedSecret, ciphertext, capsule } = kyberEncapsulate(kyber.publicKey);

  // Demo signature
  const message = 'QuantumVote Demo: vote integrity verified';
  const sig = dilithiumSign(message, dilithium.privateKey);

  res.json({
    kyber: {
      ...kyber,
      demo: { sharedSecret: sharedSecret.substring(0, 32) + '...', ciphertext: ciphertext.substring(0, 40) + '...', capsule },
    },
    dilithium: {
      ...dilithium,
      demo: {
        message,
        signature: sig.signature.substring(0, 40) + '...',
        signedAt: sig.signedAt,
        signatureSize: sig.signatureSize,
      },
    },
  });
});

module.exports = router;
