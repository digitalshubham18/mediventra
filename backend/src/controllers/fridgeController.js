const FridgeLog = require('../models/FridgeLog');

exports.getAll = async (req, res) => {
  try {
    const logs = await FridgeLog.find().sort({ createdAt: -1 }).limit(100).populate('loggedBy', 'name');
    // Latest reading per unit, for a quick-glance current-status view
    const latestByUnit = {};
    logs.forEach(l => { if (!latestByUnit[l.unitName]) latestByUnit[l.unitName] = l; });
    res.json({ success: true, data: logs, latestByUnit: Object.values(latestByUnit) });
  } catch (e) { res.status(500).json({ success: false, error: e.message }); }
};

exports.addReading = async (req, res) => {
  try {
    const { unitName, temperature, safeMin, safeMax } = req.body;
    if (!unitName || temperature === undefined) return res.status(400).json({ success: false, error: 'unitName and temperature are required' });
    const min = safeMin ?? 2, max = safeMax ?? 8;
    const isAlert = temperature < min || temperature > max;
    const log = await FridgeLog.create({ unitName, temperature, safeMin: min, safeMax: max, loggedBy: req.user.id, isAlert });

    if (isAlert) {
      const io = req.app.get('io');
      if (io) io.emit('fridge_temperature_alert', { unitName, temperature, safeMin: min, safeMax: max });
    }
    res.status(201).json({ success: true, data: log, alert: isAlert });
  } catch (e) { res.status(500).json({ success: false, error: e.message }); }
};
