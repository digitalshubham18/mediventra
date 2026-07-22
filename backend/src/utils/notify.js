const Notification = require('../models/Notification');

/**
 * Create a persistent notification for a user and push it live if they're
 * connected. Reuses the existing `user_${id}` socket room convention already
 * used across the codebase (ambulance dispatch, phone-change review, etc.)
 * so no new client-side subscription plumbing is needed beyond listening
 * for the 'notification' event.
 *
 * @param {import('express').Request} req - needed to reach req.app.get('io')
 * @param {string} userId
 * @param {{type:string, title:string, message?:string, link?:string, icon?:string, meta?:object}} payload
 */
async function notify(req, userId, payload) {
  if (!userId) return null;
  try {
    const doc = await Notification.create({ user: userId, ...payload });
    const io = req?.app?.get?.('io');
    if (io) io.to(`user_${userId}`).emit('notification', doc);
    return doc;
  } catch (e) {
    console.error('notify() failed:', e.message);
    return null;
  }
}

module.exports = { notify };
