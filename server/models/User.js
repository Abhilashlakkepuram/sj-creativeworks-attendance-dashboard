const mongoose = require("mongoose");

const userSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true
  },
  email: {
    type: String,
    required: true,
    unique: true
  },
  password: {
    type: String,
    required: true
  },
  role: {
    type: String,
    enum: ["developer", "seo", "designer", "marketing", "admin"],
    required: true
  },
  isApproved: {
    type: Boolean,
    default: false
  },
  isBlocked: {
    type: Boolean,
    default: false
  },
  joiningDate: {
    type: Date,
    default: Date.now
  },
  createdAt: {
    type: Date,
    default: Date.now
  },
  resetOTP: String,
  resetOTPExpires: Date,
  resetAttempts: {
    type: Number,
    default: 0
  },
  roleReadTimestamps: {
    type: Map,
    of: Date,
    default: {}
  }
});

module.exports = mongoose.model("User", userSchema);