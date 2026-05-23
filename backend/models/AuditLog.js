const mongoose = require('mongoose');

const auditLogSchema = new mongoose.Schema({
  event: { type: String, required: true },
  eventType: {
    type: String,
    enum: ['AUTH', 'VOTE', 'ADMIN', 'SECURITY', 'SYSTEM', 'INTEGRITY'],
    required: true,
  },
  severity: { type: String, enum: ['INFO', 'WARNING', 'CRITICAL'], default: 'INFO' },
  actorHash: { type: String }, // anonymized actor
  targetId: { type: String }, // what was acted upon
  metadata: { type: Object },
  ipHash: { type: String },
  timestamp: { type: Date, default: Date.now },
  resolved: { type: Boolean, default: false },
});

module.exports = mongoose.model('AuditLog', auditLogSchema);
