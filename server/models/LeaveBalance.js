const mongoose = require("mongoose");

const leaveBalanceSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true,
    unique: true
  },
  balance: {
    type: Number,
    default: 2
  },
  monthlyCredit: {
    type: Number,
    default: 2
  },
  maxLimit: {
    type: Number,
    default: 6
  },
  lastCreditedMonth: {
    type: String, // format: "YYYY-MM"
    default: ""
  }
}, { timestamps: true });

module.exports = mongoose.model("LeaveBalance", leaveBalanceSchema);
