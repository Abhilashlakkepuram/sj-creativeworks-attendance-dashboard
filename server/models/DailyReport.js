const mongoose = require("mongoose");

const dailyHourSlotSchema = new mongoose.Schema({
  slot: { type: String, required: true },
  tasksCompleted: {
    type: String,
    default: ""
  },
  blockers: { type: String, default: "" }
}, { _id: false });

const dailyReportSchema = new mongoose.Schema({
  employeeId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true
  },
  employeeName: { type: String, required: true },
  date: { type: Date, required: true },
  hours: {
    type: [dailyHourSlotSchema],
    validate: {
      validator: (v) => v.length <= 8,
      message: "Up to 8 hour slots can be submitted"
    }
  },
  isLeave: { type: Boolean, default: false },
  overallNotes: { type: String, maxlength: 500, default: "" },
  moodRating: {
    type: Number,
    required: [true, "Mood rating is required"],
    min: 1,
    max: 5
  },
  submittedAt: { type: Date, default: Date.now },
  status: {
    type: String,
    enum: ["pending", "approved", "flagged"],
    default: "pending"
  },
  adminNote: { type: String, default: "" },
  adminActionBy: { type: String, default: "" },
  adminActionAt: { type: Date }
}, { timestamps: true });

// Prevent duplicate submissions per employee per day
dailyReportSchema.index({ employeeId: 1, date: 1 }, { unique: true });

module.exports = mongoose.model("DailyReport", dailyReportSchema);
