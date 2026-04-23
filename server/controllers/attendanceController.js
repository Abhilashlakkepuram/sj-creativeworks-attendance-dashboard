const Attendance = require("../models/Attendance");
const Holiday = require("../models/Holiday");
const User = require("../models/User");
const { notifyAdmins } = require("./notificationController");
const { getDistance } = require("../utils/locationCheck.js");
const { calculateWorkingHours } = require("../utils/attendanceHelpers");

const {
    getNowIST,
    toUTC,
    getISTDateParts,
    getISTYMD,
    getTodayRange,
    isOfficeHoliday,
    isPublicHoliday,
    isBeforeJoining,
    TIMEZONE
} = require("../utils/timeHelper");

const AUTO_PUNCH_OUT_HOUR = parseInt(process.env.AUTO_PUNCH_OUT_TARGET_HOUR, 10) || 19;

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

        const now = getNowIST();

        // ✅ Check late punch-in against IST wall clock (9:15 AM Threshold)
        const istTimeParts = getISTDateParts(now);

        const isLate =
            istTimeParts.hour > 9 ||
            (istTimeParts.hour === 9 && istTimeParts.minute > 15);

        const attendance = new Attendance({
            user: userId,
            date: start,
            punchIn: now,
            status: isLate ? "late" : "present",
            isLate
        });

        await attendance.save();

        const User = require("../models/User");
        const user = await User.findById(userId);

        await notifyAdmins(
            req.app,
            isLate ? "warning" : "attendance",
            `${user?.name || "Employee"} has punched in${isLate ? " late" : ""}`,
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

        const now = getNowIST();

        // ✅ Pass timezone and cap options — consistent with cron
        const { minutes, hoursFloat, effectivePunchOut } = calculateWorkingHours(
            attendance.punchIn,
            now,
            { timeZone: TIMEZONE, targetHour: AUTO_PUNCH_OUT_HOUR }
        );

        attendance.punchOut = effectivePunchOut;
        attendance.workMinutes = Math.max(0, minutes);
        attendance.missedPunchOut = false;
        attendance.autoPunchOut = false;

        // ✅ Standardized status thresholds: 5h (Present), 2.5h (Half-Day)
        if (hoursFloat >= 5) {
            attendance.status = attendance.isLate ? "late" : "present";
        } else if (hoursFloat >= 2.5) {
            attendance.status = "half-day";
        } else {
            attendance.status = "absent";
        }

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

        // ✅ today at IST midnight as a proper UTC instant
        const { start: today } = getTodayRange();

        // 1. Fix previous days with missed punch-out
        const missed = await Attendance.find({
            user: userId,
            date: { $lt: today },
            punchIn: { $exists: true, $ne: null },
            punchOut: null,
            missedPunchOut: { $ne: true }
        });

        for (const record of missed) {
            const { effectivePunchOut, minutes } = calculateWorkingHours(
                record.punchIn,
                null,
                { timeZone: TIMEZONE, targetHour: AUTO_PUNCH_OUT_HOUR }
            );

            record.punchOut = effectivePunchOut;
            record.missedPunchOut = true;
            record.autoPunchOut = true;
            record.workMinutes = Math.max(0, minutes);
            record.status = "missed punch-out";
            await record.save();
        }

        // 2. Generate absent records for missing past workdays
        const User = require("../models/User");
        const user = await User.findById(userId);

        if (user?.createdAt) {
            // ✅ Safety Limit: Only backfill up to 30 days
            const thirtyDaysAgo = new Date(today.getTime() - 30 * 24 * 60 * 60 * 1000);

            // Start from joint date at IST midnight, but no earlier than 30 days ago
            const joinDate = new Date(user.createdAt);
            const effectiveStart = joinDate < thirtyDaysAgo ? thirtyDaysAgo : joinDate;

            const joinParts = getISTDateParts(effectiveStart);
            let cursor = toUTC(joinParts.year, joinParts.month, joinParts.day, 0, 0, 0);

            const existingRecords = await Attendance.find({
                user: userId,
                date: { $gte: cursor, $lt: today }
            });

            // ✅ Build dedup set using IST date strings
            const existingDateSet = new Set(existingRecords.map(r => getISTYMD(r.date)));

            // [NEW] Fetch holidays for this range
            const holidays = await Holiday.find({
                date: { $gte: cursor, $lte: today }
            }).lean();
            const holidayYMDs = holidays.map(h => getISTYMD(h.date));

            const absentRecordsToCreate = [];

            while (cursor < today) {
                const isOfficeOff = isOfficeHoliday(cursor);
                const isPubHoliday = isPublicHoliday(cursor, holidayYMDs);
                const isBeforeStart = isBeforeJoining(user, cursor);
                const ymd = getISTYMD(cursor);

                if (!isOfficeOff && !isPubHoliday && !isBeforeStart && !existingDateSet.has(ymd)) {
                    absentRecordsToCreate.push({
                        user: userId,
                        date: new Date(cursor), // Snap exact instance
                        status: "absent",
                        workMinutes: 0
                    });
                }

                // Advance by exactly 24 hours IST midnight
                const nextDay = new Date(cursor.getTime() + 24 * 60 * 60 * 1000);
                const nextParts = getISTDateParts(nextDay);
                cursor = toUTC(nextParts.year, nextParts.month, nextParts.day, 0, 0, 0);
            }

            if (absentRecordsToCreate.length > 0) {
                console.log(`[ATTENDANCE] Generating ${absentRecordsToCreate.length} absent records for user: ${user.name}`);
                const bulkOps = absentRecordsToCreate.map(record => ({
                    updateOne: {
                        filter: { user: record.user, date: record.date },
                        update: { $setOnInsert: record },
                        upsert: true
                    }
                }));
                await Attendance.bulkWrite(bulkOps);
            }
        }


        // 3. Return updated attendance
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
