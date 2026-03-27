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
    enum: ["present", "late"],
    default: "present"
  },

  isLate: {
    type: Boolean,
    default: false
  }

}, { timestamps: true });


// Compound Index (very important)
attendanceSchema.index({ user: 1, date: 1 }, { unique: true });

module.exports = mongoose.model("Attendance", attendanceSchema);