const BloodInventory = require('../models/BloodInventory');
const BloodDonation = require('../models/BloodDonation');
const HospitalConfig = require('../models/HospitalConfig');
const User = require('../models/User');
const HealthCertificate = require('../models/HealthCertificate');
const { generateBloodDonationCertificate } = require('../utils/certificateGenerator');
const { checkDonorEligibility } = require('../utils/bloodEligibility');
const { validateIdProof } = require('../utils/idProofValidator');
const smsService = require('../utils/smsService');
const { logAction } = require('../utils/auditLog');
const path = require('path');
const fs = require('fs');
const https = require('https');
const http = require('http');

const BLOOD_GROUPS = ['A+','A-','B+','B-','AB+','AB-','O+','O-'];

// Fetches a remote (e.g. Cloudinary-hosted) image URL into a Buffer so it
// can be embedded with pdfkit's doc.image(), which only accepts a local
// path, a Buffer, or a data URI — never a bare remote URL. Without this,
// any hospital running with Cloudinary storage (recommended for
// production, since it survives restarts/redeploys) would have its
// uploaded signature silently skipped on every generated certificate.
function fetchImageBuffer(url) {
  return new Promise((resolve, reject) => {
    const lib = url.startsWith('https://') ? https : http;
    lib.get(url, (res) => {
      if (res.statusCode !== 200) { reject(new Error(`Signature fetch failed: ${res.statusCode}`)); return; }
      const chunks = [];
      res.on('data', (c) => chunks.push(c));
      res.on('end', () => resolve(Buffer.concat(chunks)));
      res.on('error', reject);
    }).on('error', reject);
  });
}

// GET /api/blood-bank/inventory — clinical/admin staff only. Patients must
// NOT see hospital blood stock levels (low stock counts could pressure
// patients into donating, and stock levels aren't something a patient
// needs to make their own donation decision) — enforced here as well as
// at the route level, so a direct API call can't bypass it either.
exports.getInventory = async (req, res) => {
  try {
    if (req.user.role === 'patient') {
      return res.status(403).json({ success: false, error: 'Patients are not permitted to view hospital blood stock levels.' });
    }
    // Ensure every blood group has a document (first-run convenience) —
    // avoids the frontend having to handle "missing" groups as a
    // special case, and avoids a separate seed script.
    const existing = await BloodInventory.find();
    const existingGroups = new Set(existing.map(e => e.bloodGroup));
    const missing = BLOOD_GROUPS.filter(g => !existingGroups.has(g));
    if (missing.length) {
      await BloodInventory.insertMany(missing.map(bloodGroup => ({ bloodGroup, units: 0 })));
    }
    const inventory = await BloodInventory.find().sort({ bloodGroup: 1 });
    res.json({ success: true, data: inventory });
  } catch (e) { res.status(500).json({ success: false, error: e.message }); }
};

// PUT /api/blood-bank/inventory/:bloodGroup — admin/lab/nurse sets exact unit count
exports.updateInventory = async (req, res) => {
  try {
    const { bloodGroup } = req.params;
    const { units } = req.body;
    if (!BLOOD_GROUPS.includes(bloodGroup)) return res.status(400).json({ success: false, error: 'Invalid blood group' });
    if (units === undefined || units < 0) return res.status(400).json({ success: false, error: 'units must be 0 or more' });

    const record = await BloodInventory.findOneAndUpdate(
      { bloodGroup }, { units, lastUpdatedBy: req.user.id }, { new: true, upsert: true }
    );

    logAction({
      actor: req.user, action: 'record_updated',
      description: `Updated blood bank stock for ${bloodGroup} to ${units} units`,
      targetType: 'BloodInventory', targetId: record._id,
    });

    res.json({ success: true, data: record });
  } catch (e) { res.status(500).json({ success: false, error: e.message }); }
};

// ── Donations ───────────────────────────────────────────────────────────

// GET /api/blood-bank/eligibility — patient's own records-based pre-screen,
// shown before they open the donation form so they know where they stand.
exports.getEligibility = async (req, res) => {
  try {
    const user = await User.findById(req.user.id);
    const result = await checkDonorEligibility(user);
    res.json({ success: true, data: { ...result, bloodGroupOnFile: user.bloodGroup || '' } });
  } catch (e) { res.status(500).json({ success: false, error: e.message }); }
};

// POST /api/blood-bank/donate — patient requests to donate, either for
// themselves (donorType 'self') or to register a relative/colleague as
// the actual donor (donorType 'other').
exports.requestDonation = async (req, res) => {
  try {
    const {
      preferredDate, contactPhone, notes,
      donorType, confirmBloodGroupChange,
    } = req.body;
    let { bloodGroup } = req.body;

    if (!preferredDate) return res.status(400).json({ success: false, error: 'Preferred date is required' });
    const type = donorType === 'other' ? 'other' : 'self';

    const donationDoc = {
      donor: req.user.id, donorType: type,
      preferredDate: new Date(preferredDate),
      contactPhone: contactPhone || req.user.phone || '', notes: notes || '',
    };

    if (type === 'self') {
      const user = await User.findById(req.user.id);

      // ── Blood group: auto-fill from account, or store what's typed ──
      if (!user.bloodGroup) {
        // Nothing on file yet (e.g. never set at registration) — whatever
        // they submit here becomes their official hospital blood group.
        if (!bloodGroup) return res.status(400).json({ success: false, error: 'Please provide your blood group.' });
        if (!BLOOD_GROUPS.includes(bloodGroup)) return res.status(400).json({ success: false, error: 'Invalid blood group' });
        user.bloodGroup = bloodGroup;
        await user.save();
      } else if (bloodGroup && bloodGroup !== user.bloodGroup) {
        // They're trying to submit a different group than what's on file —
        // never silently overwrite; require explicit confirmation first.
        if (!confirmBloodGroupChange) {
          return res.status(409).json({
            success: false,
            requiresConfirmation: true,
            currentBloodGroup: user.bloodGroup,
            requestedBloodGroup: bloodGroup,
            error: `Your blood group on file is ${user.bloodGroup}. Do you want to change it to ${bloodGroup}?`,
          });
        }
        if (!BLOOD_GROUPS.includes(bloodGroup)) return res.status(400).json({ success: false, error: 'Invalid blood group' });
        user.bloodGroup = bloodGroup;
        await user.save();
      } else {
        // Not provided, or matches what's on file — always trust the
        // hospital record over anything else.
        bloodGroup = user.bloodGroup;
      }

      // ── Records-based eligibility pre-screen ─────────────────────────
      const eligibility = await checkDonorEligibility(user);
      if (!eligibility.eligible) {
        return res.status(400).json({
          success: false,
          error: 'Based on your hospital records, you may not be eligible to donate blood right now.',
          eligibility,
        });
      }

      donationDoc.bloodGroup = bloodGroup;
      donationDoc.eligibility = {
        eligible: eligibility.eligible, reasons: eligibility.reasons,
        warnings: eligibility.warnings, checkedAt: new Date(),
      };
    } else {
      // ── Registering a relative/colleague as the donor ────────────────
      const relative = req.body.relative || {};
      const required = ['name', 'age', 'relation', 'phone', 'bloodGroup', 'idProofType', 'idProofNumber'];
      const missing = required.filter((k) => !relative[k]);
      if (missing.length) {
        return res.status(400).json({ success: false, error: `Please fill in the donor's ${missing.join(', ')}.` });
      }
      if (!BLOOD_GROUPS.includes(relative.bloodGroup)) {
        return res.status(400).json({ success: false, error: 'Invalid blood group for the donor' });
      }
      if (Number(relative.age) < 18 || Number(relative.age) > 65) {
        return res.status(400).json({ success: false, error: 'The donor must be between 18 and 65 years old.' });
      }

      // Catch obviously fake/mistyped ID numbers by checking the real,
      // publicly documented format for the selected ID type.
      const idCheck = validateIdProof(relative.idProofType, relative.idProofNumber);
      if (!idCheck.valid) {
        return res.status(400).json({ success: false, error: idCheck.error });
      }

      // No hospital records exist for someone who isn't the account
      // holder, so a self-declared checklist stands in for the
      // records-based check — every box must be confirmed.
      const decl = req.body.selfDeclaration || {};
      const declKeys = ['ageConfirmed', 'weightAbove45', 'noRecentIllness', 'noChronicDisease', 'noRecentDonation'];
      const unconfirmed = declKeys.filter((k) => decl[k] !== true);
      if (unconfirmed.length) {
        return res.status(400).json({
          success: false,
          error: "Please confirm all of the donor's eligibility declarations before submitting.",
          missingDeclarations: unconfirmed,
        });
      }

      donationDoc.bloodGroup = relative.bloodGroup;
      donationDoc.relative = {
        name: relative.name, age: relative.age, gender: relative.gender || '',
        relation: relative.relation, phone: relative.phone, bloodGroup: relative.bloodGroup,
        address: relative.address || '', idProofType: relative.idProofType || '',
        idProofNumber: relative.idProofNumber || '',
      };
      donationDoc.selfDeclaration = decl;
    }

    const donation = await BloodDonation.create(donationDoc);

    const io = req.app.get('io');
    const displayName = type === 'other' ? donation.relative.name : req.user.name;
    if (io) io.emit('blood_donation_requested', { donationId: donation._id, donorName: displayName, bloodGroup: donation.bloodGroup, donorType: type });

    // SMS confirmation to the phone number entered at booking time
    const confirmPhone = donation.contactPhone || req.user.phone;
    if (confirmPhone) {
      const prefStr = donation.preferredDate.toLocaleDateString('en-IN', { day:'numeric', month:'short', year:'numeric' });
      smsService.sendSMS({
        to: confirmPhone,
        body: `Mediventra: Your blood donation request (${displayName}, ${donation.bloodGroup}) for ${prefStr} has been received. We'll confirm your schedule soon. Thank you!`,
      }).catch(console.error);
    }

    res.status(201).json({ success: true, data: donation, message: 'Thank you! The donation request has been submitted.' });
  } catch (e) { res.status(500).json({ success: false, error: e.message }); }
};

// GET /api/blood-bank/donations/mine — donor's own history
exports.getMyDonations = async (req, res) => {
  try {
    const donations = await BloodDonation.find({ donor: req.user.id }).sort({ createdAt: -1 });
    res.json({ success: true, data: donations });
  } catch (e) { res.status(500).json({ success: false, error: e.message }); }
};

// GET /api/blood-bank/donations — staff view of all requests
exports.getAllDonations = async (req, res) => {
  try {
    const q = {};
    if (req.query.status) q.status = req.query.status;
    const donations = await BloodDonation.find(q).populate('donor', 'name phone email bloodGroup').sort({ createdAt: -1 });
    res.json({ success: true, data: donations });
  } catch (e) { res.status(500).json({ success: false, error: e.message }); }
};

// PUT /api/blood-bank/donations/:id/status — schedule / cancel / reject
exports.updateDonationStatus = async (req, res) => {
  try {
    const { status, rejectionReason, scheduledDate, confirmDateMismatch } = req.body;
    if (!['scheduled', 'cancelled', 'rejected'].includes(status)) {
      return res.status(400).json({ success: false, error: 'Use the /complete endpoint to mark a donation completed' });
    }

    const donation = await BloodDonation.findById(req.params.id).populate('donor', 'name email phone');
    if (!donation) return res.status(404).json({ success: false, error: 'Donation not found' });

    const update = { status, rejectionReason: rejectionReason || '' };

    if (status === 'scheduled') {
      // A specific date AND time is required — this is exactly what gets
      // shown to, and notified to, the patient, so a vague "scheduled"
      // status with no date/time isn't allowed.
      if (!scheduledDate) {
        return res.status(400).json({ success: false, error: 'Please pick a date and time to schedule this donation.' });
      }
      const scheduled = new Date(scheduledDate);
      if (isNaN(scheduled.getTime())) {
        return res.status(400).json({ success: false, error: 'Invalid scheduled date/time.' });
      }
      if (scheduled.getTime() < Date.now()) {
        return res.status(400).json({ success: false, error: 'The scheduled date/time cannot be in the past.' });
      }

      // The patient asked to donate on a specific day (preferredDate).
      // Scheduling it for a different day needs an explicit confirmation
      // so staff don't silently move a patient to a day they didn't ask
      // for — e.g. patient booked for tomorrow, staff must schedule it
      // for tomorrow unless they deliberately confirm a different day.
      const sameDay = (a, b) => a.getFullYear()===b.getFullYear() && a.getMonth()===b.getMonth() && a.getDate()===b.getDate();
      if (!sameDay(scheduled, new Date(donation.preferredDate)) && !confirmDateMismatch) {
        const prefStr = new Date(donation.preferredDate).toLocaleDateString('en-IN', { day:'numeric', month:'short', year:'numeric' });
        const schedStr = scheduled.toLocaleDateString('en-IN', { day:'numeric', month:'short', year:'numeric' });
        return res.status(409).json({
          success: false,
          requiresConfirmation: true,
          preferredDate: donation.preferredDate,
          error: `The patient requested to donate on ${prefStr}. You are scheduling this for ${schedStr} instead. Continue anyway?`,
        });
      }

      update.scheduledDate = scheduled;
      update.scheduledBy = req.user.id;
    }

    Object.assign(donation, update);
    await donation.save();

    if (status === 'scheduled') {
      const dateStr = donation.scheduledDate.toLocaleDateString('en-IN', { day:'numeric', month:'short', year:'numeric' });
      const timeStr = donation.scheduledDate.toLocaleTimeString('en-IN', { hour:'2-digit', minute:'2-digit' });
      const donorName = donation.donorType === 'other' && donation.relative?.name ? donation.relative.name : donation.donor?.name;

      // Real-time notification to the patient the moment it's scheduled
      const io = req.app.get('io');
      if (io) {
        io.to(`user_${donation.donor._id}`).emit('blood_donation_scheduled', {
          donationId: donation._id, scheduledDate: donation.scheduledDate,
          dateStr, timeStr, donorName,
          message: `Your blood donation is scheduled for ${dateStr} at ${timeStr}.`,
        });
      }

      // SMS confirmation to the phone number given at booking time
      const phone = donation.contactPhone || donation.donor?.phone;
      if (phone) {
        smsService.sendSMS({
          to: phone,
          body: `Mediventra: Your blood donation (${donorName}, ${donation.bloodGroup}) is scheduled for ${dateStr} at ${timeStr}. Please arrive on time. Thank you for donating!`,
        }).catch(console.error);
      }
    }

    res.json({ success: true, data: donation });
  } catch (e) { res.status(500).json({ success: false, error: e.message }); }
};

// PUT /api/blood-bank/donations/:id/complete — staff records the actual
// donation: adds units to inventory and issues the certificate.
exports.completeDonation = async (req, res) => {
  try {
    const { unitsCollected } = req.body;
    const donation = await BloodDonation.findById(req.params.id).populate('donor', 'name email');
    if (!donation) return res.status(404).json({ success: false, error: 'Donation not found' });
    if (donation.status === 'completed') return res.status(400).json({ success: false, error: 'Already marked completed' });

    const units = Math.max(1, Math.min(2, Number(unitsCollected) || donation.unitsCollected || 1));

    donation.status = 'completed';
    donation.unitsCollected = units;
    donation.completedAt = new Date();
    donation.completedBy = req.user.id;
    donation.certificateNo = `MHMS-BD-${new Date().getFullYear()}-${String(donation._id).slice(-6).toUpperCase()}`;
    donation.certificateGeneratedAt = new Date();
    await donation.save();

    // The donor field is always a registered patient account, even when the
    // actual blood came from a relative ("donorType: other") — a relative
    // without their own account can't hold a certificate record, so it's
    // filed under the account holder, with the relative named in the purpose.
    const donorDisplayName = donation.donorType === 'other' && donation.relative?.name
      ? donation.relative.name : donation.donor.name;
    await HealthCertificate.create({
      patient: donation.donor._id,
      type: 'blood_donation',
      purpose: donation.donorType === 'other'
        ? `Blood donation on behalf of ${donorDisplayName}`
        : 'Blood donation certificate',
      bloodGroup: donation.bloodGroup,
      certificateNumber: donation.certificateNo,
      donationRef: donation._id,
      issuedDate: donation.completedAt,
    });

    await BloodInventory.findOneAndUpdate(
      { bloodGroup: donation.bloodGroup },
      { $inc: { units } },
      { upsert: true }
    );

    logAction({
      actor: req.user, action: 'record_updated',
      description: `Recorded blood donation from ${donation.donor?.name} (${donation.bloodGroup}, ${units} unit${units>1?'s':''}) — certificate issued`,
      targetType: 'BloodDonation', targetId: donation._id,
    });

    const io = req.app.get('io');
    if (io) io.to(`user_${donation.donor._id}`).emit('blood_donation_completed', { donationId: donation._id, certificateNo: donation.certificateNo });

    res.json({ success: true, data: donation, message: 'Donation recorded and certificate generated!' });
  } catch (e) { res.status(500).json({ success: false, error: e.message }); }
};

// GET /api/blood-bank/donations/:id/certificate — generate & stream the PDF
// Generated fresh on every request (deterministic from the donation
// record + hospital config) rather than stored — sidesteps any file
// storage/persistence concerns entirely for this feature.
exports.getCertificate = async (req, res) => {
  try {
    const donation = await BloodDonation.findById(req.params.id).populate('donor', 'name');
    if (!donation) return res.status(404).json({ success: false, error: 'Donation not found' });
    if (donation.status !== 'completed') return res.status(400).json({ success: false, error: 'Certificate is only available after the donation is marked completed' });

    // Only the donor themselves or staff can download it
    const isOwner = String(donation.donor._id) === String(req.user.id);
    const isStaff = ['admin','nurse','lab_technician','receptionist'].includes(req.user.role);
    if (!isOwner && !isStaff) return res.status(403).json({ success: false, error: 'Not authorized to view this certificate' });

    let config = await HospitalConfig.findOne();
    if (!config) config = await HospitalConfig.create({});

    let signatureImagePath = null;
    if (config.signatureUrl) {
      if (/^https?:\/\//i.test(config.signatureUrl)) {
        // Cloudinary-hosted (or any remote) signature — pdfkit's doc.image()
        // needs a local path or a Buffer, not a bare URL, so fetch the
        // bytes ourselves. Without this the signature was silently
        // skipped on every certificate whenever Cloudinary storage was
        // active (the recommended production setup), even though one had
        // been uploaded in Certificate Settings.
        try { signatureImagePath = await fetchImageBuffer(config.signatureUrl); }
        catch { signatureImagePath = null; } // fall back to printed name/title line only
      } else {
        const p = path.join(__dirname, '../../', config.signatureUrl);
        if (fs.existsSync(p)) signatureImagePath = p;
      }
    }

    const donorName = donation.donorType === 'other' && donation.relative?.name
      ? donation.relative.name
      : donation.donor.name;

    const pdfBuffer = await generateBloodDonationCertificate({
      donorName,
      bloodGroup: donation.bloodGroup,
      donationDate: donation.completedAt,
      unitsCollected: donation.unitsCollected,
      certificateNo: donation.certificateNo,
      hospitalName: config.hospitalName,
      signatoryName: config.signatoryName,
      signatoryTitle: config.signatoryTitle,
      signatureImagePath,
    });

    res.set({
      'Content-Type': 'application/pdf',
      'Content-Disposition': `inline; filename="Blood-Donation-Certificate-${donation.certificateNo}.pdf"`,
    });
    res.send(pdfBuffer);
  } catch (e) { res.status(500).json({ success: false, error: e.message }); }
};
