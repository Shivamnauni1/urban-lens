const RepairLog = require('../models/RepairLog');
const Report    = require('../models/Report');

// POST /api/repairs/:reportId  — log a repair action
const createLog = async (req, res) => {
  try {
    const { action, newStatus, note } = req.body;

    if (!action || !newStatus)
      return res.status(400).json({ message: 'Action and new status are required' });

    const allowed = ['Pending', 'Verified', 'In Progress', 'Resolved', 'Rejected'];
    if (!allowed.includes(newStatus))
      return res.status(400).json({ message: 'Invalid status' });

    const report = await Report.findById(req.params.reportId);
    if (!report) return res.status(404).json({ message: 'Report not found' });

    // Ward authority can only log repairs for their own ward
    if (req.user.role === 'ward_authority' && report.wardName !== req.user.wardName)
      return res.status(403).json({ message: 'Not authorized for this ward' });

    // Update report status
    report.status = newStatus;
    await report.save();

    // Create log entry
    const log = await RepairLog.create({
      report:    report._id,
      authority: req.user._id,
      action,
      newStatus,
      note: note || ''
    });

    const populated = await log.populate('authority', 'username role wardName');
    res.status(201).json({ log: populated, report });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// GET /api/repairs/:reportId  — get all logs for a report
const getLogs = async (req, res) => {
  try {
    const logs = await RepairLog.find({ report: req.params.reportId })
      .populate('authority', 'username role wardName')
      .sort({ createdAt: -1 });
    res.json(logs);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

module.exports = { createLog, getLogs };
