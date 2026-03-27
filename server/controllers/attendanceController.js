const Attendance = require("../models/Attendance");
const { notifyAdmins } = require("./notificationController");
const { getDistance } = require("../utils/locationCheck.js");

// Helper: get start and end of today in LOCAL server time
const getTodayRange = () => {
    const start = new Date();
    start.setHours(0, 0, 0, 0);
    const end = new Date();
    end.setHours(23, 59, 59, 999);
    return { start, end };
};

// Punch In
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

        const distance = getDistance(
            location.lat,
            location.lng,
            officeLat,
            officeLng
        );
        console.log("Distance:", distance);
        console.log(officeLat, officeLng);
        console.log(location.lat, location.lng);
        if (distance > maxDistance) {
            return res.status(403).json({
                message: `You are not in office location (${Math.round(distance)}m away)`,
            });
        }

        // ❌ IP VALIDATION DISABLED (Using GPS only)
        /*
        const userIP = req.ip.replace('::ffff:', '');
        const allowedIPs = process.env.OFFICE_IP ? process.env.OFFICE_IP.split(',') : [];

        if (allowedIPs.length > 0 && !allowedIPs.includes(userIP)) {
            return res.status(403).json({
                message: `Connect to office network (Your IP: ${userIP})`,
            });
        }
        */

        const { start, end } = getTodayRange();

        const existingAttendance = await Attendance.findOne({
            user: userId,
            date: { $gte: start, $lte: end }
        });

        if (existingAttendance) {
            return res.status(400).json({
                message: "You already punched in today"
            });
        }

        const now = new Date();

        let status = "present";
        let isLate = false;

        if (now.getHours() > 10 || (now.getHours() === 10 && now.getMinutes() >= 15)) {
            status = "late";
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

        await notifyAdmins(req.app, "attendance", `${user?.name || "Employee"} has punched in (${status})`);
        
        // 🚀 Real-time Update
        req.app.get("io").emit("dashboard-update");
        req.app.get("io").emit("attendance-update");

        res.json({
            message: "Punch in successful",
            attendance
        });

    } catch (error) {
        res.status(500).json({
            message: "Server error",
            error: error.message
        });
    }
};

// Punch Out
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

        const distance = getDistance(
            location.lat,
            location.lng,
            officeLat,
            officeLng
        );
        console.log("Distance:", distance);
        console.log(officeLat, officeLng);
        console.log(location.lat, location.lng);

        if (distance > maxDistance) {
            return res.status(403).json({
                message: `You are not in office location (${Math.round(distance)}m away)`,
            });
        }

        // ❌ IP VALIDATION DISABLED (Using GPS only)
        /*
        const rawIP =
            req.headers['x-forwarded-for']?.split(',')[0] ||
            req.socket.remoteAddress ||
            req.ip;

        const cleanIP = rawIP.replace('::ffff:', '');

        if (!["127.0.0.1", "::1"].includes(cleanIP)) {
            if (process.env.OFFICE_IP && cleanIP !== process.env.OFFICE_IP) {
                return res.status(403).json({
                    message: `Connect to office network`,
                });
            }
        }
        */

        const { start, end } = getTodayRange();

        const attendance = await Attendance.findOne({
            user: userId,
            date: { $gte: start, $lte: end }
        });

        if (!attendance) {
            return res.status(400).json({
                message: "You have not punched in today"
            });
        }

        if (attendance.punchOut) {
            return res.status(400).json({
                message: "You already punched out today"
            });
        }

        const now = new Date();
        attendance.punchOut = now;

        const diff = now - attendance.punchIn;
        const minutes = Math.floor(diff / (1000 * 60));

        attendance.workMinutes = Math.max(0, minutes);

        await attendance.save();

        // 🚀 Real-time Update
        req.app.get("io").emit("dashboard-update");
        req.app.get("io").emit("attendance-update");

        res.json({
            message: "Punch out successful",
            attendance
        });

    } catch (error) {
        res.status(500).json({
            message: "Server error",
            error: error.message
        });
    }
};

const getMyAttendance = async (req, res) => {
    try {
        const userId = req.user.id;

        const attendance = await Attendance.find({ user: userId })
            .sort({ date: -1 })
            .limit(30);

        res.json(attendance);

    } catch (error) {
        res.status(500).json({
            message: "Server error",
            error: error.message
        });
    }
};

const getTodayStatus = async (req, res) => {
    try {
        const userId = req.user.id;
        const { start, end } = getTodayRange();

        const attendance = await Attendance.findOne({
            user: userId,
            date: { $gte: start, $lte: end }
        });

        if (!attendance) {
            return res.json({
                punchIn: null,
                punchOut: null,
                workMinutes: 0
            });
        }

        res.json(attendance);

    } catch (error) {
        res.status(500).json({
            message: "Server error",
            error: error.message
        });
    }
};

module.exports = {
    punchIn,
    punchOut,
    getMyAttendance,
    getTodayStatus
};