const crypto = require("crypto");
const bcrypt = require("bcryptjs");
const User = require("../models/User");
const sendEmail = require("./emailService");
const httpError = require("../utils/httpError");

const OTP_TTL_MS = 10 * 60 * 1000;
const RESEND_DELAY_MS = 60 * 1000;
const SEND_WINDOW_MS = 60 * 60 * 1000;
const MAX_SENDS = 5;
const MAX_ATTEMPTS = 5;
const hashOTP = (otp) => crypto.createHash("sha256").update(otp).digest("hex");

const issueResetOTP = async (email) => {
  const now = new Date();
  const user = await User.findOne({ email }).select(
    "+resetOTPWindowStart +resetOTPSendCount +resetOTPLastSent"
  );
  if (!user) throw httpError(404, "User not found");

  const otp = crypto.randomInt(100000, 1000000).toString();
  const hashedOTP = hashOTP(otp);
  const expiredWindow = !user.resetOTPWindowStart ||
    now - user.resetOTPWindowStart >= SEND_WINDOW_MS;

  // The window and resend predicates make simultaneous requests contend on
  // the same document instead of each sending a different usable code.
  const issued = await User.findOneAndUpdate({
    _id: user._id,
    resetOTPWindowStart: user.resetOTPWindowStart || null,
    $and: [
      { $or: [
        { resetOTPLastSent: { $exists: false } },
        { resetOTPLastSent: { $lte: new Date(now.getTime() - RESEND_DELAY_MS) } },
      ] },
      ...(expiredWindow ? [] : [{ resetOTPSendCount: { $lt: MAX_SENDS } }]),
    ],
  }, {
    $set: {
      resetOTP: hashedOTP,
      resetOTPExpires: new Date(now.getTime() + OTP_TTL_MS),
      resetAttempts: 0,
      resetOTPLastSent: now,
      ...(expiredWindow ? { resetOTPWindowStart: now, resetOTPSendCount: 1 } : {}),
    },
    ...(expiredWindow ? {} : { $inc: { resetOTPSendCount: 1 } }),
  }, { new: true });

  if (!issued) throw httpError(429, "Please wait before requesting another OTP");

  let delivered = false;
  try {
    const result = await sendEmail(email, "Password Reset OTP - SJ Creativeworks",
      `<h2>SJ Creativeworks</h2><p>Your password reset OTP is <strong>${otp}</strong>.</p><p>Valid for 10 minutes. If you did not request it, ignore this email.</p>`);
    delivered = result?.success === true;
  } catch {
    // Never log a provider error: it may contain credentials or email content.
  }

  if (!delivered) {
    // Do not clear a newer code issued by a concurrent request.
    await User.updateOne({ _id: user._id, resetOTP: hashedOTP }, {
      $unset: { resetOTP: 1, resetOTPExpires: 1 },
    });
    throw httpError(503, "Unable to send OTP. Please try again later");
  }
};

const consumeResetOTP = async (email, otp, newPassword) => {
  // Reserve an attempt atomically, including correct attempts. This also
  // bounds parallel guesses and rejects absent/expired/locked reset states.
  const user = await User.findOneAndUpdate({
    email,
    resetOTP: { $type: "string" },
    resetOTPExpires: { $gt: new Date() },
    resetAttempts: { $lt: MAX_ATTEMPTS },
  }, { $inc: { resetAttempts: 1 } }, { new: true })
    .select("+resetOTP +resetOTPExpires +resetAttempts");

  if (!user) throw httpError(400, "Invalid or expired OTP, or too many attempts");

  const submittedHash = Buffer.from(hashOTP(otp), "hex");
  const storedHash = Buffer.from(user.resetOTP, "hex");
  if (storedHash.length !== submittedHash.length ||
      !crypto.timingSafeEqual(storedHash, submittedHash)) {
    throw httpError(400, "Invalid OTP");
  }

  const password = await bcrypt.hash(newPassword, 10);
  const updated = await User.updateOne({
    _id: user._id,
    resetOTP: user.resetOTP,
    resetOTPExpires: { $gt: new Date() },
    resetAttempts: { $lte: MAX_ATTEMPTS },
  }, {
    $set: { password, resetAttempts: 0 },
    $unset: { resetOTP: 1, resetOTPExpires: 1 },
  });

  if (updated.modifiedCount !== 1) throw httpError(400, "Invalid or expired OTP");
};

module.exports = { issueResetOTP, consumeResetOTP };
