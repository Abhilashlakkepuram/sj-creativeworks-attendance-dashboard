const cron = require("node-cron");
const Attendance = require("../models/Attendance");
const Notification = require("../models/Notification");
const { calculateWorkingHours, getAttendanceStatus } = require("../utils/attendanceHelpers");

const initAutoPunchOutCron = (io) => {
  cron.schedule(process.env.AUTO_PUNCH_OUT_JOB_CRON || "0 20 * * *", async () => {
    const timezone = process.env.TIMEZONE || "Asia/Kolkata";
    const targetHour = parseInt(process.env.AUTO_PUNCH_OUT_TARGET_HOUR) || 19;

    console.log(`🕒 Running Auto Punch-Out (Target: ${targetHour}:00 ${timezone})...`);
    
    try {
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

      console.log(`⚠️ Auto punching out ${missingPunchOuts.length} users at ${targetHour}:00.`);

      for (let attendance of missingPunchOuts) {
        const { effectivePunchOut, minutes, hoursFloat } = calculateWorkingHours(attendance.punchIn, null);

        attendance.punchOut = effectivePunchOut;
        attendance.missedPunchOut = true;
        attendance.autoPunchOut = true;
        attendance.workMinutes = Math.max(0, minutes);
        attendance.status = getAttendanceStatus(hoursFloat, true);

        await attendance.save();

        await Notification.create({
          user: attendance.user,
          type: "WARNING",
          message: "You haven't punched out. Auto punch-out recorded at 8:00 PM.",
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

  console.log("⏰ Auto Punch-Out Cron initialized (8 PM)");
};

module.exports = { initAutoPunchOutCron };
