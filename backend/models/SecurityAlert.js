const mongoose = require('mongoose');

const securityAlertSchema = new mongoose.Schema({
  type: {
    type: String,
    enum: [
      'DUPLICATE_VOTE_ATTEMPT',
      'BRUTE_FORCE_OTP',
      'INTEGRITY_FAILURE',
      'SUSPICIOUS_TIMING',
      'UNAUTHORIZED_ADMIN',
      'QUANTUM_ATTACK_SIMULATED',
      'TAMPER_DETECTED',
      'RATE_LIMIT_EXCEEDED',
    ],
  },
  severity: { type: String, enum: ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'], default: 'MEDIUM' },
  title: { type: String, required: true },
  description: { type: String },
  actorHash: { type: String },
  metadata: { type: Object },
  resolved: { type: Boolean, default: false },
  resolvedAt: { type: Date },
  timestamp: { type: Date, default: Date.now },
});

module.exports = mongoose.model('SecurityAlert', securityAlertSchema);
