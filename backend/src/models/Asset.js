const mongoose = require('mongoose');

// No physical RFID readers exist to track equipment automatically, so
// this is a manual "where is it right now" registry — staff update an
// asset's location when they move it, giving the same at-a-glance view
// real RFID would, just staff-updated instead of hardware-updated. If
// real RFID tags/readers are added later, they can PUT to the same
// asset record automatically and nothing else needs to change.
const AssetSchema = new mongoose.Schema({
  name:      { type: String, required: true }, // e.g. 'Ventilator #3', 'Crash Cart A'
  type:      {
    type: String,
    enum: ['ventilator', 'crash_cart', 'wheelchair', 'infusion_pump', 'defibrillator',
           'oxygen_cylinder', 'stretcher', 'it_hardware', 'electrical_equipment', 'plumbing_equipment', 'other'],
    default: 'other',
  },
  currentLocation: { type: String, required: true }, // e.g. 'ICU - Room 4', 'Store Room'
  status:    { type: String, enum: ['in_use', 'available', 'maintenance'], default: 'available' },
  // Who currently has custody of it — mainly used for movable equipment
  // (wardboys checking out a wheelchair/oxygen cylinder to a ward) and IT
  // hardware assigned to a department/staff member.
  assignedTo: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  assignedNote: { type: String, default: '' }, // e.g. "Ward B, Bed 4" or patient name

  // Preventive maintenance — mainly used by electricians/plumbers for
  // generators, pumps, panels etc. that need periodic servicing regardless
  // of whether anything's currently wrong with them.
  lastServicedAt: { type: Date, default: null },
  nextServiceDue: { type: Date, default: null },

  lastUpdatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  notes:     { type: String, default: '' },
}, { timestamps: true });

module.exports = mongoose.model('Asset', AssetSchema);
