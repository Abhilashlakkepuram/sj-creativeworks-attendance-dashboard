// controllers/attendanceController.js
const Attendance = require("../models/Attendance");
const { notifyAdmins } = require("./notificationController");
const { getDistance } = require("../utils/locationCheck.js");
const { calculateWorkingHours, getAutoPunchOutTime } = require("../utils/attendanceHelpers");

const TIMEZONE = process.env.TIMEZONE || "Asia/Kolkata";
const AUTO_PUNCH_OUT_HOUR = parseInt(process.env.AUTO_PUNCH_OUT_TARGET_HOUR, 10) || 19;

// ─── Timezone helpers ────────────────────────────────────────────────────────

// Returns the current wall-clock time in IST as a true UTC-based Date
const getNowIST = () => {
    // We want the actual current instant, not a fake local date
    return new Date();
};

// Returns start (00:00:00) and end (23:59:59) of today in IST as UTC-based Dates
const getTodayRange = () => {
    const now = new Date();

    // Get IST date parts without any setHours tricks
    const formatter = new Intl.DateTimeFormat("en-US", {
        timeZone: TIMEZONE,
        year: "numeric", month: "2-digit", day: "2-digit"
    });
    const parts = formatter.formatToParts(now).reduce((acc, p) => {
        if (p.type !== "literal") acc[p.type] = Number(p.value);
        return acc;
    }, {});

    // Build IST midnight and end-of-day as real UTC instants
    const start = toUTC(parts.year, parts.month, parts.day, 0, 0, 0);
    const end = toUTC(parts.year, parts.month, parts.day, 23, 59, 59);
    return { start, end };
};

// Converts a wall-clock IST date/time to its UTC equivalent
const toUTC = (year, month, day, hour, minute, second) => {
    // Probe the IST offset for this instant
    const probe = Date.UTC(year, month - 1, day, hour, minute, second);
    const probeDate = new Date(probe);

    const fmt = new Intl.DateTimeFormat("en-US", {
        timeZone: TIMEZONE,
        year: "numeric", month: "2-digit", day: "2-digit",
        hour: "2-digit", minute: "2-digit", second: "2-digit",
        hour12: false
    });
    const p = fmt.formatToParts(probeDate).reduce((acc, part) => {
        if (part.type !== "literal") acc[part.type] = Number(part.value);
        return acc;
    }, {});

    const probeAsUTC = Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second);
    const offsetMs = probeAsUTC - probeDate.getTime();
    return new Date(probe - offsetMs);
};

// Gets date parts (year, month, day) in IST for any UTC Date
const getISTDateParts = (date) => {
    const fmt = new Intl.DateTimeFormat("en-US", {
        timeZone: TIMEZONE,
        year: "numeric", month: "2-digit", day: "2-digit"
    });
    return fmt.formatToParts(date).reduce((acc, p) => {
        if (p.type !== "literal") acc[p.type] = Number(p.value);
        return acc;
    }, {});
};

// Returns YYYY-MM-DD string for a date in IST (for dedup set)
const getISTYMD = (date) => {
    const p = getISTDateParts(date);
    return `${p.year}-${String(p.month).padStart(2, "0")}-${String(p.day).padStart(2, "0")}`;
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

        const now = getNowIST(); // real UTC instant — no toLocaleString tricks

        // ✅ Check late punch-in against IST wall clock — get IST hours/minutes cleanly
        const istTimeParts = new Intl.DateTimeFormat("en-US", {
            timeZone: TIMEZONE,
            hour: "2-digit", minute: "2-digit", hour12: false
        }).formatToParts(now).reduce((acc, p) => {
            if (p.type !== "literal") acc[p.type] = Number(p.value);
            return acc;
        }, {});

        const isLate = istTimeParts.hour > 10 || (istTimeParts.hour === 10 && istTimeParts.minute >= 16);

        const attendance = new Attendance({
            user: userId,
            date: start,         // IST midnight, stored as correct UTC instant
            punchIn: now,        // real UTC instant
            status: "present",   // recalculated on punch-out
            isLate
        });

        await attendance.save();

        const User = require("../models/User");
        const user = await User.findById(userId);

        await notifyAdmins(
            req.app,
            "attendance",
            `${user?.name || "Employee"} has punched in`,
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
        attendance.punchOut = now;

        // ✅ Pass timezone and cap options — consistent with cron
        const { minutes, hoursFloat } = calculateWorkingHours(
            attendance.punchIn,
            now,
            { timeZone: TIMEZONE, targetHour: AUTO_PUNCH_OUT_HOUR }
        );

        attendance.workMinutes = Math.max(0, minutes);
        attendance.missedPunchOut = false;
        attendance.autoPunchOut = false;

        if (hoursFloat >= 5) {
            attendance.status = "present";
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
            // ✅ Start from the user's join date at IST midnight
            const joinParts = getISTDateParts(new Date(user.createdAt));
            let cursor = toUTC(joinParts.year, joinParts.month, joinParts.day, 0, 0, 0);

            const existingRecords = await Attendance.find({
                user: userId,
                date: { $gte: cursor, $lt: today }
            });

            // ✅ Build dedup set using IST date strings, not server local time
            const existingDateSet = new Set(existingRecords.map(r => getISTYMD(r.date)));

            const absentRecordsToCreate = [];

            while (cursor < today) {
                const parts = getISTDateParts(cursor);
                const jsDay = cursor.getUTCDay(); // 0=Sun, 6=Sat — use UTC day on the IST-midnight instant
                // Recompute from IST parts to avoid any UTC-day mismatch
                const istMidnight = new Date(Date.UTC(parts.year, parts.month - 1, parts.day, 0, 0, 0));
                const dayOfWeek = new Date(
                    `${parts.year}-${String(parts.month).padStart(2, '0')}-${String(parts.day).padStart(2, '0')}T00:00:00`
                ).getDay(); // local parse gives correct day-of-week for the date string

                const isSunday = dayOfWeek === 0;
                const isSaturday = dayOfWeek === 6;
                const isSecondSat = isSaturday && parts.day >= 8 && parts.day <= 14;

                const ymd = `${parts.year}-${String(parts.month).padStart(2, "0")}-${String(parts.day).padStart(2, "0")}`;

                if (!isSunday && !isSecondSat && !existingDateSet.has(ymd)) {
                    absentRecordsToCreate.push({
                        user: userId,
                        date: cursor,   // ✅ proper UTC instant for IST midnight
                        status: "absent",
                        workMinutes: 0
                    });
                }

                // Advance by one IST day — add 24h then snap to IST midnight to handle DST safely
                cursor = new Date(cursor.getTime() + 24 * 60 * 60 * 1000);
                const nextParts = getISTDateParts(cursor);
                cursor = toUTC(nextParts.year, nextParts.month, nextParts.day, 0, 0, 0);
            }

            if (absentRecordsToCreate.length > 0) {
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