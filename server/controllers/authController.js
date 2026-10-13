const User = require("../models/User");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const { notifyAdmins } = require("./notificationController");
const { issueResetOTP, consumeResetOTP } = require("../services/otpService");
const {
  EMPLOYEE_ROLES, ALL_ROLES, PASSWORD_MESSAGE, isStrongPassword, isValidEmail, normalizeEmail,
} = require("../utils/validation");

const registerUser = async (req, res) => {
  try {
    const { name, password, confirmPassword, role } = req.body || {};
    const email = normalizeEmail(req.body?.email);
    if (typeof name !== "string" || !name.trim() || name.trim().length > 100 || !isValidEmail(email)) {
      return res.status(400).json({ message: "A valid name and email are required" });
    }
    if (password !== confirmPassword) {
      return res.status(400).json({ message: "Passwords do not match" });
    }
    if (!isStrongPassword(password)) {
      return res.status(400).json({ message: PASSWORD_MESSAGE });
    }
    if (!EMPLOYEE_ROLES.includes(role)) {
      return res.status(400).json({ message: "Invalid role selected" });
    }
    if (await User.findOne({ email })) {
      return res.status(400).json({ message: "User already exists" });
    }

    await User.create({
      name: name.trim(), email, password: await bcrypt.hash(password, 10), role, isApproved: false,
    });
    await notifyAdmins(req.app, "registration",
      `New employee registration: ${name.trim()} (${role})`, "/admin/employees");
    req.app.get("io")?.emit("dashboard-update");
    return res.status(201).json({ message: "Registration successful. Wait for admin approval." });
  } catch (error) {
    if (error.code === 11000) return res.status(400).json({ message: "User already exists" });
    return res.status(500).json({ message: "Server error" });
  }
};

const loginUser = async (req, res) => {
  try {
    const email = normalizeEmail(req.body?.email);
    const password = req.body?.password;
    if (!isValidEmail(email) || typeof password !== "string" || !password || password.length > 1024) {
      return res.status(400).json({ message: "Email and password are required" });
    }
    const user = await User.findOne({ email });
    if (!user) return res.status(400).json({ message: "User not found" });
    if (!await bcrypt.compare(password, user.password)) {
      return res.status(400).json({ message: "Invalid password" });
    }
    if (user.isBlocked) return res.status(403).json({ message: "Account is blocked" });
    if (!ALL_ROLES.includes(user.role)) return res.status(403).json({ message: "Invalid account role" });
    if (!user.isApproved && user.role !== "admin") {
      return res.status(403).json({ message: "Account waiting for SJ Creativeworks admin approval" });
    }
    const token = jwt.sign(
      { id: user._id, role: user.role, name: user.name },
      process.env.JWT_SECRET,
      { expiresIn: "1d" }
    );
    return res.json({ message: "Login successful", token, role: user.role, name: user.name });
  } catch {
    return res.status(500).json({ message: "Server error" });
  }
};

const forgotPassword = async (req, res) => {
  try {
    const email = normalizeEmail(req.body?.email);
    if (!isValidEmail(email)) {
      return res.status(400).json({ success: false, message: "A valid email is required" });
    }
    await issueResetOTP(email);
    return res.json({ success: true, message: "OTP sent to your email. Please check your inbox." });
  } catch (error) {
    return res.status(error.status || 500).json({
      success: false, message: error.status ? error.message : "Server error",
    });
  }
};

const resetPassword = async (req, res) => {
  try {
    const { otp, newPassword } = req.body || {};
    const email = normalizeEmail(req.body?.email);
    if (!isValidEmail(email) || typeof otp !== "string" || !/^\d{6}$/.test(otp)) {
      return res.status(400).json({ message: "A valid email and six-digit OTP are required" });
    }
    if (!isStrongPassword(newPassword)) {
      return res.status(400).json({ message: PASSWORD_MESSAGE });
    }
    await consumeResetOTP(email, otp, newPassword);
    return res.json({ message: "Password reset successful" });
  } catch (error) {
    return res.status(error.status || 500).json({ message: error.status ? error.message : "Server error" });
  }
};

module.exports = { registerUser, loginUser, forgotPassword, resetPassword };
