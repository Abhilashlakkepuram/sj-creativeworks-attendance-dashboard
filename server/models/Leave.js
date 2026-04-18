const mongoose = require("mongoose");

const leaveSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true
  },
  // ── Legacy fields (kept for backward compatibility) ──
  startDate: {
    type: Date,
    required: false
  },
  endDate: {
    type: Date,
    required: false
  },
  // ── New: multi-date selection ──
  selectedDates: {
    type: [Date],
    default: []
  },
  // ── New: on-behalf support ──
  appliedFor: {
    type: String,
    enum: ["self", "other"],
    default: "self"
  },
  requestedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    default: null
  },
  reason: {
    type: String,
    required: true
  },
  status: {
    type: String,
    enum: ["pending", "approved", "rejected"],
    default: "pending"
  },
  leaveType: {
    type: String,
    enum: ["paid", "unpaid"],
    default: "paid"
  },
  rejectionReason: {
    type: String,
    default: ""
  }
}, { timestamps: true });

module.exports = mongoose.model("Leave", leaveSchema);