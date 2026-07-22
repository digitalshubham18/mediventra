const HealthRecord = require('../models/HealthRecord');
const User = require('../models/User');
const { notify } = require('../utils/notify');
const path = require('path');
const fs = require('fs');
const mongoose = require('mongoose');
const emailService = require('../utils/emailService');
const { buildFileUrl, cloudinaryEnabled } = require('../middleware/upload');
const { logAction } = require('../utils/auditLog');

const PHOTO_REQUIRED_TYPES = ['lab_report','xray','mri','ct_scan','ecg'];

// ── GET /api/records ──────────────────────────────────────────────────────
exports.getRecords = async (req, res) => {
  try {
    const q = {};
    if (req.user.role === 'patient') q.patient = req.user.id;
    if (req.query.patientId) q.patient = req.query.patientId;
    if (req.query.type) q.type = req.query.type;
    if (req.query.isAbnormal) q.isAbnormal = req.query.isAbnormal === 'true';

    const records = await HealthRecord.find(q)
      .populate('patient', 'name email bloodGroup age')
      .populate('doctor', 'name specialization')
      .sort({ createdAt: -1 });

    res.json({ success: true, count: records.length, data: records });
  } catch (e) { res.status(500).json({ success: false, error: e.message }); }
};

// ── GET /api/records/:id ──────────────────────────────────────────────────
exports.getRecord = async (req, res) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(400).json({ success: false, error: 'Invalid record reference — this report may not have finished syncing yet. Please refresh and try again.' });
    }
    const record = await HealthRecord.findById(req.params.id)
      .populate('patient', 'name email bloodGroup')
      .populate('doctor', 'name specialization');
    if (!record) return res.status(404).json({ success: false, error: 'Record not found' });
    if (req.user.role === 'patient' && record.patient._id.toString() !== req.user.id) {
      return res.status(403).json({ success: false, error: 'Access denied' });
    }
    res.json({ success: true, data: record });
  } catch (e) { res.status(500).json({ success: false, error: e.message }); }
};

// ── POST /api/records ─────────────────────────────────────────────────────
// Handles multipart form: 'file' (document) + 'labPhotos' (images, multiple)
exports.createRecord = async (req, res) => {
  try {
    const {
      title, type = 'lab_report', description, testName, testDate,
      labName, results, resultNotes, normalRange, isAbnormal, notes, patientId, patient: patientField, tags, vitals, status,
      // Lab order fields — previously accepted by the Order Lab Test form
      // and the Lab Dashboard's retry-sync, but silently dropped here
      // because they were never read off req.body. See HealthRecord.js.
      tests, urgency, clinicalNotes, collectionDate, doctor: doctorField, doctorName,
    } = req.body;

    // Three different upload forms across the app all send this as
    // `patient`, not `patientId` — accept either so none of them silently
    // fail with "Patient ID is required".
    let patient = patientId || patientField;

    if (!title) return res.status(400).json({ success: false, error: 'Title is required' });

    // Determine patient
    if (!patient && req.user.role === 'patient') patient = req.user.id;
    if (!patient) return res.status(400).json({ success: false, error: 'Patient ID is required' });

    // Build record data
    const recordData = {
      patient,
      doctor: doctorField || (req.user.role !== 'patient' ? req.user.id : undefined),
      title, type, description, testName,
      testDate: testDate ? new Date(testDate) : undefined,
      labName, results, resultNotes, normalRange,
      isAbnormal: isAbnormal === 'true' || isAbnormal === true,
      notes, tags: tags ? JSON.parse(tags) : [],
      vitals: vitals ? JSON.parse(vitals) : undefined,
      labPhotosRequired: PHOTO_REQUIRED_TYPES.includes(type),
      status: status || 'pending',
      // Lab order fields — now actually persisted (see note above) so a
      // lab technician opening this order on any device sees exactly
      // which tests were ordered, how urgent it is, and any clinical notes.
      tests: tests ? (typeof tests === 'string' ? JSON.parse(tests) : tests) : [],
      urgency: urgency || 'routine',
      clinicalNotes: clinicalNotes || '',
      collectionDate: collectionDate ? new Date(collectionDate) : undefined,
      doctorName: doctorName || (req.user.role !== 'patient' ? req.user.name : ''),
    };

    // Primary file (PDF / document)
    if (req.files && req.files.file && req.files.file[0]) {
      const f = req.files.file[0];
      recordData.fileUrl  = buildFileUrl(f, 'records');
      recordData.fileName = f.originalname;
      recordData.fileSize = f.size;
      recordData.mimeType = f.mimetype;
    }

    // Lab photos (mandatory for lab/imaging types) — but only once there's
    // an actual report to photograph. A brand-new test *order* (status
    // 'pending', no results yet) can't have a photo; that's only required
    // from this point forward, every time findings/results are recorded.
    //
    // Accepts either the dedicated 'labPhotos' field (Lab Dashboard) OR the
    // general 'file' field (the standard Records upload form only has one
    // generic file input) — either one satisfies the requirement.
    let labPhotos = [];
    const photoSourceFiles = [...(req.files?.labPhotos || []), ...(req.files?.file || [])];
    if (photoSourceFiles.length) {
      labPhotos = photoSourceFiles.map(f => ({
        url:       buildFileUrl(f, 'records'),
        filename:  f.originalname,
        size:      f.size,
        mimeType:  f.mimetype,
        uploadedAt: new Date(),
        uploadedBy: req.user.id, uploadedByName: req.user.name, uploadedByRole: req.user.role,
      }));
    }

    const isJustAnOrder = recordData.status === 'pending' && !results && !req.body.resultNotes;
    if (PHOTO_REQUIRED_TYPES.includes(type) && labPhotos.length === 0 && !isJustAnOrder) {
      return res.status(400).json({
        success: false,
        error: `At least one photo/image of the ${type.replace('_',' ')} test report is mandatory. Please upload a photo.`,
        requiresPhoto: true,
      });
    }

    recordData.labPhotos = labPhotos;
    if (labPhotos.length) {
      recordData.updateHistory = [{
        updatedBy: req.user.id, updatedByName: req.user.name, updatedByRole: req.user.role,
        status: recordData.status, notes: 'Report created', at: new Date(),
      }];
    }

    const record = await HealthRecord.create(recordData);
    await record.populate('patient', 'name email');
    await record.populate('doctor',  'name specialization');

    res.status(201).json({ success: true, data: record });
  } catch (e) { res.status(500).json({ success: false, error: e.message }); }
};

// ── PUT /api/records/:id ──────────────────────────────────────────────────
exports.updateRecord = async (req, res) => {
  try {
    // A non-ObjectId id (e.g. a client-side temp id like "1779208126489"
    // that never finished syncing to the server) must never reach
    // findByIdAndUpdate — Mongoose would throw an uncaught CastError. Catch
    // it here with a clear, actionable message instead.
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(400).json({
        success: false,
        error: 'This report hasn\u2019t finished saving to the server yet (it still has a temporary local ID). Please refresh the page and try again — if it keeps happening, re-create the lab order.',
        notSynced: true,
      });
    }

    const before = await HealthRecord.findById(req.params.id);
    if (!before) return res.status(404).json({ success: false, error: 'Record not found' });

    const type = req.body.type || before.type;

    // ── Report photo requirement ─────────────────────────────────────────
    // A fresh photo of the physical report is required whenever findings
    // are actually being recorded (completing, marking abnormal, editing
    // result notes/values) — but NOT for the very first step of simply
    // starting processing (pending → processing), since there's no report
    // to photograph yet at that point. Real lab workflow: claim the
    // order → do the test → THEN the photo of the printed/physical
    // report becomes mandatory when results are entered.
    const isContentUpdate = ['status','resultNotes','results','notes','isAbnormal'].some(k => req.body[k] !== undefined);
    const isJustStartingProcessing = req.body.status === 'processing' && !req.body.resultNotes && !req.body.results;
    const isRejection = req.body.status === 'rejected';
    const newPhotoFiles = [...(req.files?.labPhotos || []), ...(req.files?.file || [])];
    if (isContentUpdate && !isJustStartingProcessing && !isRejection && PHOTO_REQUIRED_TYPES.includes(type) && newPhotoFiles.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'Please attach a photo of the report before saving this update — a fresh image is required whenever results are recorded.',
        requiresPhoto: true,
      });
    }

    const updates = { ...req.body };
    delete updates.labPhotos; // never set directly from body; built from req.files below
    delete updates.updateHistory; // server-controlled audit trail, never client-settable
    if (updates.tags && typeof updates.tags === 'string') { try { updates.tags = JSON.parse(updates.tags); } catch {} }
    if (updates.vitals && typeof updates.vitals === 'string') { try { updates.vitals = JSON.parse(updates.vitals); } catch {} }
    if (updates.tests && typeof updates.tests === 'string') { try { updates.tests = JSON.parse(updates.tests); } catch { delete updates.tests; } }
    if (updates.collectionDate) updates.collectionDate = new Date(updates.collectionDate);

    // ── Claim / assignment ──────────────────────────────────────────────
    // The lab technician who starts processing an unclaimed order
    // automatically becomes the one handling it — mirrors a real lab
    // queue where picking up a sample assigns it to you, so two
    // technicians don't duplicate the same test.
    if (req.body.status === 'processing' && !before.assignedLabTech && req.user.role === 'lab_technician') {
      updates.assignedLabTech = req.user.id;
      updates.assignedLabTechName = req.user.name;
    }

    // Append new photos to the existing history — keeps every version of
    // the uploaded report image instead of discarding earlier ones. Each
    // photo is attributed to whoever uploaded it, right now.
    if (newPhotoFiles.length) {
      const appended = newPhotoFiles.map(f => ({
        url: buildFileUrl(f, 'records'), filename: f.originalname,
        size: f.size, mimeType: f.mimetype, uploadedAt: new Date(),
        uploadedBy: req.user.id, uploadedByName: req.user.name, uploadedByRole: req.user.role,
      }));
      updates.labPhotos = [...(before.labPhotos || []), ...appended];
    }
    if (req.files?.file?.[0] && !req.files?.labPhotos?.length) {
      const f = req.files.file[0];
      updates.fileUrl = buildFileUrl(f, 'records');
      updates.fileName = f.originalname;
      updates.fileSize = f.size;
      updates.mimeType = f.mimetype;
    }

    // Audit trail entry — who updated this report and when, every time,
    // regardless of whether a photo was attached this round.
    updates.updateHistory = [
      ...(before.updateHistory || []),
      {
        updatedBy: req.user.id, updatedByName: req.user.name, updatedByRole: req.user.role,
        status: req.body.status || before.status, notes: req.body.resultNotes || req.body.notes || '',
        at: new Date(),
      },
    ];

    const record = await HealthRecord.findByIdAndUpdate(req.params.id, updates, { new: true })
      .populate('patient', 'name email notificationPrefs')
      .populate('doctor', 'name email');
    if (!record) return res.status(404).json({ success: false, error: 'Record not found' });

    // ── Lab just finished testing this report — push the update out so the
    // patient's records page and the doctor's dashboard refresh instantly,
    // instead of only being visible next time someone reopens the lab tab.
    const justFinished = ['completed', 'abnormal'].includes(record.status) && before.status !== record.status;
    if (justFinished) {
      const io = req.app.get('io');
      const payload = {
        recordId: record._id, title: record.title, testName: record.testName,
        status: record.status, isAbnormal: record.status === 'abnormal',
        patientName: record.patient?.name, doctorName: record.doctor?.name,
      };
      if (io) {
        if (record.patient?._id) io.to(`user_${record.patient._id}`).emit('lab_report_ready', payload);
        if (record.doctor?._id)  io.to(`user_${record.doctor._id}`).emit('lab_report_ready', payload);
        io.emit('lab_dashboard_update', payload); // refreshes any open lab dashboards too

        const abnormalTag = payload.isAbnormal ? '⚠️ ' : '';
        if (record.patient?._id) notify(req, record.patient._id, { type:'lab_report_ready', title:`${abnormalTag}Lab report ready`, message:`Your ${record.testName || record.title} report is ready to view`, link:'/records', icon: payload.isAbnormal?'⚠️':'🔬' });
        if (record.doctor?._id) notify(req, record.doctor._id, { type:'lab_report_ready', title:`${abnormalTag}Lab report ready for review`, message:`${record.patient?.name}'s ${record.testName || record.title} report is ready`, link:'/records', icon: payload.isAbnormal?'⚠️':'🔬' });

        // Admin must also be able to see every completed report as it
        // comes in — notify every admin's personal room, same as the
        // patient/doctor above.
        User.find({ role: 'admin' }).select('_id').then(admins => {
          admins.forEach(a => io.to(`user_${a._id}`).emit('lab_report_ready', payload));
        }).catch(() => {});
      }

      if (record.patient?.email && (record.status === 'abnormal' || emailService.shouldEmail(record.patient, 'emailNotifs'))) {
        const abnormal = record.status === 'abnormal';
        const html = `<!DOCTYPE html><html><body style="margin:0;padding:0;background:#f0f4f8;font-family:'Segoe UI',sans-serif">
<table width="100%" cellpadding="0" cellspacing="0" style="padding:40px 20px"><tr><td align="center">
<table width="540" cellpadding="0" cellspacing="0" style="background:#fff;border-radius:20px;overflow:hidden;box-shadow:0 8px 32px rgba(0,0,0,.12)">
<tr><td style="background:${abnormal?'linear-gradient(135deg,#dc2626,#f87171)':'linear-gradient(135deg,#059669,#34d399)'};padding:30px;text-align:center">
  <div style="font-size:40px;margin-bottom:8px">${abnormal?'⚠️':'🧪'}</div>
  <h1 style="color:#fff;font-size:21px;font-weight:800;margin:0">Your Lab Report Is Ready</h1>
</td></tr>
<tr><td style="padding:32px">
  <p style="color:#64748b;font-size:14px;line-height:1.7;margin:0 0 16px">Hi ${record.patient.name}, the results for <strong>${record.testName || record.title}</strong> are ready and have been added to your health records.</p>
  ${abnormal ? `<div style="background:#fef2f2;border:1.5px solid #fecaca;border-radius:12px;padding:14px 18px;margin-bottom:16px"><p style="margin:0;color:#b91c1c;font-size:13px;font-weight:600">⚠️ Some values are outside the normal range. Please consult your doctor to review these results.</p></div>` : ''}
  <p style="color:#64748b;font-size:13.5px;margin:0">Log in to Mediventra and open <strong>Health Records</strong> to view the full report.</p>
</td></tr>
<tr><td style="background:#f8fafc;border-top:1px solid #e8edf3;padding:18px;text-align:center">
  <p style="color:#94a3b8;font-size:12px;margin:0">Mediventra · Secure Healthcare Platform</p>
</td></tr>
</table></td></tr></table></body></html>`;
        emailService.sendGeneral({ to: record.patient.email, subject: `${abnormal?'⚠️':'🧪'} Lab Report Ready — ${record.testName || record.title} | Mediventra`, html }).catch(console.error);
      }
    }

    // ── Sample rejected — the ordering doctor and patient both need to
    // know a redraw is required, distinct from a completed/abnormal result.
    const justRejected = record.status === 'rejected' && before.status !== 'rejected';
    if (justRejected) {
      const io2 = req.app.get('io');
      if (io2) io2.emit('lab_dashboard_update', { recordId: record._id, status: 'rejected' });
      if (record.patient?._id) notify(req, record.patient._id, { type:'sample_rejected', title:'⚠️ Sample rejected — redraw needed', message:`${record.testName || record.title}: ${record.rejectionReason || 'the lab could not process this sample'}`, link:'/records', icon:'⚠️' });
      if (record.doctor?._id) notify(req, record.doctor._id, { type:'sample_rejected', title:'⚠️ Lab sample rejected', message:`${record.patient?.name}'s ${record.testName || record.title} sample was rejected: ${record.rejectionReason || 'no reason given'}`, link:'/records', icon:'⚠️' });
    }

    res.json({ success: true, data: record });
  } catch (e) { res.status(500).json({ success: false, error: e.message }); }
};

// ── DELETE /api/records/:id ───────────────────────────────────────────────
exports.deleteRecord = async (req, res) => {
  try {
    const record = await HealthRecord.findById(req.params.id).populate('patient', 'name');
    if (!record) return res.status(404).json({ success: false, error: 'Record not found' });
    // Delete physical files
    const filesToDelete = [];
    if (record.fileUrl) filesToDelete.push(record.fileUrl);
    record.labPhotos?.forEach(p => filesToDelete.push(p.url));
    filesToDelete.forEach(url => {
      if (/^https?:\/\//i.test(url)) {
        // Cloudinary (or any absolute) URL — best-effort remote cleanup so
        // deleted reports don't leave orphaned files sitting in storage.
        if (cloudinaryEnabled) {
          try {
            const cloudinary = require('cloudinary').v2;
            const publicId = url.split('/upload/')[1]?.replace(/^v\d+\//, '').replace(/\.[^./]+$/, '');
            if (publicId) cloudinary.uploader.destroy(publicId, { resource_type: 'auto' }).catch(() => {});
          } catch {}
        }
        return;
      }
      const fp = path.join(__dirname, '../../', url);
      if (fs.existsSync(fp)) fs.unlinkSync(fp);
    });
    await record.deleteOne();
    logAction({
      actor: req.user, action: 'record_deleted',
      description: `Deleted ${record.type?.replace('_',' ') || 'record'} "${record.title}" for ${record.patient?.name || 'unknown patient'}`,
      targetType: 'HealthRecord', targetId: record._id,
    });
    res.json({ success: true, message: 'Record deleted' });
  } catch (e) { res.status(500).json({ success: false, error: e.message }); }
};
