const WearableEntry = require('../models/WearableEntry');
const User = require('../models/User');
const Appointment = require('../models/Appointment');
const { checkAbnormalVitals } = require('../utils/vitalsCheck');
const { notify } = require('../utils/notify');

// If a reading comes back flagged, let the last doctor who actually saw
// this patient know — a real hospital wants a clinician to see this, not
// just leave it sitting in the patient's own history.
async function notifyDoctorOfFlag(req, patient, entry, reasons) {
  try {
    const lastAppt = await Appointment.findOne({
      patient: patient._id, status: { $in: ['completed', 'confirmed'] },
    }).sort({ date: -1 });
    if (!lastAppt) return;
    const io = req.app.get('io');
    if (io) {
      io.to(`user_${lastAppt.doctor}`).emit('patient_vitals_alert', {
        patientId: patient._id, patientName: patient.name,
        entryId: entry._id, date: entry.date, reasons,
      });
    }
    await notify(req, lastAppt.doctor, { type:'vitals_alert', title:'⚠️ Abnormal vitals reading', message:`${patient.name}: ${reasons[0]}`, link:'/dashboard', icon:'⚠️' });
  } catch { /* best-effort notification, never block the save */ }
}

// GET /api/wearable/patient/:patientId — nurse/doctor: recent vitals for a specific patient
exports.getForPatient = async (req, res) => {
  try {
    const entries = await WearableEntry.find({ patient: req.params.patientId }).sort({ date: -1 }).limit(20);
    res.json({ success: true, data: entries });
  } catch (e) { res.status(500).json({ success: false, error: e.message }); }
};

// POST /api/wearable/patient/:patientId — nurse/doctor: record bedside vitals
// (temperature, BP, pulse, SpO2, respiratory rate, blood glucose) for a
// ward/admitted patient. Mirrors the patient's own manual entry, but
// tagged with who actually took the reading.
exports.recordForPatient = async (req, res) => {
  try {
    const patient = await User.findOne({ _id: req.params.patientId, role: 'patient' });
    if (!patient) return res.status(404).json({ success: false, error: 'Patient not found' });

    const { heartRate, spo2, bpSystolic, bpDiastolic, bloodGlucose, temperature, respiratoryRate, weight } = req.body;
    const vitals = {
      heartRate: heartRate === '' || heartRate == null ? undefined : Number(heartRate),
      spo2: spo2 === '' || spo2 == null ? undefined : Number(spo2),
      bpSystolic: bpSystolic === '' || bpSystolic == null ? undefined : Number(bpSystolic),
      bpDiastolic: bpDiastolic === '' || bpDiastolic == null ? undefined : Number(bpDiastolic),
      bloodGlucose: bloodGlucose === '' || bloodGlucose == null ? undefined : Number(bloodGlucose),
      temperature: temperature === '' || temperature == null ? undefined : Number(temperature),
      respiratoryRate: respiratoryRate === '' || respiratoryRate == null ? undefined : Number(respiratoryRate),
      weight: weight === '' || weight == null ? undefined : Number(weight),
    };
    if (Object.values(vitals).every(v => v === undefined)) {
      return res.status(400).json({ success: false, error: 'Enter at least one vital reading' });
    }

    const reasons = checkAbnormalVitals(vitals);
    const entry = await WearableEntry.create({
      patient: patient._id, date: new Date(),
      ...vitals, source: 'nurse', recordedBy: req.user.id,
      flagged: reasons.length > 0, flagReasons: reasons,
    });

    if (reasons.length > 0) await notifyDoctorOfFlag(req, patient, entry, reasons);

    res.status(201).json({ success: true, data: entry, flagged: reasons.length > 0, reasons });
  } catch (e) { res.status(500).json({ success: false, error: e.message }); }
};
exports.getMine = async (req, res) => {
  try {
    const entries = await WearableEntry.find({ patient: req.user.id }).sort({ date: -1 }).limit(60);
    res.json({ success: true, data: entries });
  } catch (e) { res.status(500).json({ success: false, error: e.message }); }
};

// POST /api/wearable — manual daily entry
exports.addEntry = async (req, res) => {
  try {
    const { date, steps, heartRate, sleepHours, caloriesBurned, weight, spo2, bpSystolic, bpDiastolic, bloodGlucose } = req.body;
    const vitals = {
      steps: steps === '' || steps == null ? undefined : Number(steps),
      heartRate: heartRate === '' || heartRate == null ? undefined : Number(heartRate),
      sleepHours: sleepHours === '' || sleepHours == null ? undefined : Number(sleepHours),
      caloriesBurned: caloriesBurned === '' || caloriesBurned == null ? undefined : Number(caloriesBurned),
      weight: weight === '' || weight == null ? undefined : Number(weight),
      spo2: spo2 === '' || spo2 == null ? undefined : Number(spo2),
      bpSystolic: bpSystolic === '' || bpSystolic == null ? undefined : Number(bpSystolic),
      bpDiastolic: bpDiastolic === '' || bpDiastolic == null ? undefined : Number(bpDiastolic),
      bloodGlucose: bloodGlucose === '' || bloodGlucose == null ? undefined : Number(bloodGlucose),
    };

    const reasons = checkAbnormalVitals(vitals);
    const entry = await WearableEntry.create({
      patient: req.user.id, date: date ? new Date(date) : new Date(),
      ...vitals, source: 'manual',
      flagged: reasons.length > 0, flagReasons: reasons,
    });

    if (reasons.length > 0) await notifyDoctorOfFlag(req, req.user, entry, reasons);

    res.status(201).json({ success: true, data: entry });
  } catch (e) { res.status(500).json({ success: false, error: e.message }); }
};

// POST /api/wearable/import — bulk-import a CSV exported from any
// wearable/health app (Fitbit, Google Fit, Samsung Health, Apple Health's
// CSV export tools, etc). No OAuth or developer account needed on our
// side — the patient just exports their own data and uploads the file.
// Expected header row (any subset, any order, case-insensitive):
//   date, steps, heartRate, sleepHours, caloriesBurned, weight, spo2,
//   bpSystolic, bpDiastolic, bloodGlucose
exports.importCsv = async (req, res) => {
  try {
    const { csv } = req.body;
    if (!csv || typeof csv !== 'string') return res.status(400).json({ success: false, error: 'No CSV data received' });

    const lines = csv.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
    if (lines.length < 2) return res.status(400).json({ success: false, error: 'CSV needs a header row plus at least one data row' });

    const header = lines[0].split(',').map(h => h.trim().toLowerCase());
    const colIndex = (names) => names.map(n => header.indexOf(n)).find(i => i !== -1);
    const idx = {
      date: colIndex(['date']),
      steps: colIndex(['steps']),
      heartRate: colIndex(['heartrate', 'heart_rate', 'restingheartrate']),
      sleepHours: colIndex(['sleephours', 'sleep_hours', 'sleep']),
      caloriesBurned: colIndex(['caloriesburned', 'calories', 'calories_burned']),
      weight: colIndex(['weight', 'weightkg']),
      spo2: colIndex(['spo2', 'oxygensaturation', 'oxygen_saturation']),
      bpSystolic: colIndex(['bpsystolic', 'systolic']),
      bpDiastolic: colIndex(['bpdiastolic', 'diastolic']),
      bloodGlucose: colIndex(['bloodglucose', 'glucose', 'blood_glucose']),
    };
    if (idx.date === undefined) {
      return res.status(400).json({ success: false, error: 'CSV must include a "date" column' });
    }

    const toNum = (row, i) => (i === undefined || row[i] === undefined || row[i] === '') ? undefined : Number(row[i]);
    let imported = 0, flaggedCount = 0, skipped = 0;

    for (const line of lines.slice(1)) {
      const row = line.split(',').map(c => c.trim());
      const dateVal = new Date(row[idx.date]);
      if (isNaN(dateVal.getTime())) { skipped++; continue; }

      const vitals = {
        steps: toNum(row, idx.steps), heartRate: toNum(row, idx.heartRate),
        sleepHours: toNum(row, idx.sleepHours), caloriesBurned: toNum(row, idx.caloriesBurned),
        weight: toNum(row, idx.weight), spo2: toNum(row, idx.spo2),
        bpSystolic: toNum(row, idx.bpSystolic), bpDiastolic: toNum(row, idx.bpDiastolic),
        bloodGlucose: toNum(row, idx.bloodGlucose),
      };
      const reasons = checkAbnormalVitals(vitals);
      if (reasons.length) flaggedCount++;

      await WearableEntry.create({
        patient: req.user.id, date: dateVal, ...vitals, source: 'import',
        flagged: reasons.length > 0, flagReasons: reasons,
      });
      imported++;
    }

    res.status(201).json({
      success: true,
      message: `Imported ${imported} entr${imported===1?'y':'ies'}${skipped ? `, skipped ${skipped} row(s) with an invalid date` : ''}.`,
      imported, skipped, flagged: flaggedCount,
    });
  } catch (e) { res.status(500).json({ success: false, error: e.message }); }
};

// ── Fitbit OAuth2 — the one real wearable integration available ──────
// Requires a free Fitbit developer app (https://dev.fitbit.com) with
// FITBIT_CLIENT_ID / FITBIT_CLIENT_SECRET / FITBIT_REDIRECT_URI set in
// .env. Without those, this tells the user clearly what's needed
// instead of pretending to connect.
exports.getFitbitAuthUrl = async (req, res) => {
  // .trim() matters here: a stray trailing space or \r character copied
  // into .env (very easy to pick up when editing on Windows, or pasting
  // from some sources) silently corrupts the client_id — Fitbit then
  // rejects it with exactly "unauthorized_client - Invalid client_id",
  // which looks like a wrong ID even when the visible characters are
  // correct. Trimming removes that whole class of bug.
  const FITBIT_CLIENT_ID = (process.env.FITBIT_CLIENT_ID || '').trim();
  const FITBIT_REDIRECT_URI = (process.env.FITBIT_REDIRECT_URI || '').trim();
  if (!FITBIT_CLIENT_ID || !FITBIT_REDIRECT_URI) {
    return res.status(400).json({
      success: false,
      error: 'Fitbit sync isn\u2019t configured yet. The hospital admin needs to register a free app at dev.fitbit.com and set FITBIT_CLIENT_ID / FITBIT_CLIENT_SECRET / FITBIT_REDIRECT_URI in the backend .env.',
    });
  }
  // Basic sanity check: Fitbit client IDs are short alphanumeric strings
  // (e.g. "23QXWJ") — if whitespace or quotes leaked in from .env, catch
  // it here with a clear message instead of sending a doomed request to
  // Fitbit and getting their generic "unauthorized_client" error back.
  if (/\s/.test(process.env.FITBIT_CLIENT_ID || '') || /['"]/.test(FITBIT_CLIENT_ID)) {
    return res.status(400).json({
      success: false,
      error: 'FITBIT_CLIENT_ID in .env looks malformed (contains whitespace or quotes). Copy just the Client ID value from dev.fitbit.com with no surrounding spaces or quote marks.',
    });
  }
  const scope = 'activity heartrate sleep';
  const url = `https://www.fitbit.com/oauth2/authorize?response_type=code&client_id=${encodeURIComponent(FITBIT_CLIENT_ID)}&redirect_uri=${encodeURIComponent(FITBIT_REDIRECT_URI)}&scope=${encodeURIComponent(scope)}&state=${req.user.id}`;
  res.json({ success: true, url });
};

// GET /api/wearable/fitbit/callback?code=...&state=<userId>
exports.fitbitCallback = async (req, res) => {
  try {
    const { code, state } = req.query;
    const FITBIT_CLIENT_ID = (process.env.FITBIT_CLIENT_ID || '').trim();
    const FITBIT_CLIENT_SECRET = (process.env.FITBIT_CLIENT_SECRET || '').trim();
    const FITBIT_REDIRECT_URI = (process.env.FITBIT_REDIRECT_URI || '').trim();
    if (!code || !state) return res.status(400).send('Missing code/state from Fitbit');

    const basicAuth = Buffer.from(`${FITBIT_CLIENT_ID}:${FITBIT_CLIENT_SECRET}`).toString('base64');
    const tokenRes = await fetch('https://api.fitbit.com/oauth2/token', {
      method: 'POST',
      headers: { 'Authorization': `Basic ${basicAuth}`, 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ grant_type: 'authorization_code', code, redirect_uri: FITBIT_REDIRECT_URI }),
    });
    const tokenData = await tokenRes.json();
    if (!tokenData.access_token) return res.status(400).send('Fitbit authorization failed');

    await User.findByIdAndUpdate(state, {
      fitbitAccessToken: tokenData.access_token,
      fitbitRefreshToken: tokenData.refresh_token,
      fitbitConnectedAt: new Date(),
    });

    res.redirect(`${process.env.CLIENT_URL || 'http://localhost:3000'}/dashboard?fitbit=connected`);
  } catch (e) {
    res.redirect(`${process.env.CLIENT_URL || 'http://localhost:3000'}/dashboard?fitbit=error`);
  }
};

// POST /api/wearable/fitbit/sync — pull today's activity summary
exports.syncFitbit = async (req, res) => {
  try {
    const user = await User.findById(req.user.id).select('+fitbitAccessToken');
    if (!user?.fitbitAccessToken) return res.status(400).json({ success: false, error: 'Fitbit not connected yet' });

    const today = new Date().toISOString().slice(0, 10);
    const resp = await fetch(`https://api.fitbit.com/1/user/-/activities/date/${today}.json`, {
      headers: { Authorization: `Bearer ${user.fitbitAccessToken}` },
    });
    const data = await resp.json();
    if (!resp.ok) return res.status(400).json({ success: false, error: 'Fitbit sync failed — token may have expired, try reconnecting.' });

    const vitals = { steps: data.summary?.steps, caloriesBurned: data.summary?.caloriesOut };
    const reasons = checkAbnormalVitals(vitals);
    const entry = await WearableEntry.create({
      patient: req.user.id, date: new Date(), source: 'fitbit',
      ...vitals, flagged: reasons.length > 0, flagReasons: reasons,
    });
    if (reasons.length > 0) await notifyDoctorOfFlag(req, req.user, entry, reasons);
    res.json({ success: true, data: entry });
  } catch (e) { res.status(500).json({ success: false, error: e.message }); }
};

// ── Google Fit OAuth2 — a second real wearable integration, alongside
// Fitbit ──────────────────────────────────────────────────────────────
// Covers a different (and often larger) set of devices: Android phones'
// built-in step/activity tracking, Wear OS watches, and most Android
// fitness/health apps (including Samsung Health, which syncs into
// Google Fit) all report here. Requires a free Google Cloud project with
// the Fitness API enabled (console.cloud.google.com) and
// GOOGLE_FIT_CLIENT_ID / GOOGLE_FIT_CLIENT_SECRET / GOOGLE_FIT_REDIRECT_URI
// set in .env — same idea as Fitbit's setup, just a different provider.
exports.getGoogleFitAuthUrl = async (req, res) => {
  const CLIENT_ID = (process.env.GOOGLE_FIT_CLIENT_ID || '').trim();
  const REDIRECT_URI = (process.env.GOOGLE_FIT_REDIRECT_URI || '').trim();
  if (!CLIENT_ID || !REDIRECT_URI) {
    return res.status(400).json({
      success: false,
      error: 'Google Fit sync isn\u2019t configured yet. The hospital admin needs to create a free OAuth app at console.cloud.google.com (enable the "Fitness API") and set GOOGLE_FIT_CLIENT_ID / GOOGLE_FIT_CLIENT_SECRET / GOOGLE_FIT_REDIRECT_URI in the backend .env.',
    });
  }
  const scope = [
    'https://www.googleapis.com/auth/fitness.activity.read',
    'https://www.googleapis.com/auth/fitness.heart_rate.read',
    'https://www.googleapis.com/auth/fitness.sleep.read',
    'https://www.googleapis.com/auth/fitness.body.read',
  ].join(' ');
  const url = `https://accounts.google.com/o/oauth2/v2/auth?` +
    `client_id=${encodeURIComponent(CLIENT_ID)}&redirect_uri=${encodeURIComponent(REDIRECT_URI)}` +
    `&response_type=code&access_type=offline&prompt=consent` +
    `&scope=${encodeURIComponent(scope)}&state=${req.user.id}`;
  res.json({ success: true, url });
};

// GET /api/wearable/google-fit/callback?code=...&state=<userId>
exports.googleFitCallback = async (req, res) => {
  try {
    const { code, state } = req.query;
    const CLIENT_ID = (process.env.GOOGLE_FIT_CLIENT_ID || '').trim();
    const CLIENT_SECRET = (process.env.GOOGLE_FIT_CLIENT_SECRET || '').trim();
    const REDIRECT_URI = (process.env.GOOGLE_FIT_REDIRECT_URI || '').trim();
    if (!code || !state) return res.status(400).send('Missing code/state from Google');

    const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        code, client_id: CLIENT_ID, client_secret: CLIENT_SECRET,
        redirect_uri: REDIRECT_URI, grant_type: 'authorization_code',
      }),
    });
    const tokenData = await tokenRes.json();
    if (!tokenData.access_token) return res.status(400).send('Google Fit authorization failed');

    await User.findByIdAndUpdate(state, {
      googleFitAccessToken: tokenData.access_token,
      googleFitRefreshToken: tokenData.refresh_token,
      googleFitConnectedAt: new Date(),
    });

    res.redirect(`${process.env.CLIENT_URL || 'http://localhost:3000'}/dashboard?googlefit=connected`);
  } catch (e) {
    res.redirect(`${process.env.CLIENT_URL || 'http://localhost:3000'}/dashboard?googlefit=error`);
  }
};

// POST /api/wearable/google-fit/sync — pull today's steps/heart-rate
// summary from the Fitness API's aggregate endpoint.
exports.syncGoogleFit = async (req, res) => {
  try {
    const user = await User.findById(req.user.id).select('+googleFitAccessToken');
    if (!user?.googleFitAccessToken) return res.status(400).json({ success: false, error: 'Google Fit not connected yet' });

    const now = Date.now();
    const startOfDay = new Date(); startOfDay.setHours(0,0,0,0);
    const body = {
      aggregateBy: [
        { dataTypeName: 'com.google.step_count.delta' },
        { dataTypeName: 'com.google.heart_rate.bpm' },
      ],
      bucketByTime: { durationMillis: now - startOfDay.getTime() },
      startTimeMillis: startOfDay.getTime(),
      endTimeMillis: now,
    };
    const resp = await fetch('https://www.googleapis.com/fitness/v1/users/me/dataset:aggregate', {
      method: 'POST',
      headers: { Authorization: `Bearer ${user.googleFitAccessToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    const data = await resp.json();
    if (!resp.ok) return res.status(400).json({ success: false, error: 'Google Fit sync failed — token may have expired, try reconnecting.' });

    let steps, heartRate;
    (data.bucket || []).forEach(b => {
      (b.dataset || []).forEach(ds => {
        (ds.point || []).forEach(pt => {
          if (ds.dataSourceId?.includes('step_count') && pt.value?.[0]?.intVal != null) {
            steps = (steps || 0) + pt.value[0].intVal;
          }
          if (ds.dataSourceId?.includes('heart_rate') && pt.value?.[0]?.fpVal != null) {
            heartRate = Math.round(pt.value[0].fpVal);
          }
        });
      });
    });

    const vitals = { steps, heartRate };
    const reasons = checkAbnormalVitals(vitals);
    const entry = await WearableEntry.create({
      patient: req.user.id, date: new Date(), source: 'google_fit',
      ...vitals, flagged: reasons.length > 0, flagReasons: reasons,
    });
    if (reasons.length > 0) await notifyDoctorOfFlag(req, req.user, entry, reasons);
    res.json({ success: true, data: entry });
  } catch (e) { res.status(500).json({ success: false, error: e.message }); }
};
