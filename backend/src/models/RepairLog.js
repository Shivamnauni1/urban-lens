const mongoose = require('mongoose');

const repairLogSchema = new mongoose.Schema(
  {
    report:      { type: mongoose.Schema.Types.ObjectId, ref: 'Report', required: true },
    authority:   { type: mongoose.Schema.Types.ObjectId, ref: 'User',   required: true },
    action:      { type: String, required: true },   // e.g. "Pothole filled with asphalt"
    newStatus:   { type: String, required: true },   // status set at time of log
    note:        { type: String, default: '' }        // optional extra note
  },
  { timestamps: true }
);

module.exports = mongoose.model('RepairLog', repairLogSchema);
