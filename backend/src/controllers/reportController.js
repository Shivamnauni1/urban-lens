const Report = require('../models/Report');
const axios = require('axios');
const FormData = require('form-data');
const fs = require('fs');
const { resolveWard } = require('../utils/nominatim');

const ML_URL = process.env.ML_SERVICE_URL || 'http://localhost:8000';

// POST /api/reports
const createReport = async (req, res) => {
  try {
    const { description, latitude, longitude } = req.body;

    if (!req.file)
      return res.status(400).json({ message: 'Image is required' });
    if (!latitude || !longitude)
      return res.status(400).json({ message: 'GPS coordinates are required' });

    const lat = parseFloat(latitude);
    const lng = parseFloat(longitude);

    if (isNaN(lat) || isNaN(lng) || lat < -90 || lat > 90 || lng < -180 || lng > 180)
      return res.status(400).json({ message: 'Invalid coordinates' });

    // Resolve ward from GPS
    const resolved = await resolveWard(lat, lng);
    const wardName = resolved.wardName || resolved.city;
    const city = resolved.city;

    const report = await Report.create({
      citizen: req.user._id,
      imageUrl: `/uploads/${req.file.filename}`,
      description: description || '',
      location: { type: 'Point', coordinates: [lng, lat] },
      wardName,
      city,
      status: 'Pending',
      damageType: 'Evaluating'
    });

    callML(report, req.file).catch(err =>
      console.error(`ML error for report ${report._id}:`, err.message)
    );

    res.status(201).json({ message: 'Report submitted successfully', report });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

async function callML(report, file) {
  try {
    const form = new FormData();
    form.append('image', fs.createReadStream(file.path), file.originalname);
    form.append('latitude', report.location.coordinates[1].toString());
    form.append('longitude', report.location.coordinates[0].toString());

    const { data } = await axios.post(`${ML_URL}/predict`, form, {
      headers: form.getHeaders(),
      timeout: 15000
    });

    if (data.damageType === 'None' || data.severity === 0) {
      await Report.findByIdAndUpdate(report._id, { status: 'Rejected', damageType: 'Not a road image' });
      return;
    }

    await Report.findByIdAndUpdate(report._id, {
      damageType: data.damageType,
      severity: data.severity,
      urgencyScore: data.severity * 2,
      status: 'Verified'
    });
  } catch {
    // ML unreachable — report stays Pending/Evaluating, that's fine
  }
}

// GET /api/reports/map — public, no auth needed
const getMapReports = async (req, res) => {
  try {
    const reports = await Report.find(
      { status: { $in: ['Pending', 'Verified', 'In Progress', 'Resolved'] } },
      'location severity damageType status createdAt'
    ).limit(500);
    res.json(reports);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// GET /api/reports/my  — citizen's own reports
const getMyReports = async (req, res) => {
  try {
    const reports = await Report.find({ citizen: req.user._id }).sort({ createdAt: -1 });
    res.json(reports);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// GET /api/reports  — admin/ward_authority only, supports ?ward=&status=&type=
const getAllReports = async (req, res) => {
  try {
    const { ward, status, type } = req.query;
    const filter = {};
    if (ward)   filter.wardName = ward;
    if (status) filter.status   = status;
    if (type)   filter.damageType = type;

    const reports = await Report.find(filter)
      .populate('citizen', 'username')
      .sort({ createdAt: -1 });
    res.json(reports);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// GET /api/reports/stats — summary counts for dashboard
const getStats = async (req, res) => {
  try {
    const filter = {};
    // ward_authority only sees their own ward
    if (req.user.role === 'ward_authority' && req.user.wardName) {
      filter.wardName = req.user.wardName;
    }

    const [total, pending, verified, inProgress, resolved, rejected] = await Promise.all([
      Report.countDocuments(filter),
      Report.countDocuments({ ...filter, status: 'Pending' }),
      Report.countDocuments({ ...filter, status: 'Verified' }),
      Report.countDocuments({ ...filter, status: 'In Progress' }),
      Report.countDocuments({ ...filter, status: 'Resolved' }),
      Report.countDocuments({ ...filter, status: 'Rejected' })
    ]);

    // Top wards by report count
    const wardAgg = await Report.aggregate([
      { $match: filter },
      { $group: { _id: '$wardName', count: { $sum: 1 }, avgSeverity: { $avg: '$severity' } } },
      { $sort: { count: -1 } },
      { $limit: 10 }
    ]);

    res.json({ total, pending, verified, inProgress, resolved, rejected, topWards: wardAgg });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// PATCH /api/reports/:id/status — update report status
const updateReportStatus = async (req, res) => {
  try {
    const { status } = req.body;
    const allowed = ['Pending', 'Verified', 'In Progress', 'Resolved', 'Rejected'];
    if (!allowed.includes(status))
      return res.status(400).json({ message: 'Invalid status' });

    const report = await Report.findByIdAndUpdate(
      req.params.id,
      { status },
      { new: true }
    ).populate('citizen', 'username');

    if (!report) return res.status(404).json({ message: 'Report not found' });
    res.json(report);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

module.exports = { createReport, getMyReports, getAllReports, getMapReports, getStats, updateReportStatus };
