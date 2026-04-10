// controllers/attendanceController.js
const Attendance = require("../models/Attendance");
const { notifyAdmins } = require("./notificationController");
const { getDistance } = require("../utils/locationCheck.js");
const { calculateWorkingHours, getAttendanceStatus } = require("../utils/attendanceHelpers");

// Helper: get start and end of today in LOCAL server time
const getTodayRange = () => {
    const start = new Date();
    start.setHours(0, 0, 0, 0);
    const end = new Date();
    end.setHours(23, 59, 59, 999);
    return { start, end };
};

// ─── Punch In ────────────────────────────────────────────────────────────────
const punchIn = async (req, res) => {
    try {
        const userId = req.user.id;
        const { location } = req.body || {};

        if (!location) {
            return res.status(400).json({ message: "Location required" });
        }

        const officeLat = parseFloat(process.env.OFFICE_LAT);
        const officeLng = parseFloat(process.env.OFFICE_LNG);
        const maxDistance = parseInt(process.env.MAX_DISTANCE_METERS) || 150;

        const distance = getDistance(location.lat, location.lng, officeLat, officeLng);

        if (distance > maxDistance) {
            return res.status(403).json({
                message: `You are not in office location (${Math.round(distance)}m away)`,
            });
        }

        const { start, end } = getTodayRange();

        const existingAttendance = await Attendance.findOne({
            user: userId,
            date: { $gte: start, $lte: end }
        });

        if (existingAttendance) {
            return res.status(400).json({ message: "You already punched in today" });
        }

        const now = new Date();

        // Check late punch-in (after 10:15 AM IST)
        const indiaTime = new Date(now.toLocaleString("en-US", { timeZone: "Asia/Kolkata" }));
        const hour = indiaTime.getHours();
        const minute = indiaTime.getMinutes();

        // ✅ Status is always "present" — final status recalculated on punch-out
        let status = "present";
        let isLate = false;

        if (hour > 10 || (hour === 10 && minute >= 15)) {
            isLate = true;
        }

        const attendance = new Attendance({
            user: userId,
            date: start,
            punchIn: now,
            status,
            isLate
        });

        await attendance.save();

        const User = require("../models/User");
        const user = await User.findById(userId);

        await notifyAdmins(
            req.app,
            "attendance",
            `${user?.name || "Employee"} has punched in (${status})`,
            "/admin/attendance"
        );

        req.app.get("io").emit("dashboard-update");
        req.app.get("io").emit("attendance-update");

        res.json({ message: "Punch in successful", attendance });

    } catch (error) {
        res.status(500).json({ message: "Server error", error: error.message });
    }
};

// ─── Punch Out ───────────────────────────────────────────────────────────────
const punchOut = async (req, res) => {
    try {
        const userId = req.user.id;
        const { location } = req.body || {};

        if (!location) {
            return res.status(400).json({ message: "Location required" });
        }

        const officeLat = parseFloat(process.env.OFFICE_LAT);
        const officeLng = parseFloat(process.env.OFFICE_LNG);
        const maxDistance = parseInt(process.env.MAX_DISTANCE_METERS) || 150;

        const distance = getDistance(location.lat, location.lng, officeLat, officeLng);

        if (distance > maxDistance) {
            return res.status(403).json({
                message: `You are not in office location (${Math.round(distance)}m away)`,
            });
        }

        const { start, end } = getTodayRange();

        const attendance = await Attendance.findOne({
            user: userId,
            date: { $gte: start, $lte: end }
        });

        if (!attendance) {
            return res.status(400).json({ message: "You have not punched in today" });
        }

        if (attendance.punchOut) {
            return res.status(400).json({ message: "You already punched out today" });
        }

        const now = new Date();
        attendance.punchOut = now;

        // ✅ Calculate hours — no lunch deduction, no complicated logic
        const { minutes, hoursFloat } = calculateWorkingHours(attendance.punchIn, now);
        attendance.workMinutes = Math.max(0, minutes);

        // ✅ Status: half-day or absent if hours < 5, otherwise stay "present"
        if (hoursFloat < 5) {
            attendance.status = hoursFloat >= 2.5 ? "half-day" : "absent";
        } else {
            attendance.status = "present";
        }

        attendance.missedPunchOut = false;
        attendance.autoPunchOut = false;

        await attendance.save();

        req.app.get("io").emit("dashboard-update");
        req.app.get("io").emit("attendance-update");

        res.json({ message: "Punch out successful", attendance });

    } catch (error) {
        res.status(500).json({ message: "Server error", error: error.message });
    }
};

// ─── Get My Attendance ────────────────────────────────────────────────────────
const getMyAttendance = async (req, res) => {
    try {
        const userId = req.user.id;

        // Fix any previous days where punch-out was missed
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        const missed = await Attendance.find({
            user: userId,
            date: { $lt: today },
            punchIn: { $exists: true, $ne: null },
            punchOut: null,
            missedPunchOut: { $ne: true }
        });

        for (let record of missed) {
            // ✅ Cap hours at 7 PM of that day
            const { effectivePunchOut, minutes, hoursFloat } = calculateWorkingHours(record.punchIn, null);

            record.punchOut = effectivePunchOut;           // stored as 7 PM of that day
            record.missedPunchOut = true;
            record.autoPunchOut = true;
            record.workMinutes = Math.max(0, minutes);
            record.status = "missed punch-out";            // always "missed punch-out" for these

            await record.save();
        }

        const attendance = await Attendance.find({ user: userId })
            .sort({ date: -1 })
            .limit(30);

        res.json(attendance);

    } catch (error) {
        res.status(500).json({ message: "Server error", error: error.message });
    }
};

// ─── Get Today's Status ───────────────────────────────────────────────────────
const getTodayStatus = async (req, res) => {
    try {
        const userId = req.user.id;
        const { start, end } = getTodayRange();

        const attendance = await Attendance.findOne({
            user: userId,
            date: { $gte: start, $lte: end }
        });

        if (!attendance) {
            return res.json({ punchIn: null, punchOut: null, workMinutes: 0 });
        }

        res.json(attendance);

    } catch (error) {
        res.status(500).json({ message: "Server error", error: error.message });
    }
};

module.exports = { punchIn, punchOut, getMyAttendance, getTodayStatus };