const crypto = require('crypto');
const AuditLog = require('../models/AuditLog');
const SecurityAlert = require('../models/SecurityAlert');

/**
 * Log an audit event to the database
 */
async function logAudit({ event, eventType, severity = 'INFO', actorHash, targetId, metadata, ipHash }) {
  try {
    await AuditLog.create({ event, eventType, severity, actorHash, targetId, metadata, ipHash });
  } catch (err) {
    console.error('[AuditService] Failed to log audit event:', err.message);
  }
}

/**
 * Create a security alert
 */
async function createAlert({ type, severity, title, description, actorHash, metadata }) {
  try {
    const alert = await SecurityAlert.create({ type, severity, title, description, actorHash, metadata });
    return alert;
  } catch (err) {
    console.error('[AuditService] Failed to create security alert:', err.message);
  }
}

/**
 * Hash an IP address for anonymous storage
 */
function hashIp(ip) {
  return crypto.createHash('sha256').update(ip + process.env.IP_SALT || 'qv-salt').digest('hex').slice(0, 16);
}

/**
 * Anonymize voter ID for vote storage
 */
function anonymizeVoterId(voterId, electionId) {
  return crypto
    .createHash('sha3-256')
    .update(voterId + electionId + (process.env.ANON_SALT || 'qv-anon'))
    .digest('hex');
}

module.exports = { logAudit, createAlert, hashIp, anonymizeVoterId };
