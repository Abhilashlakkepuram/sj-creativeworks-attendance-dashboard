const cron = require("node-cron");
const Attendance = require("../models/Attendance");
const Notification = require("../models/Notification");

const initCronJobs = (app) => {
  // Run cron job based on .env configuration (default 9 PM IST)
  cron.schedule(process.env.AUTO_PUNCH_OUT_JOB_CRON || "0 21 * * *", async () => {
    const timezone = process.env.TIMEZONE || "Asia/Kolkata";
    const targetHour = parseInt(process.env.AUTO_PUNCH_OUT_TARGET_HOUR) || 19; // Default 7 PM (19:00)

    console.log(`🕒 Running Auto Punch-Out (Target: ${targetHour}:00 ${timezone})...`);
    
    try {
      const io = app.get("io");

      // Get today's boundaries in Local Time
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

      console.log(`⚠️ Auto punching out ${missingPunchOuts.length} users at ${targetHour}:00.`);

      for (let attendance of missingPunchOuts) {
        // Set punchOut to the target hour (7 PM) of the same day
        const punchOutTime = new Date();
        punchOutTime.setHours(targetHour, 0, 0, 0);
        
        attendance.punchOut = punchOutTime;
        attendance.missedPunchOut = true;

        const diff = punchOutTime - attendance.punchIn;
        let minutes = Math.floor(diff / (1000 * 60));
        
        // Deduct 60 minutes for lunch if working more than 5 hours (300 mins)
        if (minutes > 300) {
          minutes -= 60;
        }
        
        attendance.workMinutes = Math.max(0, minutes);

        // Standard status logic
        const minWorkHours = parseInt(process.env.MIN_WORK_HOURS_FOR_FULL_DAY) || 8;
        const minWorkMinutes = minWorkHours * 60;

        if (attendance.workMinutes < minWorkMinutes) {
          attendance.status = "half-day";
        } else {
          attendance.status = "present";
        }

        await attendance.save();

        // Create notification for the user
        await Notification.create({
          user: attendance.user,
          type: "attendance",
          message: `Auto Punch-out: You forgot to punch out today. The system has automatically checked you out at ${targetHour === 19 ? '7:00 PM' : targetHour + ':00'}.`,
          link: "/employee/attendance"
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
