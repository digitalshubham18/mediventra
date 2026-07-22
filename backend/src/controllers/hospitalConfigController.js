const HospitalConfig = require('../models/HospitalConfig');
const { buildFileUrl } = require('../middleware/upload');

// GET /api/hospital-config — anyone authenticated can read (harmless, used
// to display hospital name consistently; only admin can change it)
exports.getConfig = async (req, res) => {
  try {
    let config = await HospitalConfig.findOne();
    if (!config) config = await HospitalConfig.create({});
    res.json({ success: true, data: config });
  } catch (e) { res.status(500).json({ success: false, error: e.message }); }
};

// PUT /api/hospital-config — admin only
exports.updateConfig = async (req, res) => {
  try {
    const { hospitalName, signatoryName, signatoryTitle, contactPhone, contactEmail, address, tagline } = req.body;
    const update = {};
    if (hospitalName !== undefined) update.hospitalName = hospitalName;
    if (signatoryName !== undefined) update.signatoryName = signatoryName;
    if (signatoryTitle !== undefined) update.signatoryTitle = signatoryTitle;
    if (contactPhone !== undefined) update.contactPhone = contactPhone;
    if (contactEmail !== undefined) update.contactEmail = contactEmail;
    if (address !== undefined) update.address = address;
    if (tagline !== undefined) update.tagline = tagline;
    if (req.file) update.signatureUrl = buildFileUrl(req.file, 'signatures');

    let config = await HospitalConfig.findOne();
    if (!config) config = await HospitalConfig.create(update);
    else { Object.assign(config, update); await config.save(); }

    res.json({ success: true, data: config });
  } catch (e) { res.status(500).json({ success: false, error: e.message }); }
};
