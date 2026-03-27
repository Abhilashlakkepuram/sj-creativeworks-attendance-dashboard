const express = require("express");
const router = express.Router();

const {
    punchIn,
    punchOut,
    getMyAttendance,
    getTodayStatus
} = require("../controllers/attendanceController");

const verifyToken = require("../middleware/authMiddleware");

router.post("/punch-in", verifyToken, punchIn);

router.post("/punch-out", verifyToken, punchOut);

router.get("/my-attendance", verifyToken, getMyAttendance);

router.get("/today-status", verifyToken, getTodayStatus);

module.exports = router;