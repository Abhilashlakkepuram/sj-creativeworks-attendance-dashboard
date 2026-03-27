const User = require("../models/User");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const { notifyAdmins } = require("./notificationController");
const crypto = require("crypto");
const sendEmail = require("../services/emailService");

const registerUser = async (req, res) => {
  console.log("== REGISTER USER CALLED ==");
  console.log("User object type:", typeof User);
  console.log("User properties:", typeof User === 'object' || typeof User === 'function' ? Object.keys(User) : null);
  console.log("User itself:", User);

  try {
    const { name, email, password, confirmPassword, role } = req.body;

    if (password !== confirmPassword) {
      return res.status(400).json({ message: "Passwords do not match" });
    }

    // check if user already exists
    const existingUser = await User.findOne({ email });

    if (existingUser) {
      return res.status(400).json({ message: "User already exists" });
    }

    // allow only employee roles
    const allowedRoles = ["developer", "seo", "designer", "marketing"];

    if (!allowedRoles.includes(role)) {
      return res.status(400).json({ message: "Invalid role selected" });
    }

    // hash password
    const hashedPassword = await bcrypt.hash(password, 10);

    // create new user
    const user = new User({
      name,
      email,
      password: hashedPassword,
      role,
      isApproved: false
    });

    await user.save();

    // 🔥 Get socket instance
    const io = req.app.get("io");

    // 🔔 Notify admins (existing function)
    await notifyAdmins(req.app, "registration", `New employee registration: ${name} (${role})`);

    io.emit("dashboard-update");

    res.status(201).json({
      message: "Registration successful. Wait for admin approval."
    });
  } catch (error) {
    res.status(500).json({
      message: "Server error",
      error: error.message
    });
  }
};

// Login User
const loginUser = async (req, res) => {

  try {

    const { email, password } = req.body;
    console.log(`== LOGIN ATTEMPT == Email: ${email}`);

    const user = await User.findOne({ email });

    if (!user) {
      console.log("❌ Login failed: User not found");
      return res.status(400).json({
        message: "User not found"
      });
    }

    const isMatch = await bcrypt.compare(password, user.password);

    if (!isMatch) {
      console.log("❌ Login failed: Invalid password");
      return res.status(400).json({
        message: "Invalid password"
      });
    }

    if (!user.isApproved && user.role !== "admin") {
      return res.status(403).json({
        message: "Account waiting for SJ Creativeworks admin approval"
      });
    }

    const token = jwt.sign(
      { id: user._id, role: user.role, name: user.name },
      process.env.JWT_SECRET,
      { expiresIn: "1d" }
    );

    res.json({
      message: "Login successful",
      token,
      role: user.role,
      name: user.name
    });

  } catch (error) {

    res.status(500).json({
      message: "Server error",
      error: error.message
    });

  }

};

const forgotPassword = async (req, res) => {

  try {

    const { email } = req.body;

    const user = await User.findOne({ email });

    if (!user) {
      return res.status(404).json({
        message: "User not found"
      });
    }

    // Generate OTP
    const otp = Math.floor(100000 + Math.random() * 900000).toString();

    // Hash OTP
    const hashedOTP = crypto
      .createHash("sha256")
      .update(otp)
      .digest("hex");

    user.resetOTP = hashedOTP;
    user.resetOTPExpires = Date.now() + 10 * 60 * 1000;
    user.resetAttempts = 0;

    await user.save();


    // HTML Email Template
    const html = `
<div style="background-color: #f4f6f8; padding: 40px 15px; font-family: 'Segoe UI', Arial, sans-serif;">
    <div style="max-width: 500px; margin: 0 auto; background-color: #ffffff; border: 1px solid #e1e5ea; border-radius: 12px; overflow: hidden; shadow: 0 4px 6px rgba(0,0,0,0.05);">
        <!-- Header -->
        <div style="padding: 30px; background-color: #ffffff; text-align: center; border-bottom: 1px solid #f0f0f0;">
            <h1 style="margin: 0; color: #1F8B8D; font-size: 24px; font-weight: 800; letter-spacing: -0.5px;">SJ Creativeworks</h1>
        </div>

        <!-- Content -->
        <div style="padding: 40px 30px;">
            <h2 style="font-size: 20px; color: #2d3748; margin: 0 0 16px; font-weight: 700; text-align: center;">Password Reset Request</h2>
            <p style="font-size: 15px; color: #4a5568; line-height: 1.6; text-align: center; margin-bottom: 30px;">
                You requested to reset your password. Use the following 6-digit verification code to complete the process:
            </p>

            <!-- OTP Box -->
            <div style="background-color: #f8fafc; border: 2px dashed #e2e8f0; border-radius: 12px; padding: 25px; text-align: center; margin-bottom: 30px;">
                <span style="font-size: 36px; font-weight: 800; color: #1F8B8D; letter-spacing: 8px; font-family: 'Courier New', monospace;">${otp}</span>
            </div>

            <p style="font-size: 13px; color: #718096; line-height: 1.6; text-align: center; margin-top: 20px;">
                This code is valid for <strong>10 minutes</strong>. If you didn't request this, please ignore this email or contact support.
            </p>
        </div>

        <!-- Footer -->
        <div style="padding: 20px 30px; background-color: #fafbfc; border-top: 1px solid #f0f0f0; text-align: center;">
            <p style="font-size: 12px; color: #a0aec0; margin: 0;">
                © ${new Date().getFullYear()} SJ Creativeworks Dashboard. All rights reserved.
            </p>
        </div>
    </div>
</div>
`;

    await sendEmail(email, "Password Reset OTP - SJ Creativeworks", html);

    res.json({
      message: "OTP sent to email"
    });

  } catch (error) {
    res.status(500).json({
      message: "Server error",
      error: error.message
    });
  }
};

const resetPassword = async (req, res) => {

  try {

    const { email, otp, newPassword } = req.body;

    const user = await User.findOne({ email });

    if (!user) {
      return res.status(404).json({
        message: "User not found"
      });
    }

    if (user.resetAttempts >= 5) {
      return res.status(403).json({
        message: "Too many attempts"
      });
    }

    const hashedOTP = crypto
      .createHash("sha256")
      .update(otp)
      .digest("hex");

    if (user.resetOTP !== hashedOTP) {

      user.resetAttempts += 1;
      await user.save();

      return res.status(400).json({
        message: "Invalid OTP"
      });

    }

    if (Date.now() > user.resetOTPExpires) {
      return res.status(400).json({
        message: "OTP expired"
      });
    }

    // hash new password
    const hashedPassword = await bcrypt.hash(newPassword, 10);

    user.password = hashedPassword;
    user.resetOTP = undefined;
    user.resetOTPExpires = undefined;
    user.resetAttempts = 0;

    await user.save();

    res.json({
      message: "Password reset successful"
    });

  } catch (error) {

    res.status(500).json({
      message: "Server error",
      error: error.message
    });

  }

};

module.exports = {
  registerUser,
  loginUser,
  forgotPassword,
  resetPassword
};