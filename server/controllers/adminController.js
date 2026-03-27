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

// Get all approved employees with attendance stats
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
            // --- FIX APPLIED HERE ---
            // 1. Add the computed fields based on todayRecord
            {
                $addFields: {
                    todayStatus: { $ifNull: ["$todayRecord.status", "absent"] },
                    punchIn: "$todayRecord.punchIn",
                    punchOut: "$todayRecord.punchOut"
                }
            },
            // 2. Remove the sensitive or bulky data you don't want to send to the client
            {
                $unset: [
                    "password",
                    "attendance",
                    "todayRecord" // Optional: removes the raw record since we extracted the fields we need
                ]
            },
            // ------------------------
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

// Add New Employee
const addEmployee = async (req, res) => {
    try {
        const { name, email, password, role } = req.body;
        const existingUser = await User.findOne({ email });
        if (existingUser) {
            return res.status(400).json({ message: "User already exists" });
        }
        const hashedPassword = await bcrypt.hash(password, 10);
        const user = new User({
            name,
            email,
            password: hashedPassword,
            role,
            isApproved: true
        });
        await user.save();

        // 🚀 Real-time Update
        req.app.get("io").emit("dashboard-update");

        res.status(201).json({ message: "Employee added successfully" });
    } catch (error) {
        res.status(500).json({ message: "Server error", error: error.message });
    }
};

// Update Employee Details
const updateEmployee = async (req, res) => {
    try {
        const { name, email, role } = req.body;
        await User.findByIdAndUpdate(req.params.id, { name, email, role });

        // 🚀 Real-time Update
        req.app.get("io").emit("dashboard-update");

        res.json({ message: "Employee updated successfully" });
    } catch (error) {
        res.status(500).json({ message: "Server error", error: error.message });
    }
};

// Delete Employee
const deleteEmployee = async (req, res) => {
    try {
        await User.findByIdAndDelete(req.params.id);

        // 🚀 Real-time Update
        req.app.get("io").emit("dashboard-update");

        res.json({ message: "Employee deleted successfully" });
    } catch (error) {
        res.status(500).json({ message: "Server error", error: error.message });
    }
};

// Toggle Block/Unblock User
const toggleBlockUser = async (req, res) => {
    try {
        const user = await User.findById(req.params.id);
        if (!user) return res.status(404).json({ message: "User not found" });
        user.isBlocked = !user.isBlocked;
        await user.save();

        // 🚀 Real-time Update
        req.app.get("io").emit("dashboard-update");

        res.json({ message: `User ${user.isBlocked ? "blocked" : "unblocked"} successfully` });
    } catch (error) {
        res.status(500).json({ message: "Server error", error: error.message });
    }
};

// Get Single Employee Profile
const getEmployeeProfile = async (req, res) => {
    try {
        const user = await User.findById(req.params.id).select("-password");
        if (!user) {
            return res.status(404).json({ message: "Employee not found" });
        }
        res.json(user);
    } catch (error) {
        res.status(500).json({ message: "Server error", error: error.message });
    }
};

// Get all pending employees
const getPendingUsers = async (req, res) => {

    try {

        const users = await User.find({
            isApproved: false,
            role: { $ne: "admin" }
        }).select("-password");

        res.json(users);

    } catch (error) {

        res.status(500).json({
            message: "Server error",
            error: error.message
        });

    }

};


// Approve employee
const approveUser = async (req, res) => {

    try {

        const user = await User.findById(req.params.id);

        if (!user) {
            return res.status(404).json({
                message: "User not found"
            });
        }

        // prevent approving admin
        if (user.role === "admin") {
            return res.status(403).json({
                message: "Admins cannot be approved through this API"
            });
        }

        // prevent approving again
        if (user.isApproved) {
            return res.status(400).json({
                message: "User already approved"
            });
        }

        user.isApproved = true;

        await user.save();

        // 🚀 Real-time Update
        req.app.get("io").emit("dashboard-update");

        res.json({
            message: "User approved successfully"
        });

    } catch (error) {

        res.status(500).json({
            message: "Server error",
            error: error.message
        });

    }

};
const rejectUser = async (req, res) => {
    try {
        const user = await User.findById(req.params.id);

        if (!user) {
            return res.status(404).json({
                message: "User not found"
            });
        }

        // prevent rejecting admin
        if (user.role === "admin") {
            return res.status(403).json({
                message: "Admins cannot be rejected through this API"
            });
        }

        await User.findByIdAndDelete(req.params.id);

        // 🚀 Real-time Update
        req.app.get("io").emit("dashboard-update");

        res.json({
            message: "User request rejected and removed"
        });

    } catch (error) {
        res.status(500).json({
            message: "Server error",
            error: error.message
        });
    }
};

const getAllAttendance = async (req, res) => {
    try {
        const { status, date, search, page = 1, limit = 10 } = req.query;

        const skip = (page - 1) * limit;

        let filter = {};

        // 📅 DATE FILTER
        if (date) {
            const selectedDate = new Date(date);
            const start = new Date(selectedDate.setHours(0, 0, 0, 0));
            const end = new Date(selectedDate.setHours(23, 59, 59, 999));

            filter.date = { $gte: start, $lte: end };
        }

        // 🔍 SEARCH FILTER (name/email)
        let userFilter = {};
        if (search) {
            userFilter = {
                $or: [
                    { name: { $regex: search, $options: "i" } },
                    { email: { $regex: search, $options: "i" } }
                ]
            };
        }

        // 🧠 STATUS FILTER (IMPORTANT LOGIC)
        if (status === "present") {
            filter.status = { $in: ["present", "late"] }; // include late
        }

        if (status === "late") {
            filter.status = "late";
        }

        // 📅 DATE RANGE FOR ABSENT LOGIC
        let datesToCheck = [];
        if (date) {
            const d = new Date(date);
            datesToCheck.push({
                start: new Date(d.setHours(0, 0, 0, 0)),
                end: new Date(d.setHours(23, 59, 59, 999))
            });
        } else {
            // Find earliest date according to DB
            const firstRecord = await Attendance.findOne().sort({ date: 1 });
            const startDate = firstRecord ? new Date(firstRecord.date) : new Date(new Date().setDate(new Date().getDate() - 30));

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

        // 🔴 ABSENT LOGIC (SPECIAL CASE)
        if (status === "absent") {
            let allAbsentRecords = [];

            // Get all candidate users once
            const candidates = await User.find({
                ...userFilter,
                role: { $ne: "admin" },
                isApproved: true
            }).select("name email role").lean();

            // Pre-fetch all relevant attendances for the requested date range to avoid N queries
            const rangeStart = datesToCheck[datesToCheck.length - 1].start;
            const rangeEnd = datesToCheck[0].end;

            const existingAttendances = await Attendance.find({
                date: { $gte: rangeStart, $lte: rangeEnd }
            }).select("user date").lean();

            // Create a date-based lookup map for faster checking
            const presenceMap = {};
            existingAttendances.forEach(a => {
                const dateKey = a.date.toISOString().split('T')[0];
                if (!presenceMap[dateKey]) presenceMap[dateKey] = new Set();
                presenceMap[dateKey].add(a.user.toString());
            });

            for (const range of datesToCheck) {
                const dateKey = range.start.toISOString().split('T')[0];
                const presentSet = presenceMap[dateKey] || new Set();

                const absentForThisDay = candidates.filter(u => !presentSet.has(u._id.toString()));

                const dailyRecords = absentForThisDay.map(u => ({
                    _id: `absent-${u._id}-${range.start.toISOString()}`,
                    user: {
                        _id: u._id,
                        name: u.name,
                        email: u.email,
                        role: u.role
                    },
                    status: "absent",
                    date: range.start,
                    punchIn: null,
                    punchOut: null,
                    workHours: "0.00"
                }));

                allAbsentRecords = allAbsentRecords.concat(dailyRecords);
            }

            // Pagination for absent (client side pagination simulation)
            const total = allAbsentRecords.length;
            const paginated = allAbsentRecords.slice(skip, skip + parseInt(limit));

            return res.json({
                success: true,
                data: paginated,
                total,
                page: Number(page),
                totalPages: Math.ceil(total / limit)
            });
        }

        // ✅ NORMAL QUERY (Present/Late/All)
        const attendance = await Attendance.find(filter)
            .populate({
                path: "user",
                match: userFilter,
                select: "name email role"
            })
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(parseInt(limit));

        // Remove null users (after search filter)
        const filtered = attendance.filter(a => a.user !== null);

        // If status is "all" and it's for Today, we should ideally merge absent too...
        // But for now, we'll keep the existing logic and just ensure names show up in "Absent" view.

        const total = await Attendance.countDocuments(filter);

        res.json({
            success: true,
            data: filtered,
            total,
            page: Number(page),
            totalPages: Math.ceil(total / limit)
        });

    } catch (error) {
        res.status(500).json({
            message: "Server error",
            error: error.message
        });
    }
};
const getUserAttendance = async (req, res) => {
    try {
        const userId = req.params.id;
        const { page = 1, limit = 10 } = req.query;

        const skip = (page - 1) * limit;

        const attendance = await Attendance.find({ user: userId })
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(parseInt(limit));

        const total = await Attendance.countDocuments({ user: userId });

        res.json({
            data: attendance,
            total,
            page: Number(page),
            totalPages: Math.ceil(total / limit)
        });

    } catch (error) {
        res.status(500).json({
            message: "Server error",
            error: error.message
        });
    }
};

const getDashboardStats = async (req, res) => {

    try {

        const totalEmployees = await User.countDocuments({
            role: { $ne: "admin" }
        });

        const today = new Date();
        today.setHours(0, 0, 0, 0);

        const todayAttendance = await Attendance.countDocuments({
            date: today
        });

        const lateEmployees = await Attendance.countDocuments({
            date: today,
            status: "late"
        });

        res.json({
            totalEmployees,
            todayAttendance,
            lateEmployees
        });

    } catch (error) {

        res.status(500).json({
            message: "Server error",
            error: error.message
        });

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
    getEmployeeProfile
};