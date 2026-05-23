const mongoose = require('mongoose');

const voteSchema = new mongoose.Schema({
  receiptId: { type: String, unique: true, required: true },
  electionId: { type: mongoose.Schema.Types.ObjectId, ref: 'Election', required: true },
  candidateId: { type: mongoose.Schema.Types.ObjectId, ref: 'Candidate', required: true },
  // Anonymized voter link (hash of voterId, not the actual voter ID)
  voterAnonymousHash: { type: String, required: true },
  // PQC Encrypted ballot
  kyberCiphertext: { type: String, required: true },
  aesEncrypted: { type: String, required: true },
  iv: { type: String, required: true },
  authTag: { type: String, required: true },
  // Dilithium signature
  dilithiumSignature: { type: String },
  dilithiumPublicKey: { type: String },
  // Integrity
  integrityHash: { type: String, required: true },
  integrityValid: { type: Boolean, default: true },
  // Metadata
  encryptionMetadata: { type: Object },
  timestamp: { type: Date, default: Date.now },
  ipHash: { type: String }, // hashed IP for tamper detection
  verificationCount: { type: Number, default: 0 },
});

module.exports = mongoose.model('Vote', voteSchema);
