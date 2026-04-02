const express = require('express');
const router = express.Router();
const authMiddleware = require('../middleware/authMiddleware');
const {
    createReport,
    getTodayReport,
    getAllReports,
    getReportById,
    updateReportStatus
} = require('../controllers/reportController');

// All report routes require authentication
router.use(authMiddleware);

// Employee routes
router.post('/', createReport);
router.get('/today', getTodayReport);

// Admin routes
router.get('/', getAllReports);
router.get('/:id', getReportById);
router.patch('/:id/status', updateReportStatus);

module.exports = router;
