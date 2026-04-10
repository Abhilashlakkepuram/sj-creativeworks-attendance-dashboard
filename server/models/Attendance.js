// models/Attendance.js
const mongoose = require("mongoose");

const attendanceSchema = new mongoose.Schema({

  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true,
    index: true
  },

  date: {
    type: Date,
    required: true,
    index: true
  },

  punchIn: {
    type: Date
  },

  punchOut: {
    type: Date
  },

  workMinutes: {
    type: Number,
    default: 0
  },

  status: {
    type: String,
    // ✅ All lowercase — matches frontend StatusBadge keys exactly
    enum: ["present", "late present", "half-day", "absent", "missed punch-out"],
    default: "present"
  },

  isLate: {
    type: Boolean,
    default: false
  },

  isLatePunchOut: {
    type: Boolean,
    default: false
  },

  missedPunchOut: {
    type: Boolean,
    default: false
  },

  autoPunchOut: {
    type: Boolean,
    default: false
  }

}, { timestamps: true, toJSON: { virtuals: true }, toObject: { virtuals: true } });

// Virtual for formatted work hours
attendanceSchema.virtual("workHours").get(function () {
  if (!this.workMinutes) return "0h 0m";
  const hours = Math.floor(this.workMinutes / 60);
  const minutes = this.workMinutes % 60;
  return `${hours}h ${minutes}m`;
});

// Compound index: one record per user per day
attendanceSchema.index({ user: 1, date: 1 }, { unique: true });

module.exports = mongoose.model("Attendance", attendanceSchema);