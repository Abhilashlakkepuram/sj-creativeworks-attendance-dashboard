
// // cron/autoPunchOut.js
// // Runs every day at 8:00 PM IST
// // 1. Sends warning notification to employees who haven't punched out
// // 2. Auto punch-out them at 8:00 PM
// // 3. Recalculates hours + sets status = "missed punch-out"

// const cron = require("node-cron");
// const Attendance = require("../models/Attendance");
// const Notification = require("../models/Notification"); // adjust path if needed
// const { calculateWorkingHours } = require("../utils/attendanceHelpers");

// const initAutoPunchOutCron = (io) => {

//   // Runs at 20:00 (8 PM) every day — IST timezone
//   cron.schedule("0 20 * * *", async () => {
//     console.log("[CRON] Running auto punch-out at 8 PM...");

//     try {
//       const today = new Date();
//       const startOfDay = new Date(today);
//       startOfDay.setHours(0, 0, 0, 0);
//       const endOfDay = new Date(today);
//       endOfDay.setHours(23, 59, 59, 999);

//       // Find all employees who punched in today but haven't punched out
//       const missed = await Attendance.find({
//         date: { $gte: startOfDay, $lte: endOfDay },
//         punchIn: { $exists: true, $ne: null },
//         punchOut: null
//       }).populate("user", "name email");

//       if (missed.length === 0) {
//         console.log("[CRON] No missed punch-outs today.");
//         return;
//       }

//       // Set auto punch-out time = 8:00 PM today
//       const autoPunchOutTime = new Date(today);
//       autoPunchOutTime.setHours(20, 0, 0, 0);

//       for (let record of missed) {
//         // ✅ Calculate hours from punch-in to 8 PM
//         const { minutes, hoursFloat } = calculateWorkingHours(record.punchIn, autoPunchOutTime);

//         record.punchOut = autoPunchOutTime;
//         record.missedPunchOut = true;
//         record.autoPunchOut = true;
//         record.workMinutes = Math.max(0, minutes);
//         record.status = "missed punch-out";

//         await record.save();

//         // ✅ Send warning notification to the employee
//         await Notification.create({
//           user: record.user._id,
//           title: "Missed Punch-Out",
//           message: `You forgot to punch out today. Your attendance has been auto-closed at 8:00 PM (${Math.floor(minutes / 60)}h ${minutes % 60}m recorded).`,
//           type: "warning",
//           link: "/attendance"
//         });

//         console.log(`[CRON] Auto punch-out done for: ${record.user?.name || record.user}`);
//       }

//       // Emit real-time update to admin dashboard
//       if (io) {
//         io.emit("dashboard-update");
//         io.emit("attendance-update");
//       }

//       console.log(`[CRON] Auto punch-out completed for ${missed.length} employee(s).`);

//     } catch (error) {
//       console.error("[CRON] Auto punch-out error:", error.message);
//     }

//   }, {
//     timezone: "Asia/Kolkata"
//   });

//   console.log("[CRON] Auto punch-out cron job scheduled (8 PM IST).");
// };

// const initCronJobs = (app) => {
//   const io = app.get("io");
//   initAutoPunchOutCron(io);
// };

// module.exports = { initAutoPunchOutCron, initCronJobs };



// cron/autoPunchOut.js

const cron = require("node-cron");
const Attendance = require("../models/Attendance");
const Notification = require("../models/Notification");
const LeaveBalance = require("../models/LeaveBalance");
const User = require("../models/User");
const { calculateWorkingHours } = require("../utils/attendanceHelpers");

const getISTDate = () => {
  return new Date(
    new Date().toLocaleString("en-US", { timeZone: "Asia/Kolkata" })
  );
};

const initAutoPunchOutCron = (io) => {

  cron.schedule("0 20 * * *", async () => {
    console.log("[CRON] Running auto punch-out...");

    try {
      const nowIST = getISTDate();

      const startOfDay = new Date(nowIST);
      startOfDay.setHours(0, 0, 0, 0);

      const endOfDay = new Date(nowIST);
      endOfDay.setHours(23, 59, 59, 999);

      const missed = await Attendance.find({
        date: { $gte: startOfDay, $lte: endOfDay },
        punchIn: { $exists: true, $ne: null },
        punchOut: null,
        autoPunchOut: { $ne: true }
      }).populate("user", "name email");

      if (missed.length === 0) {
        console.log("[CRON] No missed punch-outs today.");
        return;
      }

      const autoPunchOutTime = new Date(nowIST);
      autoPunchOutTime.setHours(20, 0, 0, 0); // store 8 PM

      for (let record of missed) {

        // ✅ Calculate till 7 PM only
        const { minutes } = calculateWorkingHours(
          record.punchIn,
          null,
          {
            timeZone: process.env.TIMEZONE || "Asia/Kolkata",
            targetHour: 19,   // cap working hours at 7 PM
            targetMinute: 0,
          }
        );

        record.punchOut = autoPunchOutTime;
        record.missedPunchOut = true;
        record.autoPunchOut = true;
        record.workMinutes = Math.max(0, minutes);
        record.status = "missed punch-out";

        await record.save();

        await Notification.create({
          user: record.user._id,
          title: "Missed Punch-Out",
          message: `Auto-closed at 8:00 PM (${Math.floor(minutes / 60)}h ${minutes % 60}m).`,
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
    timezone: "Asia/Kolkata"
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
    timezone: "Asia/Kolkata"
  });

  console.log("[CRON] Monthly leave credit scheduled (1st of month).");
};


const initCronJobs = (app) => {
  const io = app.get("io");
  initAutoPunchOutCron(io);
  initMonthlyLeaveCreditCron();
};

module.exports = { initAutoPunchOutCron, initCronJobs, initMonthlyLeaveCreditCron };