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
  const requestId = Math.random().toString(36).substring(7);
  console.log(`[${requestId}] == FORGOT PASSWORD ==`, req.body);

  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({
        success: false,
        message: "Email is required"
      });
    }

    const user = await User.findOne({ email });

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found"
      });
    }

    // 🔐 Generate OTP
    const otp = Math.floor(100000 + Math.random() * 900000).toString();

    const hashedOTP = crypto
      .createHash("sha256")
      .update(otp)
      .digest("hex");

    user.resetOTP = hashedOTP;
    user.resetOTPExpires = Date.now() + 10 * 60 * 1000;
    user.resetAttempts = 0;

    await user.save();

    console.log(`🔐 OTP for ${email}:`, otp); // remove later

    // 🎨 Email HTML
    const html = `
    <div style="background:#f4f6f8;padding:40px;font-family:Arial;">
      <div style="max-width:500px;margin:auto;background:#fff;padding:30px;border-radius:10px;">
        <h2 style="color:#1F8B8D;text-align:center;">SJ Creativeworks</h2>
        <p>Hello <strong>${user.name}</strong>,</p>
        <p>Your OTP for password reset:</p>
        <div style="text-align:center;margin:20px 0;">
          <span style="font-size:32px;font-weight:bold;letter-spacing:5px;color:#1F8B8D;">
            ${otp}
          </span>
        </div>
        <p style="text-align:center;font-size:12px;color:#666;">
          Valid for 10 minutes
        </p>
      </div>
    </div>
    `;

    // 📧 Send Email
    const emailResult = await sendEmail(
      email.trim(),
      "Password Reset OTP - SJ Creativeworks",
      html
    );

    if (emailResult.error) {
      return res.status(500).json({
        success: false,
        message: "Failed to send OTP email",
        error: emailResult.errorMessage
      });
    }

    return res.json({
      success: true,
      message: "OTP sent successfully"
    });

  } catch (error) {
    console.error("❌ Forgot Password Error:", error.message);

    return res.status(500).json({
      success: false,
      message: "Server error"
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