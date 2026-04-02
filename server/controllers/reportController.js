const ShiftReport = require('../models/ShiftReport');
const { getShiftSlots, isSubmissionAllowed } = require('../utils/shiftUtils');
const User = require('../models/User');

// POST /api/reports - allow employee to submit once
const createReport = async (req, res) => {
    try {
        const employeeId = req.user.id;
        const employee = await User.findById(employeeId);
        
        if (!employee) {
             return res.status(404).json({ message: "Employee not found." });
        }

        const today = new Date();
        today.setHours(0, 0, 0, 0);

        // Check if report already exists for today
        const existingReport = await ShiftReport.findOne({
            employeeId,
            date: today
        });

        if (existingReport) {
            return res.status(400).json({ message: "You have already submitted a report for today." });
        }

        const { hours, overallNotes, moodRating } = req.body;

        if (!hours || !Array.isArray(hours) || hours.length !== 8) {
            return res.status(400).json({ message: "Invalid hours data. Exactly 8 slots required." });
        }

        const fixedSlots = getShiftSlots();
        for (let i = 0; i < 8; i++) {
            const h = hours[i];
            if (h.slot !== fixedSlots[i]) {
                return res.status(400).json({ message: `Slot mismatch. Expected ${fixedSlots[i]}, got ${h.slot}` });
            }
            if (!h.tasksCompleted || h.tasksCompleted.length < 10) {
                return res.status(400).json({ message: `Tasks completed for slot ${fixedSlots[i]} must be at least 10 characters.` });
            }
        }

        const report = new ShiftReport({
            employeeId,
            employeeName: employee.name,
            date: today,
            hours,
            overallNotes: overallNotes ? overallNotes.substring(0, 500) : ""
        });

        await report.save();
        res.status(201).json(report);
    } catch (error) {
        res.status(500).json({ message: "Server error", error: error.message });
    }
};

// GET /api/reports/today - get logged-in user's report for today
const getTodayReport = async (req, res) => {
    try {
        const employeeId = req.user.id;
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        const report = await ShiftReport.findOne({ employeeId, date: today });
        res.json(report);
    } catch (error) {
        res.status(500).json({ message: "Server error", error: error.message });
    }
};

// GET /api/reports - get all reports (admin)
const getAllReports = async (req, res) => {
    try {
        if (req.user.role !== 'admin') {
            return res.status(403).json({ message: "Admin access required." });
        }

        const { employeeId, date, status, page = 1, limit = 10 } = req.query;
        let query = {};

        if (employeeId && employeeId !== 'all') {
            query.employeeId = employeeId;
        }

        if (date) {
            const queryDate = new Date(date);
            queryDate.setHours(0, 0, 0, 0);
            query.date = queryDate;
        }

        if (status && status !== 'All') {
            query.status = status.toLowerCase();
        }

        const skip = (parseInt(page) - 1) * parseInt(limit);

        const reports = await ShiftReport.find(query)
            .populate('employeeId', 'name email')
            .sort({ submittedAt: -1 })
            .skip(skip)
            .limit(parseInt(limit));

        const total = await ShiftReport.countDocuments(query);

        res.json({
            data: reports,
            total,
            page: parseInt(page),
            totalPages: Math.ceil(total / parseInt(limit))
        });
    } catch (error) {
        console.error("Error fetching reports:", error);
        res.status(500).json({ message: "Server error", error: error.message });
    }
};

// GET /api/reports/:id - get single report (admin)
const getReportById = async (req, res) => {
    try {
        if (req.user.role !== 'admin') {
            return res.status(403).json({ message: "Admin access required." });
        }

        const report = await ShiftReport.findById(req.params.id)
            .populate('employeeId', 'name email');

        if (!report) {
            return res.status(404).json({ message: "Report not found." });
        }

        res.json(report);
    } catch (error) {
        res.status(500).json({ message: "Server error", error: error.message });
    }
};

// PATCH /api/reports/:id/status - update status (admin)
const updateReportStatus = async (req, res) => {
    try {
        if (req.user.role !== 'admin') {
            return res.status(403).json({ message: "Admin access required." });
        }

        const { status, adminNote } = req.body;
        
        if (!['approved', 'flagged'].includes(status)) {
            return res.status(400).json({ message: "Invalid status." });
        }

        const report = await ShiftReport.findById(req.params.id);
        if (!report) return res.status(404).json({ message: "Report not found." });

        report.status = status;
        if (adminNote !== undefined) {
             report.adminNote = adminNote;
        }

        await report.save();
        res.json({ message: `Report marked as ${status}`, report });
    } catch (error) {
        res.status(500).json({ message: "Server error", error: error.message });
    }
};

module.exports = {
    createReport,
    getTodayReport,
    getAllReports,
    getReportById,
    updateReportStatus
};
