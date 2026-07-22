const cron = require('node-cron');
const { Reminder } = require('../models/Models');

module.exports = (io) => {
  // Every minute – check due medication reminders
  cron.schedule('* * * * *', async () => {
    try {
      const now = new Date();
      const hhmm = `${String(now.getHours()).padStart(2,'0')}:${String(now.getMinutes()).padStart(2,'0')}`;

      const dueReminders = await Reminder.find({ status: 'active', notificationsEnabled: true })
        .populate('patient', 'name email _id')
        .populate('medicine', 'name');

      for (const reminder of dueReminders) {
        const isTimeMatch = reminder.times.some(t => {
          const [h, m] = t.split(':');
          return `${h.padStart(2,'0')}:${m.padStart(2,'0')}` === hhmm;
        });

        if (isTimeMatch) {
          if (io) {
            io.emit('medication_reminder', {
              reminderId: reminder._id,
              patientId: reminder.patient._id,
              patientName: reminder.patient.name,
              medicine: reminder.medicine?.name || reminder.medicineName,
              dose: reminder.dose,
              time: hhmm
            });
          }
          console.log(`⏰ Reminder fired: ${reminder.patient.name} – ${reminder.medicineName}`);
        }
      }
    } catch (err) {
      console.error('Cron reminder error:', err.message);
    }
  });

  // Every hour – check for overdue appointments and send reminders
  cron.schedule('0 * * * *', async () => {
    try {
      const Appointment = require('../models/Appointment');
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      tomorrow.setHours(0, 0, 0, 0);
      const dayAfter = new Date(tomorrow);
      dayAfter.setDate(dayAfter.getDate() + 1);

      const upcoming = await Appointment.find({
        date: { $gte: tomorrow, $lt: dayAfter },
        status: 'confirmed',
        reminderSent: false
      }).populate('patient', 'name email _id').populate('doctor', 'name');

      for (const appt of upcoming) {
        if (io) {
          io.emit('appointment_reminder', {
            appointmentId: appt._id,
            patientId: appt.patient._id,
            patientName: appt.patient.name,
            doctorName: appt.doctor.name,
            date: appt.date,
            timeSlot: appt.timeSlot
          });
        }
        appt.reminderSent = true;
        await appt.save();
        console.log(`📅 Appt reminder sent: ${appt.patient.name}`);
      }
    } catch (err) {
      console.error('Cron appointment reminder error:', err.message);
    }
  });

  // Daily at midnight – check low stock
  cron.schedule('0 0 * * *', async () => {
    try {
      const Medicine = require('../models/Medicine');
      const lowStock = await Medicine.find({ $expr: { $lte: ['$stock', '$minStock'] }, isActive: true });
      if (lowStock.length > 0 && io) {
        io.emit('low_stock_alert', {
          count: lowStock.length,
          items: lowStock.map(m => ({ id: m._id, name: m.name, stock: m.stock, minStock: m.minStock }))
        });
        console.log(`⚠️ Low stock alert: ${lowStock.length} items`);
      }
    } catch (err) {
      console.error('Cron low stock error:', err.message);
    }
  });

  console.log('✅ Cron jobs initialized');
};