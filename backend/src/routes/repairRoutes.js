const express = require('express');
const router  = express.Router();
const { createLog, getLogs } = require('../controllers/repairController');
const { protect, authorize } = require('../middlewares/auth');

// Both citizen and authority can read logs
router.get('/:reportId',  protect, getLogs);

// Only authority can create logs
router.post('/:reportId', protect, authorize('admin', 'ward_authority'), createLog);

module.exports = router;
