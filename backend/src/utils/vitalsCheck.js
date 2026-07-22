// ── Vitals Range Check ────────────────────────────────────────────────────
// Simple, widely-used clinical thresholds for flagging an out-of-range
// reading. This is a safety net, not a diagnosis — flagged entries are
// shown to the patient with a "consult a doctor" note, and the last
// treating doctor is notified so it can be triaged by a real clinician.

function checkAbnormalVitals({ heartRate, spo2, bpSystolic, bpDiastolic, bloodGlucose, temperature, respiratoryRate }) {
  const reasons = [];

  if (heartRate != null) {
    if (heartRate > 100) reasons.push(`Resting heart rate ${heartRate} bpm is above the normal range (60–100).`);
    else if (heartRate < 50) reasons.push(`Resting heart rate ${heartRate} bpm is below the normal range (60–100).`);
  }

  if (spo2 != null && spo2 < 92) {
    reasons.push(`Oxygen saturation ${spo2}% is below the safe threshold of 92%.`);
  }

  if (bpSystolic != null && bpDiastolic != null) {
    if (bpSystolic >= 140 || bpDiastolic >= 90) reasons.push(`Blood pressure ${bpSystolic}/${bpDiastolic} mmHg is in the hypertension range.`);
    else if (bpSystolic < 90 || bpDiastolic < 60) reasons.push(`Blood pressure ${bpSystolic}/${bpDiastolic} mmHg is in the low (hypotension) range.`);
  }

  if (bloodGlucose != null) {
    if (bloodGlucose > 180) reasons.push(`Blood glucose ${bloodGlucose} mg/dL is above the normal range.`);
    else if (bloodGlucose < 70) reasons.push(`Blood glucose ${bloodGlucose} mg/dL is below the normal range (risk of hypoglycemia).`);
  }

  // Temperature (°F) and respiratory rate — the two vitals that only ever
  // get recorded manually at a nurse's station, not by a wearable.
  if (temperature != null) {
    if (temperature >= 100.4) reasons.push(`Temperature ${temperature}°F indicates fever (≥100.4°F).`);
    else if (temperature < 95) reasons.push(`Temperature ${temperature}°F is below normal (hypothermia risk, <95°F).`);
  }

  if (respiratoryRate != null) {
    if (respiratoryRate > 20) reasons.push(`Respiratory rate ${respiratoryRate}/min is above the normal range (12–20).`);
    else if (respiratoryRate < 12) reasons.push(`Respiratory rate ${respiratoryRate}/min is below the normal range (12–20).`);
  }

  return reasons;
}

module.exports = { checkAbnormalVitals };
