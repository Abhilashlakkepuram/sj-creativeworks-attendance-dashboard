
// cron/autoPunchOut.js
// Runs every day at 8:00 PM IST
// 1. Sends warning notification to employees who haven't punched out
// 2. Auto punch-out them at 8:00 PM
// 3. Recalculates hours + sets status = "missed punch-out"

const cron = require("node-cron");
const Attendance = require("../models/Attendance");
const Notification = require("../models/Notification"); // adjust path if needed
const { calculateWorkingHours } = require("../utils/attendanceHelpers");

const initAutoPunchOutCron = (io) => {

  // Runs at 20:00 (8 PM) every day — IST timezone
  cron.schedule("0 20 * * *", async () => {
    console.log("[CRON] Running auto punch-out at 8 PM...");

    try {
      const today = new Date();
      const startOfDay = new Date(today);
      startOfDay.setHours(0, 0, 0, 0);
      const endOfDay = new Date(today);
      endOfDay.setHours(23, 59, 59, 999);

      // Find all employees who punched in today but haven't punched out
      const missed = await Attendance.find({
        date: { $gte: startOfDay, $lte: endOfDay },
        punchIn: { $exists: true, $ne: null },
        punchOut: null
      }).populate("user", "name email");

      if (missed.length === 0) {
        console.log("[CRON] No missed punch-outs today.");
        return;
      }

      // Set auto punch-out time = 8:00 PM today
      const autoPunchOutTime = new Date(today);
      autoPunchOutTime.setHours(20, 0, 0, 0);

      for (let record of missed) {
        // ✅ Rule 2 & 3: recorded at 8 PM but calculated up to 7 PM
        const { minutes, hoursFloat } = calculateWorkingHours(record.punchIn, autoPunchOutTime, true);

        record.punchOut = autoPunchOutTime;
        record.missedPunchOut = true;
        record.autoPunchOut = true;
        record.workMinutes = Math.max(0, minutes);
        record.status = "missed punch-out";

        await record.save();

        // ✅ Rule 3: Correct notification message and type
        await Notification.create({
          user: record.user._id,
          title: "Missed Punch-Out",
          message: "You haven't punched out. Auto punch-out recorded at 8:00 PM.",
          type: "WARNING",
          link: "/attendance"
        });

        console.log(`[CRON] Auto punch-out done for: ${record.user?.name || record.user}`);
      }

      // Emit real-time update to admin dashboard
      if (io) {
        io.emit("dashboard-update");
        io.emit("attendance-update");
      }

      console.log(`[CRON] Auto punch-out completed for ${missed.length} employee(s).`);

    } catch (error) {
      console.error("[CRON] Auto punch-out error:", error.message);
    }

  }, {
    timezone: "Asia/Kolkata"  // ✅ Runs at 8 PM IST
  });

  console.log("[CRON] Auto punch-out cron job scheduled (8 PM IST).");
};

const initCronJobs = (app) => {
  const io = app.get("io");
  initAutoPunchOutCron(io);
};

module.exports = { initAutoPunchOutCron, initCronJobs };