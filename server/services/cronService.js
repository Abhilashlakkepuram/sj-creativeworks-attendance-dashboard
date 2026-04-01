const cron = require("node-cron");
const Attendance = require("../models/Attendance");
const Notification = require("../models/Notification");

const initCronJobs = (app) => {
  // Run every day at 8:00 PM (20:00) server time
  cron.schedule("0 20 * * *", async () => {
    console.log("🕒 Running 8 PM Missed Punch-Out Check...");
    try {
      const io = app.get("io");

      // Get today's start and end boundaries
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
        console.log("✅ No missed punch-outs found for today.");
        return;
      }

      console.log(`⚠️ Found ${missingPunchOuts.length} users who forgot to punch out. Sending notifications...`);

      // Create notifications
      const notifications = missingPunchOuts.map(attendance => ({
        user: attendance.user,
        type: "attendance",
        message: "Warning: You forgot to punch out today. Please punch out.",
      }));

      const savedNotifs = await Notification.insertMany(notifications);

      // Emit via Socket.IO in real-time
      if (io) {
        savedNotifs.forEach(notif => {
          io.to(`user_${notif.user}`).emit("new-notification", notif);
        });
      }

    } catch (error) {
      console.error("❌ Cron Job Error:", error);
    }
  });

  // Run every day at 1:30 PM (13:30) server time to auto-punch out
  cron.schedule("30 13 * * *", async () => {
    console.log("🕒 Running 1:30 PM Auto Punch-Out...");
    try {
      const io = app.get("io");

      const start = new Date();
      start.setHours(0, 0, 0, 0);
      const end = new Date();
      end.setHours(23, 59, 59, 999);

      const missingPunchOuts = await Attendance.find({
        date: { $gte: start, $lte: end },
        punchIn: { $ne: null },
        punchOut: null
      });

      if (missingPunchOuts.length === 0) {
        console.log("✅ No auto punch-outs needed for today.");
        return;
      }

      console.log(`⚠️ Auto punching out ${missingPunchOuts.length} users.`);

      const now = new Date();

      for (let attendance of missingPunchOuts) {
        attendance.punchOut = now;
        attendance.missedPunchOut = true; // Use the schema's field

        const diff = now - attendance.punchIn;
        let minutes = Math.floor(diff / (1000 * 60));
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
      }

      if (io) {
        io.emit("dashboard-update");
        io.emit("attendance-update");
      }
    } catch (error) {
      console.error("❌ Auto Punch-out Error:", error);
    }
  });

  console.log("⏰ Cron jobs initialized (8 PM punch-out warning active, 1:30 PM auto punch-out active)");
};

module.exports = { initCronJobs };
