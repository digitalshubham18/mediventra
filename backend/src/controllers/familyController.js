const FamilyLink = require('../models/FamilyLink');
const User = require('../models/User');
const jwt = require('jsonwebtoken');
const { logAction } = require('../utils/auditLog');

// GET /api/family — everyone I manage (my dependents)
exports.getMyFamily = async (req, res) => {
  try {
    const links = await FamilyLink.find({ primaryUser: req.user.id }).populate('dependent', 'name avatar bloodGroup age gender phone status');
    res.json({ success: true, data: links });
  } catch (e) { res.status(500).json({ success: false, error: e.message }); }
};

// POST /api/family — add a new dependent (child/elderly relative) —
// creates a real patient account for them. Unlike the doctor/staff
// "add patient" flow, this one DOES require admin approval before the
// primary account holder can log in as them — modeled on how real
// hospital portals (e.g. Tata Main Hospital) treat a new dependent
// profile the same as any new patient signup, since staff haven't
// verified this person in person the way a doctor/nurse would.
exports.addFamilyMember = async (req, res) => {
  try {
    const { name, relation, age, gender, bloodGroup, phone, address, email, allergies } = req.body;

    // A dependent is a real patient profile in the hospital system, so it
    // needs the same real contact/identity details any patient would —
    // no placeholder email, no left-blank phone/address. This is also
    // what lets the dependent claim their own login later (password
    // reset via their real email) if they ever need independent access.
    const missing = [];
    if (!name || !name.trim())         missing.push('name');
    if (!relation || !relation.trim()) missing.push('relation');
    if (!email || !email.trim())       missing.push('email');
    if (!phone || !phone.trim())       missing.push('phone');
    if (age === undefined || age === null || age === '') missing.push('age');
    if (!gender)                       missing.push('gender');
    if (!bloodGroup)                   missing.push('blood group');
    if (!address || !address.trim())   missing.push('address');
    if (missing.length) {
      return res.status(400).json({ success: false, error: `Please fill in the family member's ${missing.join(', ')}.` });
    }
    if (!/\S+@\S+\.\S+/.test(email)) return res.status(400).json({ success: false, error: 'Enter a valid email address' });
    if (phone.replace(/\D/g, '').length < 10) return res.status(400).json({ success: false, error: 'Enter a valid phone number' });
    if (Number(age) < 0 || Number(age) > 120) return res.status(400).json({ success: false, error: 'Enter a valid age' });
    const BLOOD_GROUPS = ['A+','A-','B+','B-','AB+','AB-','O+','O-'];
    if (!BLOOD_GROUPS.includes(bloodGroup)) return res.status(400).json({ success: false, error: 'Enter a valid blood group' });

    const existing = await User.findOne({ email: email.trim().toLowerCase() });
    if (existing) return res.status(400).json({ success: false, error: 'An account with this email already exists' });
    const existingPhone = await User.findOne({ phone: phone.trim() });
    if (existingPhone) return res.status(400).json({ success: false, error: 'An account with this phone number already exists' });

    const tempPassword = Math.random().toString(36).slice(-10);

    const dependent = await User.create({
      name: name.trim(), email: email.trim().toLowerCase(), password: tempPassword,
      role: 'patient', age: Number(age), gender, bloodGroup, phone: phone.trim(), address: address.trim(),
      allergies: Array.isArray(allergies) ? allergies : [],
      status: 'pending', // requires admin approval — see note above
      emailVerified: true,
    });

    const link = await FamilyLink.create({
      primaryUser: req.user.id, dependent: dependent._id, relation,
    });

    logAction({
      actor: req.user, action: 'patient_created_by_staff',
      description: `Added family member "${name}" (${relation}) — pending admin approval`,
      targetType: 'User', targetId: dependent._id,
    });

    const populated = await link.populate('dependent', 'name avatar bloodGroup age gender status');
    res.status(201).json({ success: true, data: populated });
  } catch (e) { res.status(500).json({ success: false, error: e.message }); }
};

// POST /api/family/:linkId/login-as — switch the current session into
// the dependent's own account. Only works once admin has approved
// them — same gate as if they'd logged in with their own credentials.
exports.loginAsFamilyMember = async (req, res) => {
  try {
    const link = await FamilyLink.findOne({ _id: req.params.linkId, primaryUser: req.user.id }).populate('dependent');
    if (!link) return res.status(404).json({ success: false, error: 'Family link not found' });
    if (link.dependent.status !== 'approved') {
      return res.status(403).json({ success: false, error: 'This family member is still pending admin approval' });
    }

    const token = jwt.sign({ id: link.dependent._id, role: link.dependent.role }, process.env.JWT_SECRET, { expiresIn: process.env.JWT_EXPIRE || '30d' });

    logAction({
      actor: req.user, action: 'record_updated',
      description: `Logged in as family member "${link.dependent.name}"`,
      targetType: 'User', targetId: link.dependent._id,
    });

    res.json({ success: true, token, data: { name: link.dependent.name } });
  } catch (e) { res.status(500).json({ success: false, error: e.message }); }
};

// DELETE /api/family/:linkId — remove a family link (doesn't delete the
// dependent's own account/history, just this management relationship)
exports.removeFamilyMember = async (req, res) => {
  try {
    const link = await FamilyLink.findOne({ _id: req.params.linkId, primaryUser: req.user.id });
    if (!link) return res.status(404).json({ success: false, error: 'Family link not found' });
    await link.deleteOne();
    res.json({ success: true, message: 'Family member removed from your account' });
  } catch (e) { res.status(500).json({ success: false, error: e.message }); }
};
