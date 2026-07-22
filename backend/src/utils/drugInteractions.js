// A curated set of well-documented drug-drug interactions and common
// allergy cross-reactions, matched case-insensitively by substring
// against medicine names. This is NOT a substitute for a licensed
// clinical drug database (DrugBank/FDA/Micromedex) — those require a
// paid API subscription this system doesn't have. It's a genuinely
// useful safety-net for the most common, textbook-documented
// interactions, clearly labeled as such wherever it's shown.

const INTERACTIONS = [
  { a: 'warfarin', b: 'aspirin', severity: 'high', note: 'Increased bleeding risk — both affect clotting.' },
  { a: 'warfarin', b: 'ibuprofen', severity: 'high', note: 'NSAIDs increase bleeding risk with anticoagulants.' },
  { a: 'warfarin', b: 'amoxicillin', severity: 'moderate', note: 'Antibiotics can potentiate warfarin\u2019s effect.' },
  { a: 'ssri', b: 'maoi', severity: 'high', note: 'Risk of serotonin syndrome.' },
  { a: 'fluoxetine', b: 'tramadol', severity: 'high', note: 'Increased seizure risk / serotonin syndrome.' },
  { a: 'ace inhibitor', b: 'potassium', severity: 'moderate', note: 'Risk of hyperkalemia.' },
  { a: 'lisinopril', b: 'spironolactone', severity: 'moderate', note: 'Risk of hyperkalemia.' },
  { a: 'metformin', b: 'contrast dye', severity: 'moderate', note: 'Risk of lactic acidosis — hold before contrast studies.' },
  { a: 'statin', b: 'clarithromycin', severity: 'high', note: 'Increased risk of statin-induced myopathy/rhabdomyolysis.' },
  { a: 'simvastatin', b: 'erythromycin', severity: 'high', note: 'Increased risk of statin-induced myopathy.' },
  { a: 'digoxin', b: 'amiodarone', severity: 'high', note: 'Amiodarone raises digoxin levels — toxicity risk.' },
  { a: 'sildenafil', b: 'nitrate', severity: 'high', note: 'Severe, potentially fatal hypotension.' },
  { a: 'clopidogrel', b: 'omeprazole', severity: 'moderate', note: 'Omeprazole may reduce clopidogrel\u2019s antiplatelet effect.' },
  { a: 'methotrexate', b: 'trimethoprim', severity: 'high', note: 'Increased methotrexate toxicity risk.' },
  { a: 'lithium', b: 'ibuprofen', severity: 'moderate', note: 'NSAIDs can raise lithium levels — toxicity risk.' },
  { a: 'insulin', b: 'beta blocker', severity: 'moderate', note: 'Beta blockers can mask hypoglycemia symptoms.' },
];

// Common cross-allergy groups: if a patient is allergic to one, related
// drugs in the same family carry meaningfully elevated risk too.
const ALLERGY_GROUPS = {
  penicillin: ['amoxicillin', 'ampicillin', 'penicillin', 'piperacillin'],
  sulfa:      ['sulfamethoxazole', 'sulfasalazine', 'trimethoprim'],
  nsaid:      ['ibuprofen', 'naproxen', 'diclofenac', 'aspirin'],
  cephalosporin: ['cephalexin', 'ceftriaxone', 'cefuroxime'],
};

function norm(s) { return (s || '').toLowerCase().trim(); }

// checkInteractions(medicineNames: string[]) -> [{a,b,severity,note}]
function checkInteractions(medicineNames) {
  const names = (medicineNames || []).map(norm).filter(Boolean);
  const hits = [];
  for (let i = 0; i < names.length; i++) {
    for (let j = i + 1; j < names.length; j++) {
      for (const rule of INTERACTIONS) {
        const aIn = names[i].includes(rule.a) || names[j].includes(rule.a);
        const bIn = names[i].includes(rule.b) || names[j].includes(rule.b);
        if (aIn && bIn) hits.push({ drugA: names[i], drugB: names[j], ...rule });
      }
    }
  }
  return hits;
}

// checkAllergies(medicineNames, allergies) -> [{ medicine, allergyGroup }]
function checkAllergies(medicineNames, allergies) {
  const names = (medicineNames || []).map(norm).filter(Boolean);
  const allergyList = (allergies || []).map(norm).filter(Boolean);
  const hits = [];
  for (const med of names) {
    for (const allergy of allergyList) {
      // Direct match
      if (med.includes(allergy) || allergy.includes(med)) {
        hits.push({ medicine: med, allergy, type: 'direct' });
        continue;
      }
      // Group match (e.g. allergic to "penicillin", prescribed "amoxicillin")
      for (const [group, members] of Object.entries(ALLERGY_GROUPS)) {
        if (allergy.includes(group) && members.some(m => med.includes(m))) {
          hits.push({ medicine: med, allergy, type: 'group', group });
        }
      }
    }
  }
  return hits;
}

module.exports = { checkInteractions, checkAllergies };
