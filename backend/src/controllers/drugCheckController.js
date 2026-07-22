const { checkInteractions, checkAllergies } = require('../utils/drugInteractions');
const User = require('../models/User');

// POST /api/drug-check — { medicines: string[], patientId? }
// Checks the given medicine list against (a) each other for known
// interactions and (b) the patient's recorded allergies, if a patientId
// is given. Called live while a doctor is writing a prescription.
exports.check = async (req, res) => {
  try {
    const { medicines, patientId } = req.body;
    if (!medicines || !Array.isArray(medicines)) {
      return res.status(400).json({ success: false, error: 'medicines array is required' });
    }
    const interactions = checkInteractions(medicines);

    let allergyHits = [];
    if (patientId) {
      const patient = await User.findById(patientId).select('allergies');
      allergyHits = checkAllergies(medicines, patient?.allergies || []);
    }

    res.json({ success: true, data: { interactions, allergyHits } });
  } catch (e) { res.status(500).json({ success: false, error: e.message }); }
};
