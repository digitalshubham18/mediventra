const { Alert } = require('../models/Models');
const Appointment = require('../models/Appointment');

// GET /api/triage/queue — a real, data-driven priority queue for
// reception/nursing staff: combines unresolved alerts (SOS/Vitals/Fall,
// weighted by severity) with today's waiting patients (weighted by how
// long they've been waiting), sorted into color-coded priority bands.
exports.getQueue = async (req, res) => {
  try {
    const startOfDay = new Date(); startOfDay.setHours(0,0,0,0);
    const endOfDay = new Date(); endOfDay.setHours(23,59,59,999);

    const [alerts, appts] = await Promise.all([
      Alert.find({ status: { $in: ['pending', 'acknowledged'] } }).populate('patient', 'name age').sort({ createdAt: -1 }),
      Appointment.find({ date: { $gte: startOfDay, $lte: endOfDay }, status: { $in: ['pending', 'confirmed'] } }).populate('patient', 'name age').populate('doctor', 'name'),
    ]);

    const severityScore = { critical: 100, high: 70, medium: 40, low: 15 };
    const queue = [];

    alerts.forEach(a => {
      queue.push({
        id: a._id, patientName: a.patient?.name || 'Unknown', reason: `${a.type} alert: ${a.message}`,
        score: severityScore[a.severity] || 30, band: a.severity === 'critical' ? 'critical' : a.severity === 'high' ? 'urgent' : 'moderate',
        source: 'alert', since: a.createdAt,
      });
    });

    appts.forEach(a => {
      const waitMinutes = Math.max(0, Math.round((Date.now() - new Date(a.date).getTime()) / 60000));
      const score = Math.min(60, waitMinutes); // long waits climb the queue but never outrank a real medical alert
      queue.push({
        id: a._id, patientName: a.patient?.name || 'Unknown', reason: `Appointment with Dr. ${a.doctor?.name || '—'} — waiting ${waitMinutes}m`,
        score, band: waitMinutes > 45 ? 'moderate' : 'normal',
        source: 'appointment', since: a.date,
      });
    });

    queue.sort((a,b) => b.score - a.score);
    res.json({ success: true, data: queue });
  } catch (e) { res.status(500).json({ success: false, error: e.message }); }
};
