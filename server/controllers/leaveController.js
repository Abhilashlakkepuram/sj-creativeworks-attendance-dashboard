const Leave = require("../models/Leave");
const User = require("../models/User");
const LeaveBalance = require("../models/LeaveBalance");
const mongoose = require("mongoose");
const httpError = require("../utils/httpError");
const { createNotification, notifyAdmins } = require("./notificationController");
const {
  getTodayRange, toUTC, getISTDateParts, getISTYMD, getISTDayRangeFromYMD,
} = require("../utils/timeHelper");



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
    if (leave.selectedDates.some(d => Number.isNaN(new Date(d).getTime()))) return NaN;
    return new Set(leave.selectedDates.map(getISTYMD)).size;
  }
  if (!leave.startDate || !leave.endDate || leave.endDate < leave.startDate) return NaN;
  return calculateDays(leave.startDate, leave.endDate);
};

const ensureLeaveBalance = async (userId, session) => {
  try {
    return await LeaveBalance.findOneAndUpdate(
      { user: userId },
      { $setOnInsert: { user: userId, balance: 2, monthlyCredit: 2, maxLimit: 6 } },
      { new: true, upsert: true, ...(session ? { session } : {}) }
    );
  } catch (error) {
    if (error.code !== 11000 || session) throw error;
    return LeaveBalance.findOne({ user: userId });
  }
};

const supportsMongoTransactions = () => {
  const type = mongoose.connection.getClient()?.topology?.description?.type;
  return type === "ReplicaSet" || type === "Sharded";
};

// Helper: Check if a date is a 2nd or 4th Saturday
const isSecondOrFourthSat = (date) => {
  const istParts = getISTDateParts(new Date(date));
  const dayOfWeek = new Date(Date.UTC(istParts.year, istParts.month - 1, istParts.day)).getUTCDay();
  if (dayOfWeek !== 6) return false; // Not Saturday
  const dayOfMonth = istParts.day;
  return (dayOfMonth >= 8 && dayOfMonth <= 14) || (dayOfMonth >= 22 && dayOfMonth <= 28);
};

const requestLeave = async (req, res) => {
  try {
    const {
      startDate, endDate, reason, leaveType = "paid",
      selectedDates, appliedFor = "self", targetUserId
    } = req.body || {};



    if (typeof reason !== "string" || !reason.trim() || reason.trim().length > 1000) {
      return res.status(400).json({ message: "Reason is required" });
    }
    if (!["self", "other"].includes(appliedFor)) {
      return res.status(400).json({ message: "Invalid leave applicant" });
    }
    if (!["paid", "unpaid"].includes(leaveType)) {
      return res.status(400).json({ message: "Invalid leave type" });
    }
    if (selectedDates !== undefined && !Array.isArray(selectedDates)) {
      return res.status(400).json({ message: "Selected dates must be an array" });
    }
    if (appliedFor === "other" && req.user.role !== "admin") {
      return res.status(403).json({ message: "Only admins can apply leave on behalf of another employee" });
    }

    const today = getTodayRange().start;
    
    // Convert inputs to IST midnight instants
    const normalize = (d) => {
      if (typeof d !== "string") return null;
      if (/^\d{4}-\d{2}-\d{2}$/.test(d)) {
        return getISTDayRangeFromYMD(d)?.start || null;
      }
      if (!/^\d{4}-\d{2}-\d{2}T/.test(d) || !getISTDayRangeFromYMD(d.slice(0, 10))) return null;
      const parsed = new Date(d);
      if (Number.isNaN(parsed.getTime())) return null;
      const p = getISTDateParts(parsed);
      return toUTC(p.year, p.month, p.day, 0, 0, 0);
    };


    // ── Determine target user ──
    const targetUser = appliedFor === "other" ? targetUserId : req.user.id;
    if (!mongoose.Types.ObjectId.isValid(targetUser)) {
      return res.status(400).json({ message: "Invalid employee" });
    }
    const targetEmployee = await User.findById(targetUser).select("role isApproved isBlocked").lean();
    if (!targetEmployee || (appliedFor === "other" && targetEmployee.role === "admin") ||
        !targetEmployee.isApproved || targetEmployee.isBlocked) {
      return res.status(400).json({ message: "Employee not found" });
    }

    let requestedDays;
    let leaveStartDate, leaveEndDate;
    let normalizedSelectedDates = [];

    if (selectedDates && selectedDates.length > 0) {
      // ── Multi-date path ──
      // Step 1: Deduplicate by local date string, then sort ascending
      const uniqueDates = new Map();
      for (const value of selectedDates) {
        const normalized = normalize(value);
        if (!normalized) {
          return res.status(400).json({ success: false, message: "Invalid leave date" });
        }
        uniqueDates.set(getISTYMD(normalized), normalized);
      }
      const sorted = [...uniqueDates.entries()]
        .sort((a, b) => a[1] - b[1])
        .map(([, date]) => date);

      // Step 2: Validate each date
      for (const d of sorted) {
        const normD = d;
        if (normD < today) {
          return res.status(400).json({ success: false, message: `Date ${new Date(normD).toDateString()} is in the past` });
        }
        
        const istParts = getISTDateParts(new Date(normD));
        const dayOfWeek = new Date(Date.UTC(istParts.year, istParts.month - 1, istParts.day)).getUTCDay();

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
        (l.selectedDates || []).map(d => getISTYMD(d))
      );

      const conflictDate = sorted.find(d => existingDateStrings.includes(getISTYMD(d)));
      if (conflictDate) {
        return res.status(400).json({ success: false, message: "Some selected dates already have leave applied" });
      }

      requestedDays = sorted.length;
      leaveStartDate = sorted[0];
      leaveEndDate = sorted[sorted.length - 1];

      normalizedSelectedDates = sorted;

    } else {
      // ── Legacy range path ──
      if (!startDate || !endDate) {
        return res.status(400).json({ message: "Dates are required" });
      }
      
      const start = normalize(startDate);
      const end = normalize(endDate);

      if (!start || !end) {
        return res.status(400).json({ success: false, message: "Invalid leave dates" });
      }

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
    const userBalance = await ensureLeaveBalance(targetUser);

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
      selectedDates: normalizedSelectedDates,
      appliedFor,
      requestedBy: req.user.id,
      reason: reason.trim(),
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
    });
  }
};

// ─────────────────────────────────────────────
// 📌 Approve Leave
// ─────────────────────────────────────────────
const approveLeave = async (req, res) => {
  try {
    if (!mongoose.isObjectIdOrHexString(req.params.id)) {
      return res.status(400).json({ message: "Invalid leave ID" });
    }
    let leave;
    if (supportsMongoTransactions()) {
      // A transaction prevents partial debits, double approval and races with
      // rejection/deletion when MongoDB is a replica set or sharded cluster.
      leave = await mongoose.connection.transaction(async (session) => {
      const pending = await Leave.findById(req.params.id).session(session);
      if (!pending) throw httpError(404, "Leave not found");
      if (pending.status !== "pending") throw httpError(400, "Leave already processed");
      if (!await User.exists({ _id: pending.user }).session(session)) {
        throw httpError(400, "Leave employee no longer exists");
      }
      const days = getRequestedDays(pending);
      if (!Number.isSafeInteger(days) || days <= 0) throw httpError(400, "Invalid leave dates");

      if (pending.leaveType === "paid") {
        await ensureLeaveBalance(pending.user, session);
        const debited = await LeaveBalance.findOneAndUpdate(
          { user: pending.user, balance: { $gte: days } },
          { $inc: { balance: -days } },
          { new: true, session }
        );
        if (!debited) throw httpError(400, "Insufficient paid leave balance");
      }
      const approved = await Leave.findOneAndUpdate(
        { _id: pending._id, status: "pending" },
        { $set: { status: "approved" } },
        { new: true, session, runValidators: true }
      ).populate("user", "name email role");
      if (!approved) throw httpError(400, "Leave already processed");
        return approved;
      });
    } else {
      // Standalone MongoDB (common in local development) has no transactions.
      // The conditional debit plus conditional status claim still guarantees
      // that concurrent approvals cannot drive the balance below zero.
      const pending = await Leave.findById(req.params.id).populate("user", "name email role");
      if (!pending) throw httpError(404, "Leave not found");
      if (pending.status !== "pending") throw httpError(400, "Leave already processed");
      if (!await User.exists({ _id: pending.user?._id || pending.user })) {
        throw httpError(400, "Leave employee no longer exists");
      }
      const days = getRequestedDays(pending);
      if (!Number.isSafeInteger(days) || days <= 0) throw httpError(400, "Invalid leave dates");
      let debited = false;
      if (pending.leaveType === "paid") {
        await ensureLeaveBalance(pending.user._id || pending.user);
        const updatedBalance = await LeaveBalance.findOneAndUpdate(
          { user: pending.user._id || pending.user, balance: { $gte: days } },
          { $inc: { balance: -days } },
          { new: true }
        );
        if (!updatedBalance) throw httpError(400, "Insufficient paid leave balance");
        debited = true;
      }
      leave = await Leave.findOneAndUpdate(
        { _id: pending._id, status: "pending" },
        { $set: { status: "approved" } },
        { new: true, runValidators: true }
      ).populate("user", "name email role");
      if (!leave) {
        if (debited) await LeaveBalance.findOneAndUpdate(
          { user: pending.user._id || pending.user },
          { $inc: { balance: days } }
        );
        throw httpError(400, "Leave already processed");
      }
    }

    req.app.get("io").emit("leave-update");

    const dateLabel = leave.selectedDates?.length > 0
      ? `${leave.selectedDates.length} selected date(s)`
      : `from ${new Date(leave.startDate).toLocaleDateString()}`;

    await createNotification(
      req.app,
      leave.user?._id,
      "leave",
      `Your leave request (${dateLabel}) has been approved`,
      "/employee/leaves"
    );

    res.json({ success: true, message: "Leave approved", data: leave });

  } catch (error) {
    res.status(error.status || 500).json({ success: false, message: error.status ? error.message : "Unable to approve leave" });
  }
};

// ─────────────────────────────────────────────
// 📌 Reject Leave
// ─────────────────────────────────────────────
const rejectLeave = async (req, res) => {
  try {
    const { rejectionReason } = req.body || {};
    if (!mongoose.isObjectIdOrHexString(req.params.id)) {
      return res.status(400).json({ message: "Invalid leave ID" });
    }
    if (rejectionReason !== undefined && (typeof rejectionReason !== "string" || rejectionReason.length > 1000)) {
      return res.status(400).json({ message: "Invalid rejection reason" });
    }
    const leave = await Leave.findOneAndUpdate(
      { _id: req.params.id, status: "pending" },
      { $set: { status: "rejected", rejectionReason: rejectionReason || "" } },
      { new: true, runValidators: true }
    ).populate("user", "name email role");

    if (!leave) {
      return res.status(400).json({ message: "Leave not found or already processed" });
    }

    req.app.get("io").emit("leave-update");

    const dateLabel = leave.selectedDates?.length > 0
      ? `${leave.selectedDates.length} selected date(s)`
      : `from ${new Date(leave.startDate).toLocaleDateString()}`;

    let notifyMsg = `Your leave request (${dateLabel}) has been rejected`;
    if (rejectionReason) notifyMsg += `. Reason: ${rejectionReason}`;

    await createNotification(req.app, leave.user._id, "leave", notifyMsg, "/employee/leaves");

    res.json({ success: true, message: "Leave rejected", data: leave });

  } catch (error) {
    res.status(500).json({ success: false, message: "Server error" });
  }
};

// ─────────────────────────────────────────────
// 📌 Admin Delete Leave Request
// ─────────────────────────────────────────────
const deleteLeave = async (req, res) => {
  try {
    if (!mongoose.isObjectIdOrHexString(req.params.id)) {
      return res.status(400).json({ message: "Invalid leave ID" });
    }
    if (supportsMongoTransactions()) {
      await mongoose.connection.transaction(async (session) => {
        const leave = await Leave.findById(req.params.id).session(session);
        if (!leave) throw httpError(404, "Leave request not found");
        if (leave.status === "pending") throw httpError(400, "Cannot delete a pending request");

        if (leave.status === "approved" && leave.leaveType === "paid") {
          const days = getRequestedDays(leave);
          if (!Number.isSafeInteger(days) || days <= 0) throw httpError(400, "Invalid leave dates");
          await LeaveBalance.updateOne({ user: leave.user }, { $inc: { balance: days } }, { session });
        }
        await Leave.deleteOne({ _id: leave._id }, { session });
      });
    } else {
      // Claim the document first so a concurrent delete can refund only once.
      const leave = await Leave.findOneAndDelete({
        _id: req.params.id,
        status: { $in: ["approved", "rejected"] },
      });
      if (!leave) {
        const existing = await Leave.findById(req.params.id).select("status");
        if (!existing) throw httpError(404, "Leave request not found");
        throw httpError(400, "Cannot delete a pending request");
      }
      if (leave.status === "approved" && leave.leaveType === "paid") {
        const days = getRequestedDays(leave);
        if (!Number.isSafeInteger(days) || days <= 0) throw httpError(400, "Invalid leave dates");
        await LeaveBalance.updateOne({ user: leave.user }, { $inc: { balance: days } });
      }
    }
    req.app.get("io").emit("leave-update");

    res.json({ success: true, message: "Leave request deleted" });

  } catch (error) {
    res.status(error.status || 500).json({ success: false, message: error.status ? error.message : "Unable to delete leave" });
  }
};

// ─────────────────────────────────────────────
// 📌 Get My Leave Balance
// ─────────────────────────────────────────────
const getLeaveBalance = async (req, res) => {
  try {
    const balance = await ensureLeaveBalance(req.user.id);

    res.json({
      success: true,
      balance: balance.balance,
      maxLimit: balance.maxLimit,
      monthlyCredit: balance.monthlyCredit
    });
  } catch (error) {
    res.status(500).json({ success: false, message: "Server error" });
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
    });
  }
};

// ─────────────────────────────────────────────
// 📌 Admin View Specific User's Balance
// ─────────────────────────────────────────────
const getLeaveBalanceByAdmin = async (req, res) => {
  try {
    if (!mongoose.isObjectIdOrHexString(req.params.id) || !await User.exists({ _id: req.params.id })) {
      return res.status(404).json({ message: "Employee not found" });
    }
    const balance = await ensureLeaveBalance(req.params.id);

    res.json({
      success: true,
      balance: balance.balance,
      maxLimit: balance.maxLimit,
      monthlyCredit: balance.monthlyCredit
    });
  } catch (error) {
    res.status(500).json({ success: false, message: "Server error" });
  }
};

// ─────────────────────────────────────────────
// 📌 Get Employee List (admin on-behalf dropdown)
// ─────────────────────────────────────────────
const getEmployeeList = async (req, res) => {
  try {
    const employees = await User.find(
      { role: { $ne: "admin" }, isApproved: true, isBlocked: { $ne: true } },
      { _id: 1, name: 1, email: 1 }  // only return what the dropdown needs
    ).sort({ name: 1 });

    res.json({ success: true, data: employees });
  } catch (error) {
    res.status(500).json({ success: false, message: "Server error" });
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
