const { calculateWorkingHours } = require("./utils/attendanceHelpers");
const { toUTC } = require("./utils/timeHelper");

// Mock record: April 17, 2026, 3:22 PM IST
const punchIn = toUTC(2026, 4, 17, 15, 22, 0);

console.log("Input Punch In:", punchIn.toISOString());

const result = calculateWorkingHours(punchIn, null, {
    targetHour: 19,
    targetMinute: 0
});

console.log("Effective Punch Out:", result.effectivePunchOut.toISOString());
console.log("Formatted Hours:", result.formattedHours);
console.log("Minutes:", result.minutes);
