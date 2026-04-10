// utils/attendanceHelpers.js

const calculateWorkingHours = (punchIn, punchOut, isAutoPunchOut = false) => {
  let effectivePunchOut = punchOut;

  // Rule 2: If no punch-out or auto-punch, cap hours at 7:00 PM (19:00) of that day
  if (!effectivePunchOut || isAutoPunchOut) {
    effectivePunchOut = new Date(punchIn);
    effectivePunchOut.setHours(19, 0, 0, 0); // 7 PM cap
  }

  const diff = effectivePunchOut - new Date(punchIn);
  const minutes = Math.max(0, Math.floor(diff / (1000 * 60)));
  const hoursFloat = parseFloat((minutes / 60).toFixed(2));
  const formattedHours = `${Math.floor(minutes / 60)}h ${minutes % 60}m`;

  return { minutes, hoursFloat, formattedHours, effectivePunchOut };
};

const getAttendanceStatus = (hoursFloat, missedPunchOut) => {
  if (missedPunchOut) return "missed punch-out";
  if (hoursFloat >= 5) return "present";
  if (hoursFloat >= 2.5) return "half-day";
  return "absent";
};

module.exports = { calculateWorkingHours, getAttendanceStatus };