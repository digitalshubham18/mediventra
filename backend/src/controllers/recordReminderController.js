// const { HealthRecord, Reminder } = require('../models/Models');
// const path = require('path');

// // ─── HEALTH RECORDS ──────────────────────────────────────────────────

// exports.getRecords = async (req, res) => {
//   try {
//     let query = {};
//     if (req.user.role === 'patient') query.patient = req.user.id;
//     if (req.query.patientId) query.patient = req.query.patientId;
//     if (req.query.type) query.type = req.query.type;

//     const records = await HealthRecord.find(query)
//       .populate('patient', 'name email bloodGroup age')
//       .populate('doctor', 'name specialization')
//       .sort({ createdAt: -1 });

//     res.json({ success: true, count: records.length, data: records });
//   } catch (err) {
//     res.status(500).json({ success: false, error: err.message });
//   }
// };

// exports.getRecord = async (req, res) => {
//   try {
//     const record = await HealthRecord.findById(req.params.id)
//       .populate('patient', 'name email')
//       .populate('doctor', 'name specialization');
//     if (!record) return res.status(404).json({ success: false, error: 'Record not found' });

//     if (req.user.role === 'patient' && record.patient._id.toString() !== req.user.id) {
//       return res.status(403).json({ success: false, error: 'Access denied' });
//     }

//     res.json({ success: true, data: record });
//   } catch (err) {
//     res.status(500).json({ success: false, error: err.message });
//   }
// };

// exports.createRecord = async (req, res) => {
//   try {
//     const recordData = { ...req.body, doctor: req.user.id };

//     if (req.file) {
//       recordData.fileUrl = `/uploads/records/${req.file.filename}`;
//       recordData.fileName = req.file.originalname;
//       recordData.fileSize = req.file.size;
//       recordData.mimeType = req.file.mimetype;
//     }

//     const record = await HealthRecord.create(recordData);
//     await record.populate('patient', 'name email');
//     await record.populate('doctor', 'name specialization');

//     res.status(201).json({ success: true, data: record });
//   } catch (err) {
//     res.status(500).json({ success: false, error: err.message });
//   }
// };

// exports.updateRecord = async (req, res) => {
//   try {
//     const record = await HealthRecord.findByIdAndUpdate(req.params.id, req.body, { new: true });
//     if (!record) return res.status(404).json({ success: false, error: 'Record not found' });
//     res.json({ success: true, data: record });
//   } catch (err) {
//     res.status(500).json({ success: false, error: err.message });
//   }
// };

// exports.deleteRecord = async (req, res) => {
//   try {
//     await HealthRecord.findByIdAndDelete(req.params.id);
//     res.json({ success: true, message: 'Record deleted' });
//   } catch (err) {
//     res.status(500).json({ success: false, error: err.message });
//   }
// };

// // ─── REMINDERS ───────────────────────────────────────────────────────

// exports.getReminders = async (req, res) => {
//   try {
//     let query = {};
//     if (req.user.role === 'patient') query.patient = req.user.id;
//     if (req.query.patientId) query.patient = req.query.patientId;
//     if (req.query.status) query.status = req.query.status;

//     const reminders = await Reminder.find(query)
//       .populate('patient', 'name email phone')
//       .populate('medicine', 'name category price')
//       .sort({ createdAt: -1 });

//     res.json({ success: true, count: reminders.length, data: reminders });
//   } catch (err) {
//     res.status(500).json({ success: false, error: err.message });
//   }
// };

// exports.createReminder = async (req, res) => {
//   try {
//     const reminder = await Reminder.create({
//       ...req.body,
//       prescribedBy: req.user.role !== 'patient' ? req.user.id : undefined
//     });
//     await reminder.populate('medicine', 'name category');
//     await reminder.populate('patient', 'name email');
//     res.status(201).json({ success: true, data: reminder });
//   } catch (err) {
//     res.status(500).json({ success: false, error: err.message });
//   }
// };

// exports.updateReminder = async (req, res) => {
//   try {
//     const reminder = await Reminder.findByIdAndUpdate(req.params.id, req.body, { new: true });
//     if (!reminder) return res.status(404).json({ success: false, error: 'Reminder not found' });
//     res.json({ success: true, data: reminder });
//   } catch (err) {
//     res.status(500).json({ success: false, error: err.message });
//   }
// };

// exports.logAdherence = async (req, res) => {
//   try {
//     const { taken, skippedReason } = req.body;
//     const reminder = await Reminder.findById(req.params.id);
//     if (!reminder) return res.status(404).json({ success: false, error: 'Reminder not found' });

//     reminder.adherenceLog.push({
//       date: new Date(),
//       taken,
//       takenAt: taken ? new Date() : undefined,
//       skippedReason: skippedReason || ''
//     });
//     await reminder.save();

//     res.json({ success: true, data: reminder });
//   } catch (err) {
//     res.status(500).json({ success: false, error: err.message });
//   }
// };

// exports.deleteReminder = async (req, res) => {
//   try {
//     await Reminder.findByIdAndDelete(req.params.id);
//     res.json({ success: true, message: 'Reminder deleted' });
//   } catch (err) {
//     res.status(500).json({ success: false, error: err.message });
//   }
// };


const { HealthRecord, Reminder } = require('../models/Models');
const path = require('path');

// ─── HEALTH RECORDS ──────────────────────────────────────────────────

exports.getRecords = async (req, res) => {
  try {
    let query = {};
    if (req.user.role === 'patient') query.patient = req.user.id;
    if (req.query.patientId) query.patient = req.query.patientId;
    if (req.query.type) query.type = req.query.type;

    const records = await HealthRecord.find(query)
      .populate('patient', 'name email bloodGroup age')
      .populate('doctor', 'name specialization')
      .sort({ createdAt: -1 });

    res.json({ success: true, count: records.length, data: records });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
};

exports.getRecord = async (req, res) => {
  try {
    const record = await HealthRecord.findById(req.params.id)
      .populate('patient', 'name email')
      .populate('doctor', 'name specialization');
    if (!record) return res.status(404).json({ success: false, error: 'Record not found' });

    if (req.user.role === 'patient' && record.patient._id.toString() !== req.user.id) {
      return res.status(403).json({ success: false, error: 'Access denied' });
    }

    res.json({ success: true, data: record });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
};

exports.createRecord = async (req, res) => {
  try {
    // Build record data — allow body.doctor override for admins, else use logged-in user
    const recordData = {
      ...req.body,
      doctor: req.body.doctor || req.user.id,
    };

    // Patient must be provided in body (or default to self for patients)
    if (!recordData.patient && req.user.role === 'patient') {
      recordData.patient = req.user.id;
    }

    if (!recordData.patient) {
      return res.status(400).json({ success: false, error: 'Patient is required' });
    }

    if (!recordData.title) {
      return res.status(400).json({ success: false, error: 'Title is required' });
    }

    if (req.file) {
      recordData.fileUrl = `/uploads/records/${req.file.filename}`;
      recordData.fileName = req.file.originalname;
      recordData.fileSize = req.file.size;
      recordData.mimeType = req.file.mimetype;
    }

    const record = await HealthRecord.create(recordData);
    await record.populate('patient', 'name email');
    await record.populate('doctor', 'name specialization');

    res.status(201).json({ success: true, data: record });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
};

exports.updateRecord = async (req, res) => {
  try {
    const record = await HealthRecord.findByIdAndUpdate(req.params.id, req.body, { new: true });
    if (!record) return res.status(404).json({ success: false, error: 'Record not found' });
    res.json({ success: true, data: record });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
};

exports.deleteRecord = async (req, res) => {
  try {
    await HealthRecord.findByIdAndDelete(req.params.id);
    res.json({ success: true, message: 'Record deleted' });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
};

// ─── REMINDERS ───────────────────────────────────────────────────────

exports.getReminders = async (req, res) => {
  try {
    let query = {};
    if (req.user.role === 'patient') query.patient = req.user.id;
    if (req.query.patientId) query.patient = req.query.patientId;
    if (req.query.status) query.status = req.query.status;

    const reminders = await Reminder.find(query)
      .populate('patient', 'name email phone')
      .populate('medicine', 'name category price')
      .sort({ createdAt: -1 });

    res.json({ success: true, count: reminders.length, data: reminders });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
};

exports.createReminder = async (req, res) => {
  try {
    const { patient, medicine, dose, startDate } = req.body;
    if (!patient) return res.status(400).json({ success: false, error: 'A patient must be selected for this reminder.' });
    if (!medicine) return res.status(400).json({ success: false, error: 'Please select a medicine — add one to inventory first if the list is empty.' });
    if (!dose) return res.status(400).json({ success: false, error: 'Dose is required.' });

    const reminder = await Reminder.create({
      ...req.body,
      startDate: startDate || new Date(),
      prescribedBy: req.user.role !== 'patient' ? req.user.id : undefined
    });
    await reminder.populate('medicine', 'name category');
    await reminder.populate('patient', 'name email');
    res.status(201).json({ success: true, data: reminder });
  } catch (err) {
    if (err.name === 'ValidationError' || err.name === 'CastError') {
      return res.status(400).json({ success: false, error: 'Please check the reminder details — ' + err.message });
    }
    res.status(500).json({ success: false, error: err.message });
  }
};

exports.updateReminder = async (req, res) => {
  try {
    const reminder = await Reminder.findByIdAndUpdate(req.params.id, req.body, { new: true });
    if (!reminder) return res.status(404).json({ success: false, error: 'Reminder not found' });
    res.json({ success: true, data: reminder });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
};

exports.logAdherence = async (req, res) => {
  try {
    const { taken, skippedReason } = req.body;
    const reminder = await Reminder.findById(req.params.id);
    if (!reminder) return res.status(404).json({ success: false, error: 'Reminder not found' });

    reminder.adherenceLog.push({
      date: new Date(),
      taken,
      takenAt: taken ? new Date() : undefined,
      skippedReason: skippedReason || ''
    });
    await reminder.save();

    res.json({ success: true, data: reminder });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
};

exports.deleteReminder = async (req, res) => {
  try {
    await Reminder.findByIdAndDelete(req.params.id);
    res.json({ success: true, message: 'Reminder deleted' });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
};
