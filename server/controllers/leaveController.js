const Leave = require("../models/Leave");
const User = require("../models/User");
const LeaveBalance = require("../models/LeaveBalance");
const { createNotification, notifyAdmins } = require("./notificationController");
const { getTodayRange, toUTC, getISTDateParts } = require("../utils/timeHelper");



// Helper: Calculate days between dates (inclusive)
const calculateDays = (startDate, endDate) => {
  const sParts = getISTDateParts(new Date(startDate));
  const eParts = getISTDateParts(new Date(endDate));
  
  const s = toUTC(sParts.year, sParts.month, sParts.day, 0, 0, 0);
  const e = toUTC(eParts.year, eParts.month, eParts.day, 0, 0, 0);

  const diff = Math.abs(e - s);
  return Math.round(diff / (1000 * 60 * 60 * 24)) + 1;
};

// Helper: Smart day count — prefers selectedDates over range
const getRequestedDays = (leave) => {
  if (leave.selectedDates && leave.selectedDates.length > 0) {
    return leave.selectedDates.length;
  }
  return calculateDays(leave.startDate, leave.endDate);
};

// Helper: Check if a date is a 2nd or 4th Saturday
const isSecondOrFourthSat = (date) => {
  const istParts = getISTDateParts(new Date(date));
  const dStr = `${istParts.year}-${String(istParts.month).padStart(2, '0')}-${String(istParts.day).padStart(2, '0')}`;
  const d = new Date(dStr);
  
  if (d.getDay() !== 6) return false; // Not Saturday
  const dayOfMonth = istParts.day;
  return (dayOfMonth >= 8 && dayOfMonth <= 14) || (dayOfMonth >= 22 && dayOfMonth <= 28);
};

const requestLeave = async (req, res) => {
  try {
    const {
      startDate, endDate, reason, leaveType = "paid",
      selectedDates, appliedFor = "self", targetUserId
    } = req.body;



    if (!reason) {
      return res.status(400).json({ message: "Reason is required" });
    }

    const today = getTodayRange().start;
    
    // Convert inputs to IST midnight instants
    const normalize = (d) => {
      const p = getISTDateParts(new Date(d));
      return toUTC(p.year, p.month, p.day, 0, 0, 0);
    };


    // ── Determine target user ──
    const targetUser =
      appliedFor === "other" && targetUserId ? targetUserId : req.user.id;

    let requestedDays;
    let leaveStartDate, leaveEndDate;

    if (selectedDates && selectedDates.length > 0) {
      // ── Multi-date path ──
      // Step 1: Deduplicate by local date string, then sort ascending
      const uniqueISOSet = new Set(selectedDates.map(d => 
        new Date(d).toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' })
      ));
      const sorted = [...uniqueISOSet]
        .map(iso => new Date(iso)) // Created as UTC midnight for consistent storage
        .sort((a, b) => a - b);

      // Step 2: Validate each date
      for (const d of sorted) {
        const normD = normalize(d);
        if (normD < today) {
          return res.status(400).json({ success: false, message: `Date ${new Date(normD).toDateString()} is in the past` });
        }
        
        const istParts = getISTDateParts(new Date(normD));
        const dateStr = `${istParts.year}-${String(istParts.month).padStart(2, '0')}-${String(istParts.day).padStart(2, '0')}`;
        const dayOfWeek = new Date(dateStr).getDay();

        if (dayOfWeek === 0) {
          return res.status(400).json({ success: false, message: `${new Date(normD).toDateString()} is a Sunday` });
        }
        if (isSecondOrFourthSat(normD)) {
          return res.status(400).json({ success: false, message: `${new Date(normD).toDateString()} is a 2nd/4th Saturday (holiday)` });
        }
      }


      // Step 3: Check overlapping with ALL non-rejected existing leaves
      const existingLeaves = await Leave.find({
        user: targetUser,
        status: { $ne: "rejected" }
      }).lean();

      const existingDateStrings = existingLeaves.flatMap(l =>
        (l.selectedDates || []).map(d => new Date(d).toISOString().split("T")[0])
      );

      const conflictDate = sorted.find(d => existingDateStrings.includes(d.toISOString().split("T")[0]));
      if (conflictDate) {
        return res.status(400).json({ success: false, message: "Some selected dates already have leave applied" });
      }

      requestedDays = sorted.length;
      leaveStartDate = sorted[0];
      leaveEndDate = sorted[sorted.length - 1];

      // Reassign sorted for saving
      selectedDates.length = 0;
      sorted.forEach(d => selectedDates.push(d));

    } else {
      // ── Legacy range path ──
      if (!startDate || !endDate) {
        return res.status(400).json({ message: "Dates are required" });
      }
      
      const start = normalize(startDate);
      const end = normalize(endDate);

      if (start < today) {
        return res.status(400).json({ success: false, message: "Leave start date cannot be in the past" });
      }
      if (end < start) {
        return res.status(400).json({ success: false, message: "Leave end date cannot be before the start date" });
      }

      requestedDays = calculateDays(start, end);
      leaveStartDate = new Date(start);
      leaveEndDate = new Date(end);
    }



    // ── Balance check (paid leaves only) ──
    let userBalance = await LeaveBalance.findOne({ user: targetUser });
    if (!userBalance) {
      userBalance = await LeaveBalance.create({ user: targetUser, balance: 2 });
    }

    if (leaveType === "paid" && requestedDays > userBalance.balance) {
      return res.status(400).json({
        success: false,
        message: `Only ${userBalance.balance} paid leave${userBalance.balance === 1 ? "" : "s"} remaining`,
      });
    }

    const leave = await Leave.create({
      user: targetUser,
      startDate: leaveStartDate,
      endDate: leaveEndDate,
      selectedDates: selectedDates || [],
      appliedFor,
      requestedBy: req.user.id,
      reason,
      leaveType,
      status: "pending",
    });

    const submitter = await User.findById(req.user.id);
    const notifyMsg = appliedFor === "other"
      ? `${submitter?.name || "Admin"} applied leave on behalf of another employee`
      : `New leave request from ${submitter?.name || "Employee"}`;

    await notifyAdmins(req.app, "leave", notifyMsg, "/admin/leaves");

    req.app.get("io").emit("leave-update");

    res.status(201).json({
      success: true,
      message: "Leave request submitted",
      data: leave,
    });

  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Server error",
      error: error.message,
    });
  }
};

// ─────────────────────────────────────────────
// 📌 Admin View All Leaves
// ─────────────────────────────────────────────
const getLeaves = async (req, res) => {
  try {
    const leaves = await Leave.find()
      .populate("user", "name email role")
      .populate("requestedBy", "name email")
      .sort({ createdAt: -1 });

    res.json({
      success: true,
      count: leaves.length,
      data: leaves,
    });

  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Server error",
      error: error.message,
    });
  }
};

// ─────────────────────────────────────────────
// 📌 Employee View My Leaves
// ─────────────────────────────────────────────
const getMyLeaves = async (req, res) => {
  try {
    // Fetch leaves where I am either the direct user OR I was the applicant for someone else
    const leaves = await Leave.find({
      $or: [
        { user: req.user.id },
        { requestedBy: req.user.id }
      ]
    })
    .populate("user", "name email role")
    .sort({ createdAt: -1 });

    res.json({
      success: true,
      data: leaves,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Server error",
      error: error.message,
    });
  }
};

// ─────────────────────────────────────────────
// 📌 Approve Leave
// ─────────────────────────────────────────────
const approveLeave = async (req, res) => {
  try {
    const leave = await Leave.findById(req.params.id).populate("user");

    if (!leave) {
      return res.status(404).json({ message: "Leave not found" });
    }

    if (leave.status !== "pending") {
      return res.status(400).json({ message: "Leave already processed" });
    }

    // ✅ Smart day count: prefer selectedDates over range
    const requestedDays = getRequestedDays(leave);

    // Deduct from balance IF PAID
    if (leave.leaveType === "paid") {
      await LeaveBalance.findOneAndUpdate(
        { user: leave.user._id },
        { $inc: { balance: -requestedDays } },
        { new: true, upsert: true }
      );
    }

    leave.status = "approved";
    await leave.save();

    req.app.get("io").emit("leave-update");

    const dateLabel = leave.selectedDates?.length > 0
      ? `${leave.selectedDates.length} selected date(s)`
      : `from ${new Date(leave.startDate).toLocaleDateString()}`;

    await createNotification(
      req.app,
      leave.user._id,
      "leave",
      `Your leave request (${dateLabel}) has been approved`,
      "/employee/leaves"
    );

    res.json({ success: true, message: "Leave approved", data: leave });

  } catch (error) {
    res.status(500).json({ success: false, message: "Server error", error: error.message });
  }
};

// ─────────────────────────────────────────────
// 📌 Reject Leave
// ─────────────────────────────────────────────
const rejectLeave = async (req, res) => {
  try {
    const { rejectionReason } = req.body || {};
    const leave = await Leave.findById(req.params.id).populate("user");

    if (!leave) {
      return res.status(404).json({ message: "Leave not found" });
    }

    if (leave.status !== "pending") {
      return res.status(400).json({ message: "Leave already processed" });
    }

    // IF IT WAS APPROVED AND PAID, REFUND THE BALANCE
    if (leave.status === "approved" && leave.leaveType === "paid") {
      const days = getRequestedDays(leave);
      await LeaveBalance.findOneAndUpdate(
        { user: leave.user._id },
        { $inc: { balance: days } }
      );
    }

    leave.status = "rejected";
    if (rejectionReason) leave.rejectionReason = rejectionReason;
    await leave.save();

    req.app.get("io").emit("leave-update");

    const dateLabel = leave.selectedDates?.length > 0
      ? `${leave.selectedDates.length} selected date(s)`
      : `from ${new Date(leave.startDate).toLocaleDateString()}`;

    let notifyMsg = `Your leave request (${dateLabel}) has been rejected`;
    if (rejectionReason) notifyMsg += `. Reason: ${rejectionReason}`;

    await createNotification(req.app, leave.user._id, "leave", notifyMsg, "/employee/leaves");

    res.json({ success: true, message: "Leave rejected", data: leave });

  } catch (error) {
    res.status(500).json({ success: false, message: "Server error", error: error.message });
  }
};

// ─────────────────────────────────────────────
// 📌 Admin Delete Leave Request
// ─────────────────────────────────────────────
const deleteLeave = async (req, res) => {
  try {
    const leave = await Leave.findById(req.params.id);

    if (!leave) {
      return res.status(404).json({ success: false, message: "Leave request not found" });
    }

    if (leave.status === "pending") {
      return res.status(400).json({ success: false, message: "Cannot delete a pending request" });
    }

    // IF IT WAS APPROVED AND PAID, REFUND BEFORE DELETING
    if (leave.status === "approved" && leave.leaveType === "paid") {
      const days = getRequestedDays(leave);
      await LeaveBalance.findOneAndUpdate(
        { user: leave.user },
        { $inc: { balance: days } }
      );
    }

    await Leave.findByIdAndDelete(req.params.id);
    req.app.get("io").emit("leave-update");

    res.json({ success: true, message: "Leave request deleted" });

  } catch (error) {
    res.status(500).json({ success: false, message: "Server error", error: error.message });
  }
};

// ─────────────────────────────────────────────
// 📌 Get My Leave Balance
// ─────────────────────────────────────────────
const getLeaveBalance = async (req, res) => {
  try {
    let balance = await LeaveBalance.findOne({ user: req.user.id });
    
    // Auto-initialize if not found
    if (!balance) {
      balance = await LeaveBalance.create({ user: req.user.id, balance: 2 });
    }

    res.json({
      success: true,
      balance: balance.balance,
      maxLimit: balance.maxLimit,
      monthlyCredit: balance.monthlyCredit
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// ─────────────────────────────────────────────
// 📌 Admin View Specific User's Leaves
// ─────────────────────────────────────────────
const getLeavesByUser = async (req, res) => {
  try {
    const leaves = await Leave.find({ user: req.params.id }).sort({ createdAt: -1 });

    res.json({
      success: true,
      data: leaves,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Server error",
      error: error.message,
    });
  }
};

// ─────────────────────────────────────────────
// 📌 Admin View Specific User's Balance
// ─────────────────────────────────────────────
const getLeaveBalanceByAdmin = async (req, res) => {
  try {
    let balance = await LeaveBalance.findOne({ user: req.params.id });

    // Auto-initialize if not found
    if (!balance) {
      balance = await LeaveBalance.create({ user: req.params.id, balance: 2 });
    }

    res.json({
      success: true,
      balance: balance.balance,
      maxLimit: balance.maxLimit,
      monthlyCredit: balance.monthlyCredit
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// ─────────────────────────────────────────────
// 📌 Get Employee List (for on-behalf dropdown — any authenticated user)
// ─────────────────────────────────────────────
const getEmployeeList = async (req, res) => {
  try {
    const employees = await User.find(
      { role: { $ne: "admin" } },
      { _id: 1, name: 1, email: 1 }  // only return what the dropdown needs
    ).sort({ name: 1 });

    res.json({ success: true, data: employees });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// ─────────────────────────────────────────────
module.exports = {
  requestLeave,
  getLeaves,
  getMyLeaves,
  getLeavesByUser,
  approveLeave,
  rejectLeave,
  deleteLeave,
  getLeaveBalance,
  getLeaveBalanceByAdmin,
  getEmployeeList,
};