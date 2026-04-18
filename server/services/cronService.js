const cron = require("node-cron");
const Attendance = require("../models/Attendance");
const Notification = require("../models/Notification");
const LeaveBalance = require("../models/LeaveBalance");
const User = require("../models/User");
const { calculateWorkingHours } = require("../utils/attendanceHelpers");
const { getTodayRange, TIMEZONE } = require("../utils/timeHelper");

const initAutoPunchOutCron = (io) => {

  // Runs daily at 8:00 PM IST
  cron.schedule("0 20 * * *", async () => {
    console.log("[CRON] Running auto punch-out...");

    try {
      const { start, end } = getTodayRange();
      const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);

      // Conditions: 
      // 1. Belong to today (IST)
      // 2. has punchIn
      // 3. no punchOut
      // 4. not already auto-punched
      // 5. Safety rule: punchIn is older than 60 minutes
      const missed = await Attendance.find({
        date: { $gte: start, $lte: end },
        punchIn: { $exists: true, $ne: null, $lt: oneHourAgo },
        punchOut: null,
        autoPunchOut: { $ne: true }
      }).populate("user", "name email");

      if (missed.length === 0) {
        console.log("[CRON] No missed punch-outs today.");
        return;
      }

      for (let record of missed) {
        // ✅ Calculate and cap till 7 PM only (Documentation Rule)
        const { minutes, effectivePunchOut } = calculateWorkingHours(
          record.punchIn,
          null,
          {
            timeZone: TIMEZONE,
            targetHour: 19,   // cap working hours at 7 PM IST
            targetMinute: 0,
          }
        );

        record.punchOut = effectivePunchOut;
        record.missedPunchOut = true;
        record.autoPunchOut = true;
        record.workMinutes = Math.max(0, minutes);
        record.status = "missed punch-out";

        await record.save();

        await Notification.create({
          user: record.user._id,
          title: "Missed Punch-Out",
          message: `Auto-closed at 7:00 PM (${Math.floor(minutes / 60)}h ${minutes % 60}m).`,
          type: "warning",
          link: "/attendance"
        });

        console.log(`[CRON] Auto punch-out done for: ${record.user?.name}`);
      }

      if (io) {
        io.emit("dashboard-update");
        io.emit("attendance-update");
      }

      console.log(`[CRON] Completed for ${missed.length} employee(s).`);

    } catch (error) {
      console.error("[CRON ERROR]:", error.message);
    }

  }, {
    timezone: TIMEZONE
  });

  console.log("[CRON] Auto punch-out scheduled.");
};

/**
 * 📅 Monthly Leave Credit Cron
 * Runs on the 1st of every month at 00:00
 * Adds +2 leaves to everyone, capped at 6
 */
const initMonthlyLeaveCreditCron = () => {
  cron.schedule("0 0 1 * *", async () => {
    console.log("[CRON] Running monthly leave credit...");
    try {
      const users = await User.find({ isApproved: true });
      const currentMonth = new Date().toISOString().slice(0, 7); // YYYY-MM

      for (let user of users) {
        let balanceRecord = await LeaveBalance.findOne({ user: user._id });

        if (!balanceRecord) {
          // Initialize if missing
          await LeaveBalance.create({
            user: user._id,
            balance: 2,
            lastCreditedMonth: currentMonth
          });
          continue;
        }

        // Prevent double credit
        if (balanceRecord.lastCreditedMonth === currentMonth) continue;

        // Credit +2, capped at maxLimit (default 6)
        const newBalance = Math.min(
          balanceRecord.balance + balanceRecord.monthlyCredit,
          balanceRecord.maxLimit
        );

        balanceRecord.balance = newBalance;
        balanceRecord.lastCreditedMonth = currentMonth;
        await balanceRecord.save();
      }
      console.log(`[CRON] Monthly leave credit completed for ${users.length} users.`);
    } catch (error) {
      console.error("[CRON ERROR]: Monthly Leave Credit:", error.message);
    }
  }, {
    timezone: TIMEZONE
  });

  console.log("[CRON] Monthly leave credit scheduled (1st of month).");
};


const initCronJobs = (app) => {
  const io = app.get("io");
  initAutoPunchOutCron(io);
  initMonthlyLeaveCreditCron();
};

module.exports = { initAutoPunchOutCron, initCronJobs, initMonthlyLeaveCreditCron };
