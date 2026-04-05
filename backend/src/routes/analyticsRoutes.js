const express = require('express');
const router  = express.Router();
const { protect } = require('../middlewares/auth');
const Report = require('../models/Report');

// GET /api/analytics/wards
router.get('/wards', protect, async (req, res) => {
  try {
    const data = await Report.aggregate([
      {
        $group: {
          _id: { ward: '$wardName', city: '$city' },
          total:       { $sum: 1 },
          pending:     { $sum: { $cond: [{ $eq: ['$status', 'Pending'] },     1, 0] } },
          verified:    { $sum: { $cond: [{ $eq: ['$status', 'Verified'] },    1, 0] } },
          inProgress:  { $sum: { $cond: [{ $eq: ['$status', 'In Progress'] }, 1, 0] } },
          resolved:    { $sum: { $cond: [{ $eq: ['$status', 'Resolved'] },    1, 0] } },
          rejected:    { $sum: { $cond: [{ $eq: ['$status', 'Rejected'] },    1, 0] } },
          avgSeverity: { $avg: '$severity' },
          avgUrgency:  { $avg: '$urgencyScore' }
        }
      },
      { $sort: { total: -1 } }
    ]);

    const wards = data.map(d => ({
      ward:        d._id.ward || 'Unknown',
      city:        d._id.city || '',
      total:       d.total,
      pending:     d.pending,
      verified:    d.verified,
      inProgress:  d.inProgress,
      resolved:    d.resolved,
      rejected:    d.rejected,
      avgSeverity: d.avgSeverity ? parseFloat(d.avgSeverity.toFixed(2)) : null,
      avgUrgency:  d.avgUrgency  ? parseFloat(d.avgUrgency.toFixed(2))  : null,
      resolutionRate: d.total > 0 ? Math.round((d.resolved / d.total) * 100) : 0
    }));

    res.json(wards);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;
