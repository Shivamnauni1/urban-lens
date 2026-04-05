const express = require('express');
const router = express.Router();
const {
  createReport, getMyReports, getAllReports,
  getMapReports, getStats, updateReportStatus
} = require('../controllers/reportController');
const { protect, authorize } = require('../middlewares/auth');
const upload = require('../middlewares/upload');

router.get('/map',   getMapReports);                                              // public
router.get('/my',    protect, getMyReports);                                      // citizen
router.get('/stats', protect, authorize('admin', 'ward_authority'), getStats);    // authority
router.post('/',     protect, upload.single('image'), createReport);              // citizen
router.get('/',      protect, authorize('admin', 'ward_authority'), getAllReports);// authority
router.patch('/:id/status', protect, authorize('admin', 'ward_authority'), updateReportStatus);

module.exports = router;
