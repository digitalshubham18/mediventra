// ── ID Proof Format Validation ────────────────────────────────────────────
// We have no way to verify an ID against an actual government database, but
// we CAN catch obviously fake/mistyped numbers by checking them against the
// real, publicly documented format for each ID type. Anything that doesn't
// match is almost certainly a typo or a made-up number.

const ID_PATTERNS = {
  aadhaar: {
    label: 'Aadhaar',
    example: '12 digits, e.g. 234567890123',
    // Real Aadhaar numbers are 12 digits and never start with 0 or 1.
    regex: /^[2-9][0-9]{11}$/,
  },
  pan: {
    label: 'PAN',
    example: 'e.g. ABCDE1234F',
    regex: /^[A-Z]{5}[0-9]{4}[A-Z]$/,
  },
  passport: {
    label: 'Passport',
    example: 'e.g. A1234567',
    regex: /^[A-Z][0-9]{7}$/,
  },
  voter_id: {
    label: 'Voter ID (EPIC)',
    example: 'e.g. ABC1234567',
    regex: /^[A-Z]{3}[0-9]{7}$/,
  },
  driving_license: {
    label: 'Driving License',
    example: 'e.g. DL0120210012345',
    regex: /^[A-Z0-9]{10,16}$/,
  },
};

// Returns { valid: true } or { valid: false, error }.
function validateIdProof(type, number) {
  if (!type) return { valid: true }; // nothing to check
  const cfg = ID_PATTERNS[type];
  if (!cfg) return { valid: true }; // unknown type, don't block
  const cleaned = String(number || '').toUpperCase().replace(/[\s-]/g, '');
  if (!cfg.regex.test(cleaned)) {
    return {
      valid: false,
      error: `This ID number does not match a valid ${cfg.label} format (${cfg.example}). Please check and enter the correct number.`,
    };
  }
  return { valid: true };
}

module.exports = { validateIdProof, ID_PATTERNS };
