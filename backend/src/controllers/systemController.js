const mongoose = require('mongoose');

// GET /api/system/health — genuine process/DB metrics, not hardcoded
// numbers. Kept intentionally simple (no OS-level CPU sampling libs) so it
// works the same in any Node environment without extra dependencies.
exports.getHealth = async (req, res) => {
  try {
    const mem = process.memoryUsage();
    const dbStateMap = { 0: 'disconnected', 1: 'connected', 2: 'connecting', 3: 'disconnecting' };
    const dbState = dbStateMap[mongoose.connection.readyState] || 'unknown';

    const io = req.app.get('io');
    const socketCount = io ? io.engine.clientsCount : null;

    res.json({
      success: true,
      data: {
        uptimeSeconds: Math.floor(process.uptime()),
        nodeVersion: process.version,
        memory: {
          rssMB: +(mem.rss / 1024 / 1024).toFixed(1),
          heapUsedMB: +(mem.heapUsed / 1024 / 1024).toFixed(1),
          heapTotalMB: +(mem.heapTotal / 1024 / 1024).toFixed(1),
        },
        database: { status: dbState, name: mongoose.connection.name || null },
        realtime: { connectedClients: socketCount },
        serverTime: new Date().toISOString(),
      },
    });
  } catch (e) { res.status(500).json({ success: false, error: e.message }); }
};
