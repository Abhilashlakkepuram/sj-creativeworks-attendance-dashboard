const express = require("express");
const router = express.Router();
const DailyReport = require("../models/DailyReport");
const User = require("../models/User");
const verifyToken = require("../middleware/authMiddleware");
const isAdmin = require("../middleware/adminMiddleware");

const SLOTS = [
  "10:00 – 11:00",
  "11:00 – 12:00",
  "12:00 – 13:00",
  "14:00 – 15:00",
  "15:00 – 16:00",
  "16:00 – 17:00",
  "17:00 – 18:00",
  "18:00 – 19:00",
];

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/reports — Employee submits daily report
// ─────────────────────────────────────────────────────────────────────────────
router.post("/", verifyToken, async (req, res) => {
  try {
    const now = new Date();
    const userId = req.user.id;
    const { hours, overallNotes, moodRating, isLeave } = req.body;

    // Today's date boundary (date only, no time)
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayEnd = new Date(today);
    todayEnd.setHours(23, 59, 59, 999);

    // ❌ Prevent duplicate
    const existing = await DailyReport.findOne({
      employeeId: userId,
      date: { $gte: today, $lte: todayEnd }
    });
    if (existing) {
      return res.status(400).json({ message: "You have already submitted today's report" });
    }

    // ✅ Validate mood
    if (!moodRating || moodRating < 1 || moodRating > 5) {
      return res.status(400).json({ message: "Mood rating must be between 1 and 5" });
    }

    // Get employee name
    const employee = await User.findById(userId).select("name");

    const report = await DailyReport.create({
      employeeId: userId,
      employeeName: employee?.name || "Unknown",
      date: today,
      hours: hours || [],
      isLeave: !!isLeave,
      overallNotes: overallNotes || "",
      moodRating,
      submittedAt: now,
    });

    res.status(201).json({ message: "Daily report submitted successfully", report });
  } catch (err) {
    if (err.code === 11000) {
      return res.status(400).json({ message: "You have already submitted today's report" });
    }
    res.status(500).json({ message: "Server error", error: err.message });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/reports/today — Employee: get today's report (or null)
// ─────────────────────────────────────────────────────────────────────────────
router.get("/today", verifyToken, async (req, res) => {
  console.log(`📥 GET /api/reports/today from user: ${req.user.id}`);
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayEnd = new Date(today);
    todayEnd.setHours(23, 59, 59, 999);

    const report = await DailyReport.findOne({
      employeeId: req.user.id,
      date: { $gte: today, $lte: todayEnd }
    });

    res.json(report || null);
  } catch (err) {
    res.status(500).json({ message: "Server error", error: err.message });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/reports — Admin: paginated list with filters
// ─────────────────────────────────────────────────────────────────────────────
router.get("/", verifyToken, isAdmin, async (req, res) => {
  try {
    const { employeeId, date, status, page = 1, limit = 10 } = req.query;
    const filter = {};

    if (employeeId) filter.employeeId = employeeId;
    if (status && status !== "all") filter.status = status;
    if (date) {
      const d = new Date(date);
      d.setHours(0, 0, 0, 0);
      const dEnd = new Date(d);
      dEnd.setHours(23, 59, 59, 999);
      filter.date = { $gte: d, $lte: dEnd };
    }

    const skip = (Number(page) - 1) * Number(limit);
    const total = await DailyReport.countDocuments(filter);

    const reports = await DailyReport.find(filter)
      .populate("employeeId", "name email")
      .sort({ submittedAt: -1 })
      .skip(skip)
      .limit(Number(limit));

    res.json({
      data: reports,
      total,
      page: Number(page),
      totalPages: Math.ceil(total / Number(limit))
    });
  } catch (err) {
    res.status(500).json({ message: "Server error", error: err.message });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/reports/:id — Admin: full report detail
// ─────────────────────────────────────────────────────────────────────────────
router.get("/:id", verifyToken, isAdmin, async (req, res) => {
  try {
    const report = await DailyReport.findById(req.params.id)
      .populate("employeeId", "name email");
    if (!report) return res.status(404).json({ message: "Report not found" });
    res.json(report);
  } catch (err) {
    res.status(500).json({ message: "Server error", error: err.message });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// PATCH /api/reports/:id/status — Admin: approve or flag
// ─────────────────────────────────────────────────────────────────────────────
router.patch("/:id/status", verifyToken, isAdmin, async (req, res) => {
  try {
    const { status, adminNote } = req.body;
    if (!["approved", "flagged"].includes(status)) {
      return res.status(400).json({ message: "Status must be 'approved' or 'flagged'" });
    }

    const report = await DailyReport.findByIdAndUpdate(
      req.params.id,
      {
        status,
        adminNote: adminNote || "",
        adminActionBy: req.user.name || req.user.id,
        adminActionAt: new Date()
      },
      { new: true }
    );

    if (!report) return res.status(404).json({ message: "Report not found" });
    res.json({ message: `Report ${status} successfully`, report });
  } catch (err) {
    res.status(500).json({ message: "Server error", error: err.message });
  }
});

module.exports = router;

