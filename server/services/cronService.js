const cron = require("node-cron");
const Attendance = require("../models/Attendance");
const Notification = require("../models/Notification");

const initCronJobs = (app) => {
  // Run every day at 8:00 PM (20:00) server time to auto-punch out
  cron.schedule("0 20 * * *", async () => {
    console.log("🕒 Running 8 PM Auto Punch-Out...");
    try {
      const io = app.get("io");

      // Get today's boundaries
      const start = new Date();
      start.setHours(0, 0, 0, 0);
      const end = new Date();
      end.setHours(23, 59, 59, 999);

      // Find attendances for today where someone punched in but not out
      const missingPunchOuts = await Attendance.find({
        date: { $gte: start, $lte: end },
        punchIn: { $ne: null },
        punchOut: null
      });

      if (missingPunchOuts.length === 0) {
        console.log("✅ No auto punch-outs needed for today.");
        return;
      }

      console.log(`⚠️ Auto punching out ${missingPunchOuts.length} users at 8 PM.`);

      const now = new Date();

      for (let attendance of missingPunchOuts) {
        attendance.punchOut = now;
        attendance.missedPunchOut = true;

        const diff = now - attendance.punchIn;
        let minutes = Math.floor(diff / (1000 * 60));
        
        // Deduct 60 minutes for lunch if working more than 5 hours
        if (minutes > 300) {
          minutes -= 60;
        }
        
        attendance.workMinutes = Math.max(0, minutes);

        const MIN_WORK_MINUTES = 8 * 60; // 8 hours
        if (attendance.workMinutes < MIN_WORK_MINUTES) {
          attendance.status = "half-day";
        } else {
          attendance.status = "present";
        }

        await attendance.save();

        // Create notification for the user
        await Notification.create({
          user: attendance.user,
          type: "attendance",
          message: "Auto Punch-out: You were automatically punched out at 8 PM.",
        });
      }

      if (io) {
        io.emit("dashboard-update");
        io.emit("attendance-update");
      }
    } catch (error) {
      console.error("❌ Auto Punch-out Error:", error);
    }
  });

  console.log("⏰ Cron job initialized (8 PM auto punch-out active)");
};

module.exports = { initCronJobs };
