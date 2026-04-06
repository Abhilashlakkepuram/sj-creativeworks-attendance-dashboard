const User = require("../models/User");
const Attendance = require("../models/Attendance");
const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");
const { getPagination, formatPagination } = require("../utils/pagination");

// Helper: get start and end of today in LOCAL server time
const getTodayRangeHelper = () => {
    const start = new Date();
    start.setHours(0, 0, 0, 0);
    const end = new Date();
    end.setHours(23, 59, 59, 999);
    return { start, end };
};

// ─────────────────────────────────────────────────────────────────────────────
const autoCloseMissedPunchOuts = async () => {
    try {
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        // Find all records from before today that have punchIn but no punchOut
        const missed = await Attendance.find(
            {
                date: { $lt: today },
                punchIn: { $exists: true, $ne: null },
                punchOut: null,
                missedPunchOut: { $ne: true }
            }
        );

        if (missed.length > 0) {
            const targetHour = parseInt(process.env.AUTO_PUNCH_OUT_TARGET_HOUR) || 19;
            
            for (let record of missed) {
                const punchOutTime = new Date(record.date);
                punchOutTime.setHours(targetHour, 0, 0, 0);
                
                record.punchOut = punchOutTime;
                record.missedPunchOut = true;

                const diff = punchOutTime - record.punchIn;
                let minutes = Math.floor(diff / (1000 * 60));
                
                if (minutes > 300) {
                    minutes -= 60;
                }
                
                record.workMinutes = Math.max(0, minutes);

                // Update status
                const minWorkHours = parseInt(process.env.MIN_WORK_HOURS_FOR_FULL_DAY) || 8;
                const minWorkMinutes = minWorkHours * 60;
                
                if (record.workMinutes < minWorkMinutes) {
                    record.status = "half-day";
                } else {
                    record.status = "present";
                }

                await record.save();
            }
            console.log(`🕐 Auto-closed ${missed.length} missed punch-outs at ${targetHour}:00 target.`);
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
        const { page = 1, limit = 30 } = req.query;

        // Auto-close any missed punch-outs before fetching
        await autoCloseMissedPunchOuts();

        // Fetch employee info
        const employee = await User.findById(userId).select("name email createdAt").lean();
        if (!employee) {
            return res.status(404).json({ message: "Employee not found" });
        }

        // Fetch all existing DB records for this employee (no limit — we need all to fill gaps)
        const existingRecords = await Attendance.find({ user: userId })
            .sort({ date: -1 })
            .lean();

        // Build a map of date → record for quick lookup
        const recordMap = {};
        existingRecords.forEach(r => {
            const key = new Date(r.date).toISOString().split("T")[0];
            recordMap[key] = r;
        });

        // Determine date range: from employee's join date (or first record) to today
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        const joinDate = new Date(employee.createdAt);
        joinDate.setHours(0, 0, 0, 0);

        // Start from earliest: either first attendance record or join date
        const firstRecord = existingRecords.length > 0
            ? new Date(existingRecords[existingRecords.length - 1].date)
            : joinDate;
        firstRecord.setHours(0, 0, 0, 0);

        // Build complete day-by-day list from firstRecord to today
        const allDays = [];
        const cursor = new Date(today);

        while (cursor >= firstRecord) {
            const key = cursor.toISOString().split("T")[0];
            const dayOfWeek = cursor.getDay(); // 0 = Sunday, 6 = Saturday

            if (recordMap[key]) {
                // Real record exists — use it
                allDays.push(recordMap[key]);
            } else {
                // No record — mark as absent (skip Sundays if your office is closed)
                // Remove the Sunday check below if your office works on Sundays
                if (dayOfWeek !== 0) { // 0 = Sunday (optional: add 6 for Saturday too)
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

            cursor.setDate(cursor.getDate() - 1);
        }

        // Paginate
        const total = allDays.length;
        const skip = (Number(page) - 1) * Number(limit);
        const paginated = allDays.slice(skip, skip + Number(limit));

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
                total: allDays.length,
                present: allDays.filter(d => d.status === "present").length,
                late: allDays.filter(d => d.status === "late").length,
                absent: allDays.filter(d => d.status === "absent").length,
                missedPunchOut: allDays.filter(d => d.missedPunchOut).length,
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
                                cond: { $eq: ["$$a.status", "late"] }
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
                                        $gte: ["$$a.date", getTodayRangeHelper().start]
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
        const { name, email, password, role } = req.body;
        const existingUser = await User.findOne({ email });
        if (existingUser) return res.status(400).json({ message: "User already exists" });
        const hashedPassword = await bcrypt.hash(password, 10);
        const user = new User({ name, email, password: hashedPassword, role, isApproved: true });
        await user.save();
        req.app.get("io").emit("dashboard-update");
        res.status(201).json({ message: "Employee added successfully" });
    } catch (error) {
        res.status(500).json({ message: "Server error", error: error.message });
    }
};

const updateEmployee = async (req, res) => {
    try {
        const { name, email, role } = req.body;
        await User.findByIdAndUpdate(req.params.id, { name, email, role });
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
        const { status, date, search, page = 1, limit = 10 } = req.query;
        const skip = (page - 1) * limit;
        let filter = {};

        // Run auto close sync
        await autoCloseMissedPunchOuts();

        if (date) {
            const selectedDate = new Date(date);
            const start = new Date(selectedDate.setHours(0, 0, 0, 0));
            const end = new Date(selectedDate.setHours(23, 59, 59, 999));
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

        if (status === "present") filter.status = { $in: ["present", "late", "half-day"] };
        if (status === "late") filter.status = "late";

        let datesToCheck = [];
        if (date) {
            const d = new Date(date);
            datesToCheck.push({
                start: new Date(d.setHours(0, 0, 0, 0)),
                end: new Date(d.setHours(23, 59, 59, 999))
            });
        } else {
            const firstRecord = await Attendance.findOne().sort({ date: 1 });
            const startDate = firstRecord
                ? new Date(firstRecord.date)
                : new Date(new Date().setDate(new Date().getDate() - 30));

            const today = new Date();
            let current = new Date(today);
            current.setHours(0, 0, 0, 0);

            const limitDate = new Date(startDate);
            limitDate.setHours(0, 0, 0, 0);

            while (current >= limitDate) {
                datesToCheck.push({
                    start: new Date(current),
                    end: new Date(new Date(current).setHours(23, 59, 59, 999))
                });
                current.setDate(current.getDate() - 1);
            }
        }

        if (status === "absent") {
            let allAbsentRecords = [];

            const candidates = await User.find({
                ...userFilter,
                role: { $ne: "admin" },
                isApproved: true
            }).select("name email role").lean();

            const rangeStart = datesToCheck[datesToCheck.length - 1].start;
            const rangeEnd = datesToCheck[0].end;

            const existingAttendances = await Attendance.find({
                date: { $gte: rangeStart, $lte: rangeEnd }
            }).select("user date").lean();

            const presenceMap = {};
            existingAttendances.forEach(a => {
                const dateKey = a.date.toISOString().split("T")[0];
                if (!presenceMap[dateKey]) presenceMap[dateKey] = new Set();
                presenceMap[dateKey].add(a.user.toString());
            });

            for (const range of datesToCheck) {
                const dateKey = range.start.toISOString().split("T")[0];
                const presentSet = presenceMap[dateKey] || new Set();
                const absentForThisDay = candidates.filter(u => !presentSet.has(u._id.toString()));

                allAbsentRecords = allAbsentRecords.concat(
                    absentForThisDay.map(u => ({
                        _id: `absent-${u._id}-${range.start.toISOString()}`,
                        user: { _id: u._id, name: u.name, email: u.email, role: u.role },
                        status: "absent",
                        date: range.start,
                        punchIn: null,
                        punchOut: null,
                        workHours: "0.00"
                    }))
                );
            }

            const total = allAbsentRecords.length;
            const paginated = allAbsentRecords.slice(skip, skip + parseInt(limit));
            return res.json({ success: true, data: paginated, total, page: Number(page), totalPages: Math.ceil(total / limit) });
        }

        const attendance = await Attendance.find(filter)
            .populate({ path: "user", match: userFilter, select: "name email role" })
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(parseInt(limit));

        const filtered = attendance.filter(a => a.user !== null);
        const total = await Attendance.countDocuments(filter);

        res.json({ success: true, data: filtered, total, page: Number(page), totalPages: Math.ceil(total / limit) });

    } catch (error) {
        res.status(500).json({ message: "Server error", error: error.message });
    }
};

const getDashboardStats = async (req, res) => {
    try {
        const totalEmployees = await User.countDocuments({ role: { $ne: "admin" } });
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const todayAttendance = await Attendance.countDocuments({ date: today });
        const lateEmployees = await Attendance.countDocuments({ date: today, status: "late" });
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