const Leave = require("../models/Leave");
const User = require("../models/User");
const { createNotification, notifyAdmins } = require("./notificationController");

// ─────────────────────────────────────────────
// 📌 Employee Request Leave
// ─────────────────────────────────────────────
const requestLeave = async (req, res) => {
  try {
    const { startDate, endDate, reason } = req.body;

    if (!startDate || !endDate || !reason) {
      return res.status(400).json({
        message: "All fields are required",
      });
    }

    // MNC standard validation: prevent past dates and invalid ranges
    const start = new Date(startDate);
    const end = new Date(endDate);
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    if (start < today) {
      return res.status(400).json({
        success: false,
        message: "Leave start date cannot be in the past",
      });
    }

    if (end < start) {
      return res.status(400).json({
        success: false,
        message: "Leave end date cannot be before the start date",
      });
    }

    const leave = await Leave.create({
      user: req.user.id,
      startDate,
      endDate,
      reason,
      status: "pending",
    });

    const user = await User.findById(req.user.id);

    // 🔔 Notify Admins (DB + socket handled inside)
    await notifyAdmins(
      req.app,
      "leave",
      `New leave request from ${user?.name || "Employee"}`,
      "/admin/leaves"
    );

    // 🚀 REAL-TIME UPDATE
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
    const leaves = await Leave.find({ user: req.user.id }).sort({ createdAt: -1 });

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
      return res.status(404).json({
        message: "Leave not found",
      });
    }

    if (leave.status !== "pending") {
      return res.status(400).json({
        message: "Leave already processed",
      });
    }

    leave.status = "approved";
    await leave.save();

    // 🚀 Real-time update
    req.app.get("io").emit("leave-update");

    // 📩 Notify employee
    await createNotification(
      req.app,
      leave.user._id,
      "leave",
      `Your leave request from ${new Date(leave.startDate).toLocaleDateString()} has been approved`,
      "/employee/leaves"
    );

    res.json({
      success: true,
      message: "Leave approved",
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
// 📌 Reject Leave
// ─────────────────────────────────────────────
const rejectLeave = async (req, res) => {
  try {
    const { rejectionReason } = req.body || {};
    const leave = await Leave.findById(req.params.id).populate("user");

    if (!leave) {
      return res.status(404).json({
        message: "Leave not found",
      });
    }

    if (leave.status !== "pending") {
      return res.status(400).json({
        message: "Leave already processed",
      });
    }

    leave.status = "rejected";
    if (rejectionReason) {
      leave.rejectionReason = rejectionReason;
    }
    await leave.save();

    // 🚀 Real-time update
    req.app.get("io").emit("leave-update");

    let notifyMsg = `Your leave request from ${new Date(leave.startDate).toLocaleDateString()} has been rejected`;
    if (rejectionReason) notifyMsg += `. Reason: ${rejectionReason}`;

    // 📩 Notify employee
    await createNotification(
      req.app,
      leave.user._id,
      "leave",
      notifyMsg,
      "/employee/leaves"
    );

    res.json({
      success: true,
      message: "Leave rejected",
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
// 📌 Admin Delete Leave Request
// ─────────────────────────────────────────────
const deleteLeave = async (req, res) => {
  try {
    const leave = await Leave.findById(req.params.id);

    if (!leave) {
      return res.status(404).json({
        success: false,
        message: "Leave request not found",
      });
    }

    // prevent deleting pending requests
    if (leave.status === "pending") {
      return res.status(400).json({
        success: false,
        message: "Cannot delete a pending request",
      });
    }

    await Leave.findByIdAndDelete(req.params.id);

    // 🚀 Real-time update
    req.app.get("io").emit("leave-update");

    res.json({
      success: true,
      message: "Leave request deleted",
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
module.exports = {
  requestLeave,
  getLeaves,
  getMyLeaves,
  approveLeave,
  rejectLeave,
  deleteLeave,
};