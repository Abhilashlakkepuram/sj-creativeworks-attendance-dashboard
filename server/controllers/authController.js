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


    const logoUrl = "https://sjcreativeworks.com/wp-content/uploads/2024/04/latestup-scaled.png"; // Replace with your actual hosted logo URL

    const html = `
<div style="background-color: #f4f6f8; padding: 40px 15px; font-family: 'Segoe UI', Arial, sans-serif;">

    <div style="max-width: 620px; margin: 0 auto; background-color: #ffffff; border: 1px solid #e1e5ea; border-radius: 6px;">
        
        <!-- Header -->
        <div style="padding: 20px 30px; border-bottom: 1px solid #e1e5ea;">
            <img src="${logoUrl}" alt="SJ Creativeworks" style="height: 36px;">
        </div>

        <!-- Content -->
        <div style="padding: 30px 30px 25px;">
            
            <h1 style="font-size: 18px; color: #2d3748; margin: 0 0 20px; font-weight: 600;">
                Working Day Notification
            </h1>

            <p style="font-size: 14px; color: #4a5568; line-height: 1.7; margin-bottom: 18px;">
                Dear Team,
            </p>

            <p style="font-size: 14px; color: #4a5568; line-height: 1.7; margin-bottom: 18px;">
                This is to inform all employees that <strong>SJ Creativeworks</strong> will remain operational on the date mentioned below.
            </p>

            <!-- Info Block -->
            <div style="border: 1px solid #e6ebf1; border-radius: 6px; padding: 20px; background-color: #fafbfc; margin: 25px 0;">
                
                <table style="width: 100%; border-collapse: collapse;">
                    <tr>
                        <td style="font-size: 13px; color: #718096; padding-bottom: 6px;">Date</td>
                    </tr>
                    <tr>
                        <td style="font-size: 15px; color: #1F8B8D; font-weight: 600;">
                            27 March 2026
                        </td>
                    </tr>
                </table>

            </div>

            <p style="font-size: 14px; color: #4a5568; line-height: 1.7; margin-bottom: 18px;">
                Please note that this will be a regular working day, and all employees are expected to adhere to their normal work schedules.
            </p>

            <p style="font-size: 14px; color: #4a5568; line-height: 1.7; margin-bottom: 25px;">
                Kindly ensure your availability and plan your tasks accordingly.
            </p>

            <!-- Signature -->
            <p style="font-size: 14px; color: #2d3748; margin-bottom: 5px;">
                Regards,
            </p>
            <p style="font-size: 14px; color: #2d3748; margin: 0;">
                <strong>Management</strong><br>
                SJ Creativeworks
            </p>

        </div>

        <!-- Footer -->
        <div style="padding: 15px 30px; border-top: 1px solid #e1e5ea; background-color: #fafbfc;">
            <p style="font-size: 12px; color: #a0aec0; margin: 0;">
                This is a system-generated communication. For any queries, please contact HR.
            </p>
        </div>

    </div>

</div>
`;

    await sendEmail(email, "NO HOLIDAY ON 27th March 2026", html);

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