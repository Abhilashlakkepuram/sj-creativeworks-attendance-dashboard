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

  // ✅ Added "absent", "half-day" to enum
  status: {
    type: String,
    enum: ["present", "late", "late present", "absent", "half-day"],
    default: "present"
  },

  isLate: {
    type: Boolean,
    default: false
  },

  // ✅ New: flags employee forgot to punch out
  missedPunchOut: {
    type: Boolean,
    default: false
  }

}, { timestamps: true });

// Compound Index
attendanceSchema.index({ user: 1, date: 1 }, { unique: true });

module.exports = mongoose.model("Attendance", attendanceSchema);