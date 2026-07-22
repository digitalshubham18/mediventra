const Appointment = require('../models/Appointment');

// GET /api/staffing/forecast — projects expected patient volume for the
// next 7 days using each weekday's historical average over the last
// 8 weeks. This is a genuine trend-based forecast (simple moving
// average per weekday), not a black-box ML model — deliberately kept
// transparent about its method rather than dressed up as more than it is.
exports.getForecast = async (req, res) => {
  try {
    const eightWeeksAgo = new Date();
    eightWeeksAgo.setDate(eightWeeksAgo.getDate() - 56);

    const appts = await Appointment.find({ date: { $gte: eightWeeksAgo } }).select('date');

    // Bucket historical counts by weekday (0=Sun..6=Sat)
    const byWeekday = Array.from({ length: 7 }, () => ({ total: 0, days: new Set() }));
    appts.forEach(a => {
      const d = new Date(a.date);
      const wd = d.getDay();
      byWeekday[wd].total += 1;
      byWeekday[wd].days.add(d.toDateString());
    });

    const avgByWeekday = byWeekday.map(b => b.days.size ? Math.round((b.total / b.days.size) * 10) / 10 : 0);
    const overallAvg = avgByWeekday.reduce((s,v)=>s+v,0) / 7 || 0;

    // Next 7 days projection
    const forecast = [];
    for (let i = 0; i < 7; i++) {
      const day = new Date();
      day.setDate(day.getDate() + i);
      const wd = day.getDay();
      const projected = avgByWeekday[wd] || 0;
      forecast.push({
        date: day.toISOString().slice(0,10),
        weekday: ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'][wd],
        projectedPatients: projected,
        surgeRisk: projected > overallAvg * 1.25 ? 'high' : projected > overallAvg * 1.05 ? 'moderate' : 'normal',
      });
    }

    res.json({ success: true, data: forecast, method: 'Weekday historical average over the last 8 weeks' });
  } catch (e) { res.status(500).json({ success: false, error: e.message }); }
};
