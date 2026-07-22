// ── Blood Donation Eligibility Pre-Screening ─────────────────────────────
// Looks at a patient's OWN hospital records (age, vitals, lab results,
// discharge summaries, prescriptions, donation history) to flag whether
// donating blood looks safe right now — both for the donor's own body and
// for whoever eventually receives the unit.
//
// IMPORTANT: this is a records-based pre-screen only. It never replaces
// the in-person medical check (hemoglobin test, BP, physical exam) every
// real blood bank performs at the moment of donation — the disclaimer
// below is always returned alongside the result and should be shown to
// the patient.

const HealthRecord = require('../models/HealthRecord');
const BloodDonation = require('../models/BloodDonation');

const MIN_AGE = 18;
const MAX_AGE = 65;
const MIN_WEIGHT_KG = 45;
const MIN_GAP_DAYS = 90; // minimum days required between two donations

// Conditions that, per standard blood-bank screening guidelines, generally
// disqualify a donor outright (protects both donor and recipient).
const DISQUALIFYING_TERMS = [
  'hiv', 'aids', 'hepatitis b', 'hepatitis c', 'hbsag', 'hcv',
  'syphilis', 'vdrl reactive', 'active malaria', 'active tuberculosis',
  'cancer', 'leukemia', 'blood cancer', 'uncontrolled diabetes',
  'kidney failure', 'dialysis', 'heart disease', 'cardiac disease',
  'seizure disorder', 'epilepsy', 'sickle cell', 'haemophilia', 'hemophilia',
  'thalassemia',
];

const INFECTION_TEST_TERMS = ['hiv', 'hepatitis', 'hbsag', 'hcv', 'vdrl', 'syphilis', 'malaria'];
const PREGNANCY_TERMS = ['pregnan', 'maternity', 'delivery', 'postpartum', 'c-section', 'cesarean'];

const DISCLAIMER = 'This is an automated pre-screening based on your hospital records only. Final eligibility is always confirmed in person by hospital staff (hemoglobin test, blood pressure, physical exam) at the time of donation.';

async function checkDonorEligibility(user) {
  const reasons = [];
  const warnings = [];
  let nextEligibleDate = null;

  // ── Age ──────────────────────────────────────────────────────────────
  if (user.age === undefined || user.age === null) {
    warnings.push('Your age is not on file — please update your profile so staff can verify age eligibility.');
  } else if (user.age < MIN_AGE) {
    reasons.push(`Donors must be at least ${MIN_AGE} years old (your profile shows age ${user.age}).`);
  } else if (user.age > MAX_AGE) {
    reasons.push(`Standard guidelines cap donor age at ${MAX_AGE} (your profile shows age ${user.age}).`);
  }

  // ── Weight (from the most recent recorded vitals) ───────────────────
  const latestWithWeight = await HealthRecord.findOne({
    patient: user._id, 'vitals.weight': { $exists: true, $ne: null },
  }).sort({ createdAt: -1 });
  const weight = latestWithWeight?.vitals?.weight;
  if (weight === undefined || weight === null) {
    warnings.push(`No recorded body weight on file — hospital staff will confirm you meet the ${MIN_WEIGHT_KG}kg minimum before donation.`);
  } else if (weight < MIN_WEIGHT_KG) {
    reasons.push(`Your most recently recorded weight (${weight}kg) is below the ${MIN_WEIGHT_KG}kg minimum required to donate safely.`);
  }

  // ── Gap since last own completed donation ───────────────────────────
  const lastDonation = await BloodDonation.findOne({
    donor: user._id, donorType: 'self', status: 'completed',
  }).sort({ completedAt: -1 });
  const formatDMY = (d) => {
    const dt = new Date(d);
    return `${dt.getDate()}-${dt.getMonth() + 1}-${String(dt.getFullYear()).slice(-2)}`;
  };

  if (lastDonation?.completedAt) {
    const daysSince = Math.floor((Date.now() - new Date(lastDonation.completedAt).getTime()) / 86400000);
    if (daysSince < MIN_GAP_DAYS) {
      const daysRemaining = MIN_GAP_DAYS - daysSince;
      nextEligibleDate = new Date(new Date(lastDonation.completedAt).getTime() + MIN_GAP_DAYS * 86400000);
      reasons.push(
        `You are not eligible for blood donation because you already donated blood on ${formatDMY(lastDonation.completedAt)}. ` +
        `Till today it is only ${daysSince} day${daysSince === 1 ? '' : 's'}. ` +
        `You are eligible after ${daysRemaining} more day${daysRemaining === 1 ? '' : 's'}, i.e. on ${formatDMY(nextEligibleDate)}.`
      );
    }
  }

  // ── Scan recent records for disqualifying conditions ────────────────
  const sixMonthsAgo = new Date(Date.now() - 183 * 86400000);
  const threeMonthsAgo = new Date(Date.now() - 92 * 86400000);
  const fourteenDaysAgo = new Date(Date.now() - 14 * 86400000);

  const recentRecords = await HealthRecord.find({ patient: user._id, createdAt: { $gte: sixMonthsAgo } });

  for (const rec of recentRecords) {
    const haystack = `${rec.title || ''} ${rec.description || ''} ${rec.results || ''} ${rec.resultNotes || ''} ${(rec.tags || []).join(' ')}`.toLowerCase();

    const hitTerm = DISQUALIFYING_TERMS.find((t) => haystack.includes(t));
    if (hitTerm) {
      reasons.push(`Your records mention a condition that typically disqualifies blood donation (flagged from "${rec.title}"). Please consult a doctor before donating.`);
    }

    if (rec.isAbnormal && rec.type === 'lab_report' && INFECTION_TEST_TERMS.some((t) => haystack.includes(t))) {
      reasons.push(`An abnormal infection-screening result is on file ("${rec.testName || rec.title}", ${new Date(rec.createdAt).toLocaleDateString('en-IN')}) — this needs medical clearance before donating, to protect both you and the recipient.`);
    }

    if (rec.type === 'discharge_summary' && new Date(rec.createdAt) > threeMonthsAgo) {
      warnings.push(`A discharge summary from ${new Date(rec.createdAt).toLocaleDateString('en-IN')} is within the last 3 months — recent surgery/hospitalization usually needs a waiting period; staff will confirm at screening.`);
    }

    if (rec.type === 'prescription' && new Date(rec.createdAt) > fourteenDaysAgo) {
      warnings.push('A recent prescription is on file — some medications require a short waiting period before donation; this will be verified at screening.');
    }

    if ((user.gender || '').toLowerCase() === 'female' && PREGNANCY_TERMS.some((t) => haystack.includes(t))) {
      reasons.push('A recent record mentions pregnancy/childbirth — donors are generally asked to wait at least 6 months after delivery before donating.');
    }
  }

  return {
    eligible: reasons.length === 0,
    reasons: [...new Set(reasons)],
    warnings: [...new Set(warnings)],
    nextEligibleDate,
    disclaimer: DISCLAIMER,
  };
}

module.exports = { checkDonorEligibility, DISCLAIMER, MIN_AGE, MAX_AGE, MIN_WEIGHT_KG, MIN_GAP_DAYS };
