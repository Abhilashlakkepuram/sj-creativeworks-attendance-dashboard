// utils/attendanceHelpers.js

const calculateWorkingHours = (punchIn, punchOut) => {
  let effectivePunchOut = punchOut;

  // If no punch-out, cap hours at 7:00 PM of that day
  if (!effectivePunchOut) {
    effectivePunchOut = new Date(punchIn);
    effectivePunchOut.setHours(19, 0, 0, 0); // 7 PM cap
  }

  const diff = effectivePunchOut - new Date(punchIn);
  const minutes = Math.max(0, Math.floor(diff / (1000 * 60)));
  let hoursFloat = parseFloat((minutes / 60).toFixed(2));

  // Subtract 1 hour if they worked more than 4 hours
  if (hoursFloat > 4) {
    hoursFloat -= 1;
  }

  // Recalculate minutes for return and formatting based on adjusted float
  const adjustedMinutes = Math.round(hoursFloat * 60);
  const formattedHours = `${Math.floor(adjustedMinutes / 60)}h ${adjustedMinutes % 60}m`;

  return { minutes: adjustedMinutes, hoursFloat, formattedHours, effectivePunchOut };
};

const getAttendanceStatus = (hoursFloat, missedPunchOut) => {
  if (missedPunchOut) return "missed punch-out";
  if (hoursFloat >= 5) return "present";
  if (hoursFloat >= 2.5) return "half-day";
  return "absent";
};

module.exports = { calculateWorkingHours, getAttendanceStatus };