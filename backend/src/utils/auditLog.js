const AuditLog = require('../models/AuditLog');

// Fire-and-forget by design: an audit log write failing should never
// break or delay the actual action (deleting a record, reassigning a
// room, etc.) that triggered it. Errors are swallowed after a console
// warning rather than propagated.
async function logAction({ actor, action, description, targetType, targetId, meta }) {
  try {
    await AuditLog.create({
      actor: actor?.id || actor?._id,
      actorName: actor?.name || 'Unknown',
      actorRole: actor?.role || '',
      action, description, targetType, targetId, meta,
    });
  } catch (e) {
    console.warn('Audit log write failed:', e.message);
  }
}

module.exports = { logAction };
