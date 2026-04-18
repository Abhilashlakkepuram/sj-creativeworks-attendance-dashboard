const User = require("../models/User");
const Attendance = require("../models/Attendance");
const Holiday = require("../models/Holiday");
const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");
const { getPagination, formatPagination } = require("../utils/pagination");
const { calculateWorkingHours } = require("../utils/attendanceHelpers");
const {
    getTodayRange,
    toUTC,
    getISTDateParts,
    getISTYMD,
    isOfficeHoliday,
    isPublicHoliday,
    isBeforeJoining
} = require("../utils/timeHelper");


// (Replacing getTodayRangeHelper with standardized version from timeHelper)


// ─────────────────────────────────────────────────────────────────────────────
const autoCloseMissedPunchOuts = async () => {
    try {
        const todayRange = getTodayRange();
        const today = todayRange.start;

        // Find all records from before today (IST) that have punchIn but no punchOut
        const missed = await Attendance.find(
            {
                date: { $lt: today },
                punchIn: { $exists: true, $ne: null },
                punchOut: null,
                missedPunchOut: { $ne: true }
            }
        );

        if (missed.length > 0) {
            const targetHour = parseInt(process.env.AUTO_PUNCH_OUT_TARGET_HOUR, 10) || 19;

            for (let record of missed) {
                const { effectivePunchOut, minutes } = calculateWorkingHours(record.punchIn, null, {
                    targetHour
                });

                record.punchOut = effectivePunchOut;
                record.missedPunchOut = true;
                record.autoPunchOut = true;
                record.workMinutes = Math.max(0, minutes);
                record.status = "missed punch-out";

                await record.save();
            }
            console.log(`🕐 Auto-closed ${missed.length} missed punch-outs (IST safe).`);
        }
    } catch (err) {
        console.error("❌ autoCloseMissedPunchOuts error:", err.message);
    }
};

// ─────────────────────────────────────────────────────────────────────────────
// ✅ FIXED: getUserAttendance
// Now fills in absent days between employee's first record and today,
// so the admin sees a complete picture including absent days.
// ─────────────────────────────────────────────────────────────────────────────
const getUserAttendance = async (req, res) => {
    try {
        const userId = req.params.id;
        const { page = 1, limit = 30, month } = req.query;

        // Auto-close any missed punch-outs before fetching
        await autoCloseMissedPunchOuts();

        // Fetch employee info
        const employee = await User.findById(userId).select("name email createdAt joiningDate").lean();
        if (!employee) {
            return res.status(404).json({ message: "Employee not found" });
        }

        // Standardized today range
        const todayRange = getTodayRange();
        const today = todayRange.start;

        // Define bounds for month or overall
        let rangeStart, rangeEnd;

        if (month) {
            const [year, m] = month.split("-").map(Number);
            rangeStart = toUTC(year, m, 1, 0, 0, 0);
            const lastDay = new Date(year, m, 0).getDate();
            rangeEnd = toUTC(year, m, lastDay, 0, 0, 0);

            if (rangeEnd > today) rangeEnd = today;
        } else {
            // Default: 30 days ago to today
            rangeEnd = today;
            rangeStart = new Date(today.getTime() - 30 * 24 * 60 * 60 * 1000);

            // But don't go before join date
            const joinDate = new Date(employee.joiningDate || employee.createdAt);
            const joinParts = getISTDateParts(joinDate);
            const joinStart = toUTC(joinParts.year, joinParts.month, joinParts.day, 0, 0, 0);
            if (rangeStart < joinStart) rangeStart = joinStart;
        }

        // Fetch records for this specific range
        const existingRecords = await Attendance.find({
            user: userId,
            date: { $gte: rangeStart, $lte: rangeEnd }
        })
            .sort({ date: -1 })
            .lean();

        // [NEW] Fetch holidays for this range
        const holidays = await Holiday.find({
            date: { $gte: rangeStart, $lte: rangeEnd }
        }).lean();
        const holidayYMDs = holidays.map(h => getISTYMD(h.date));

        // Build a map of date → record for quick lookup using YMD strings
        const recordMap = {};
        existingRecords.forEach(r => {
            const key = getISTYMD(r.date);
            recordMap[key] = r;
        });

        // Build complete day-by-day list
        const allDays = [];
        let cursor = new Date(rangeEnd);

        while (cursor >= rangeStart) {
            const key = getISTYMD(cursor);

            if (recordMap[key]) {
                allDays.push(recordMap[key]);
            } else {
                // No record — mark as absent (skip weekends/holidays and pre-joining)
                const isOfficeOff = isOfficeHoliday(cursor);
                const isPubHoliday = isPublicHoliday(cursor, holidayYMDs);
                const isBeforeStart = isBeforeJoining(employee, cursor);

                if (!isOfficeOff && !isPubHoliday && !isBeforeStart) {
                    allDays.push({
                        _id: `absent-${userId}-${key}`,
                        user: userId,
                        date: new Date(cursor),
                        punchIn: null,
                        punchOut: null,
                        workMinutes: 0,
                        status: "absent",
                        isLate: false,
                        missedPunchOut: false,
                        isVirtual: true // flag: this record doesn't exist in DB
                    });
                }
            }

            // Move back by exactly 24 hours
            cursor = new Date(cursor.getTime() - 24 * 60 * 60 * 1000);
            // Re-normalize to midnight to avoid drift (though not expected in IST)
            const prevParts = getISTDateParts(cursor);
            cursor = toUTC(prevParts.year, prevParts.month, prevParts.day, 0, 0, 0);
        }


        // Add derived field workType
        const enhancedDays = allDays.map(d => {
            let workType = "No Work";
            if (["present", "late"].includes(d.status)) workType = "Full Day";
            else if (d.status === "half-day") workType = "Half Day";
            else if (d.status === "missed punch-out") workType = "Issue";

            return { ...d, workType };
        });

        // Paginate
        const total = enhancedDays.length;
        const skip = (Number(page) - 1) * Number(limit);
        const paginated = enhancedDays.slice(skip, skip + Number(limit));

        res.json({
            data: paginated,
            total,
            page: Number(page),
            totalPages: Math.ceil(total / Number(limit)),
            employee: {
                _id: employee._id,
                name: employee.name,
                email: employee.email
            },
            // Summary stats across ALL days (not just current page)
            summary: {
                total: enhancedDays.length,
                present: enhancedDays.filter(d => ["present", "late"].includes(d.status)).length,
                late: enhancedDays.filter(d => d.status === "late").length,
                halfDay: enhancedDays.filter(d => d.status === "half-day").length,
                absent: enhancedDays.filter(d => d.status === "absent").length,
                missedPunchOut: enhancedDays.filter(d => d.status === "missed punch-out" || d.missedPunchOut).length,
                attendanceRate: enhancedDays.length > 0
                    ? Math.round((enhancedDays.filter(d => ["present", "late"].includes(d.status)).length / enhancedDays.length) * 100)
                    : 0
            }
        });

    } catch (error) {
        res.status(500).json({ message: "Server error", error: error.message });
    }
};

// ─────────────────────────────────────────────────────────────────────────────
// All other existing functions below — unchanged
// ─────────────────────────────────────────────────────────────────────────────

const getEmployees = async (req, res) => {
    console.log("== GET EMPLOYEES CALLED ==");
    try {
        const { search, role, page, limit } = req.query;
        const { skip, limit: limitNum, page: pageNum } = getPagination(page, limit);

        let match = { role: { $ne: "admin" } };

        if (role && role !== "all") match.role = role;

        if (search) {
            match.$or = [
                { name: { $regex: search, $options: "i" } },
                { email: { $regex: search, $options: "i" } }
            ];
        }

        const employees = await User.aggregate([
            { $match: match },
            {
                $lookup: {
                    from: "attendances",
                    localField: "_id",
                    foreignField: "user",
                    as: "attendance"
                }
            },
            {
                $addFields: {
                    monthlyAttendance: { $size: "$attendance" },
                    monthlyLate: {
                        $size: {
                            $filter: {
                                input: "$attendance",
                                as: "a",
                                cond: { $eq: ["$$a.isLate", true] }
                            }
                        }
                    },
                    todayRecord: {
                        $arrayElemAt: [
                            {
                                $filter: {
                                    input: "$attendance",
                                    as: "a",
                                    cond: {
                                        $gte: ["$$a.date", getTodayRange().start]
                                    }

                                }
                            },
                            0
                        ]
                    }
                }
            },
            {
                $addFields: {
                    todayStatus: { $ifNull: ["$todayRecord.status", "absent"] },
                    isLate: "$todayRecord.isLate",
                    punchIn: "$todayRecord.punchIn",
                    punchOut: "$todayRecord.punchOut"
                }
            },
            {
                $unset: ["password", "attendance", "todayRecord"]
            },
            { $skip: skip },
            { $limit: limitNum }
        ]);

        const total = await User.countDocuments(match);
        const active = await User.countDocuments({ ...match, isBlocked: false, isApproved: true });
        const blocked = await User.countDocuments({ ...match, isBlocked: true });
        const pending = await User.countDocuments({ ...match, isApproved: false });

        res.json({
            ...formatPagination(employees, total, pageNum, limitNum),
            stats: { total, active, blocked, pending }
        });

    } catch (error) {
        console.error("ERROR IN getEmployees:", error);
        res.status(500).json({ message: error.message, stack: error.stack });
    }
};

const addEmployee = async (req, res) => {
    try {
        const { name, email, password, role, joiningDate } = req.body;
        const existingUser = await User.findOne({ email });
        if (existingUser) return res.status(400).json({ message: "User already exists" });
        const hashedPassword = await bcrypt.hash(password, 10);
        const user = new User({
            name,
            email,
            password: hashedPassword,
            role,
            joiningDate: joiningDate || new Date(),
            isApproved: true
        });
        await user.save();
        req.app.get("io").emit("dashboard-update");
        res.status(201).json({ message: "Employee added successfully" });
    } catch (error) {
        res.status(500).json({ message: "Server error", error: error.message });
    }
};

const updateEmployee = async (req, res) => {
    try {
        const { name, email, role, joiningDate } = req.body;
        await User.findByIdAndUpdate(req.params.id, { name, email, role, joiningDate });
        req.app.get("io").emit("dashboard-update");
        res.json({ message: "Employee updated successfully" });
    } catch (error) {
        res.status(500).json({ message: "Server error", error: error.message });
    }
};

const deleteEmployee = async (req, res) => {
    try {
        await User.findByIdAndDelete(req.params.id);
        req.app.get("io").emit("dashboard-update");
        res.json({ message: "Employee deleted successfully" });
    } catch (error) {
        res.status(500).json({ message: "Server error", error: error.message });
    }
};

const toggleBlockUser = async (req, res) => {
    try {
        const user = await User.findById(req.params.id);
        if (!user) return res.status(404).json({ message: "User not found" });
        user.isBlocked = !user.isBlocked;
        await user.save();
        req.app.get("io").emit("dashboard-update");
        res.json({ message: `User ${user.isBlocked ? "blocked" : "unblocked"} successfully` });
    } catch (error) {
        res.status(500).json({ message: "Server error", error: error.message });
    }
};

const getEmployeeProfile = async (req, res) => {
    try {
        const user = await User.findById(req.params.id).select("-password");
        if (!user) return res.status(404).json({ message: "Employee not found" });
        res.json(user);
    } catch (error) {
        res.status(500).json({ message: "Server error", error: error.message });
    }
};

const getPendingUsers = async (req, res) => {
    try {
        const users = await User.find({ isApproved: false, role: { $ne: "admin" } }).select("-password");
        res.json(users);
    } catch (error) {
        res.status(500).json({ message: "Server error", error: error.message });
    }
};

const approveUser = async (req, res) => {
    try {
        const user = await User.findById(req.params.id);
        if (!user) return res.status(404).json({ message: "User not found" });
        if (user.role === "admin") return res.status(403).json({ message: "Admins cannot be approved through this API" });
        if (user.isApproved) return res.status(400).json({ message: "User already approved" });
        user.isApproved = true;
        await user.save();
        req.app.get("io").emit("dashboard-update");
        res.json({ message: "User approved successfully" });
    } catch (error) {
        res.status(500).json({ message: "Server error", error: error.message });
    }
};

const rejectUser = async (req, res) => {
    try {
        const user = await User.findById(req.params.id);
        if (!user) return res.status(404).json({ message: "User not found" });
        if (user.role === "admin") return res.status(403).json({ message: "Admins cannot be rejected through this API" });
        await User.findByIdAndDelete(req.params.id);
        req.app.get("io").emit("dashboard-update");
        res.json({ message: "User request rejected and removed" });
    } catch (error) {
        res.status(500).json({ message: "Server error", error: error.message });
    }
};

const getAllAttendance = async (req, res) => {
    try {
        const { status, date, search, page = 1, limit = 1000 } = req.query; // Increase default limit for admin tools
        const skip = (page - 1) * limit;
        let filter = {};

        // Run auto close sync
        await autoCloseMissedPunchOuts();

        if (date) {
            const [y, m, d] = date.split("-").map(Number);
            const start = toUTC(y, m, d, 0, 0, 0);
            const end = new Date(start.getTime() + 24 * 60 * 60 * 1000 - 1);
            filter.date = { $gte: start, $lte: end };
        }


        let userFilter = {};
        if (search) {
            userFilter = {
                $or: [
                    { name: { $regex: search, $options: "i" } },
                    { email: { $regex: search, $options: "i" } }
                ]
            };
        }

        if (status === "present") filter.status = "present";
        if (status === "late") filter.isLate = true;
        // If status is "all" or undefined, we don't strict filter by status

        let datesToCheck = [];
        const todayRange = getTodayRange();
        const todayAtMidnight = todayRange.start;

        if (date) {
            const [y, m, d] = date.split("-").map(Number);
            const start = toUTC(y, m, d, 0, 0, 0);
            const end = new Date(start.getTime() + 24 * 60 * 60 * 1000 - 1);
            datesToCheck.push({ start, end });
        } else {
            // Default: last 30 days
            let cursor = todayAtMidnight;
            for (let i = 0; i < 30; i++) {
                const start = new Date(cursor);
                const end = new Date(start.getTime() + 24 * 60 * 60 * 1000 - 1);
                datesToCheck.push({ start, end });
                cursor = new Date(cursor.getTime() - 24 * 60 * 60 * 1000);
            }
        }


        const rangeStart = datesToCheck[datesToCheck.length - 1].start;
        const rangeEnd = datesToCheck[0].end;

        // Get all real DB records matching our range and filter
        const existingAttendances = await Attendance.find({
            date: { $gte: rangeStart, $lte: rangeEnd },
            ...filter
        }).populate({ path: "user", match: userFilter, select: "name email role" }).lean();

        // [NEW] Fetch holidays for this range
        const holidays = await Holiday.find({
            date: { $gte: rangeStart, $lte: rangeEnd }
        }).lean();
        const holidayYMDs = holidays.map(h => getISTYMD(h.date));

        let allRecords = existingAttendances.filter(a => a.user !== null); // Remove if user didn't match search filter

        // Generate absent records if status is "absent" or "all"
        if (!status || status === "all" || status === "absent") {
            const candidates = await User.find({
                ...userFilter,
                role: { $ne: "admin" },
                isApproved: true
            }).select("name email role createdAt").lean();

            // We need to check who was actually present (regardless of filter) to calculate true absences
            const allRangeAttendances = await Attendance.find({
                date: { $gte: rangeStart, $lte: rangeEnd }
            }).select("user date").lean();

            const presenceMap = {};
            allRangeAttendances.forEach(a => {
                const dateKey = getISTYMD(a.date);
                if (!presenceMap[dateKey]) presenceMap[dateKey] = new Set();
                presenceMap[dateKey].add(a.user.toString());
            });

            let absentRecords = [];
            for (const range of datesToCheck) {
                const isOfficeOff = isOfficeHoliday(range.start);
                const isPubHoliday = isPublicHoliday(range.start, holidayYMDs);
                if (isOfficeOff || isPubHoliday) continue;

                const dateKey = getISTYMD(range.start);
                const presentSet = presenceMap[dateKey] || new Set();

                const validCandidates = candidates.filter(u => {
                    return !isBeforeJoining(u, range.start);
                });


                const absentForThisDay = validCandidates.filter(u => !presentSet.has(u._id.toString()));

                absentRecords = absentRecords.concat(
                    absentForThisDay.map(u => ({
                        _id: `absent-${u._id}-${range.start.toISOString()}`,
                        user: { _id: u._id, name: u.name, email: u.email, role: u.role },
                        status: "absent",
                        date: range.start,
                        punchIn: null,
                        punchOut: null,
                        workMinutes: 0
                    }))
                );
            }

            if (status === "absent") {
                allRecords = absentRecords; // Only show absent
            } else {
                allRecords = allRecords.concat(absentRecords); // Merge present/late/missed + absent
            }
        }

        // Sort all records by date descending
        allRecords.sort((a, b) => new Date(b.date) - new Date(a.date));

        const total = allRecords.length;
        const parsedLimit = parseInt(limit) || 1000;
        const paginated = allRecords.slice(skip, skip + parsedLimit);

        res.json({ success: true, data: paginated, total, page: Number(page), totalPages: Math.ceil(total / parsedLimit) });

    } catch (error) {
        res.status(500).json({ message: "Server error", error: error.message });
    }
};

const getDashboardStats = async (req, res) => {
    try {
        const totalEmployees = await User.countDocuments({ role: { $ne: "admin" } });
        const today = getTodayRange().start;
        const todayAttendance = await Attendance.countDocuments({ date: today });
        const lateEmployees = await Attendance.countDocuments({ date: today, isLate: true });
        res.json({ totalEmployees, todayAttendance, lateEmployees });

    } catch (error) {
        res.status(500).json({ message: "Server error", error: error.message });
    }
};

module.exports = {
    getEmployees,
    getPendingUsers,
    approveUser,
    rejectUser,
    getAllAttendance,
    getUserAttendance,
    getDashboardStats,
    addEmployee,
    updateEmployee,
    deleteEmployee,
    toggleBlockUser,
    getEmployeeProfile,
    autoCloseMissedPunchOuts
};
