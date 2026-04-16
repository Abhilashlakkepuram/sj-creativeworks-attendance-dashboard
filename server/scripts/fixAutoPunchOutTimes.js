const mongoose = require("mongoose");
require("dotenv").config();

const Attendance = require("../models/Attendance");
const { calculateWorkingHours } = require("../utils/attendanceHelpers");

const MONGO_URI = process.env.MONGO_URI || process.env.MONGODB_URI;
const TARGET_HOUR = parseInt(process.env.AUTO_PUNCH_OUT_TARGET_HOUR, 10) || 19;
const TIMEZONE = process.env.TIMEZONE || "Asia/Kolkata";

if (!MONGO_URI) {
  console.error("Missing MONGO_URI/MONGODB_URI in environment.");
  process.exit(1);
}

const run = async () => {
  await mongoose.connect(MONGO_URI);
  console.log("Connected to MongoDB.");

  const records = await Attendance.find({
    punchIn: { $ne: null },
    punchOut: { $ne: null },
    $or: [{ missedPunchOut: true }, { autoPunchOut: true }]
  });

  console.log(`Found ${records.length} auto/missed punch-out records to verify.`);

  let updated = 0;
  for (const record of records) {
    const { effectivePunchOut, minutes } = calculateWorkingHours(record.punchIn, null, {
      timeZone: TIMEZONE,
      targetHour: TARGET_HOUR
    });

    const samePunchOut = new Date(record.punchOut).getTime() === effectivePunchOut.getTime();
    const sameMinutes = Number(record.workMinutes || 0) === Number(minutes || 0);

    if (samePunchOut && sameMinutes) continue;

    record.punchOut = effectivePunchOut;
    record.workMinutes = Math.max(0, minutes);
    record.missedPunchOut = true;
    record.autoPunchOut = true;
    record.status = "missed punch-out";
    await record.save();
    updated += 1;
  }

  console.log(`Updated ${updated} record(s).`);
  await mongoose.disconnect();
  console.log("Done.");
};

run().catch(async (err) => {
  console.error("Fix script failed:", err);
  try {
    await mongoose.disconnect();
  } catch (_) {
    // Ignore disconnect errors on failure path.
  }
  process.exit(1);
});
