// utils/attendanceHelpers.js
const { getISTDateParts, toUTC, TIMEZONE } = require("./timeHelper");

const DEFAULT_AUTO_PUNCH_OUT_TARGET_HOUR = parseInt(process.env.AUTO_PUNCH_OUT_TARGET_HOUR, 10) || 19;
const DEFAULT_AUTO_PUNCH_OUT_TARGET_MINUTE = parseInt(process.env.AUTO_PUNCH_OUT_TARGET_MINUTE, 10) || 0;

/**
 * Returns the auto punch-out time (cap) for a given punch-in date.
 * Typically 7:00 PM IST on the same IST day.
 */
const getAutoPunchOutTime = (punchIn, options = {}) => {
  const punchInDate = new Date(punchIn);
  if (Number.isNaN(punchInDate.getTime())) {
    return new Date();
  }

  const hour = Number.isFinite(Number(options.targetHour))
    ? Number(options.targetHour)
    : DEFAULT_AUTO_PUNCH_OUT_TARGET_HOUR;
  const minute = Number.isFinite(Number(options.targetMinute))
    ? Number(options.targetMinute)
    : DEFAULT_AUTO_PUNCH_OUT_TARGET_MINUTE;

  const parts = getISTDateParts(punchInDate);
  
  // Pure Math Approach:
  // 1. Get UTC Midnight for the IST day
  const midnightUTC = Date.UTC(parts.year, parts.month - 1, parts.day, 0, 0, 0);
  // 2. Add target offset from IST midnight (e.g. 19 hours)
  const targetMsFromISTMidnight = (hour * 60 * 60 * 1000) + (minute * 60 * 1000);
  // 3. Subtract IST Offset (5.5h) to get back to pure UTC instant
  const istOffsetMs = 5.5 * 60 * 60 * 1000;
  
  const finalUTCInstant = new Date(midnightUTC + targetMsFromISTMidnight - istOffsetMs);
  
  console.log(`[DEBUG-TIME] In: ${punchInDate.toISOString()}, Cap IST: ${hour}:${minute} -> Result UTC: ${finalUTCInstant.toISOString()}`);
  
  return finalUTCInstant;
};

/**
 * Calculates working hours between punchIn and punchOut, applying a hard cap (7 PM) and lunch deduction.
 */
const calculateWorkingHours = (punchIn, punchOut, options = {}) => {
  const punchInDate = new Date(punchIn);
  if (Number.isNaN(punchInDate.getTime())) {
    return { minutes: 0, hoursFloat: 0, formattedHours: "0h 0m", effectivePunchOut: new Date() };
  }
  
  const capTime = getAutoPunchOutTime(punchInDate, options);
  let effectivePunchOut = punchOut ? new Date(punchOut) : null;

  // No punch-out provided or invalid -> Auto-Close scenario
  if (!effectivePunchOut || Number.isNaN(effectivePunchOut.getTime())) {
    effectivePunchOut = capTime;
  }

  // Hard cap enforcement: never count past the target time (7 PM IST)
  // We use .getTime() for absolute comparison across server environments
  if (effectivePunchOut.getTime() > capTime.getTime()) {
    effectivePunchOut = capTime;
  }

  // Calculate the raw duration in minutes
  const diffMs = effectivePunchOut.getTime() - punchInDate.getTime();
  const rawMinutes = Math.max(0, Math.floor(diffMs / (1000 * 60)));
  
  let hoursFloat = parseFloat((rawMinutes / 60).toFixed(2));

  // Lunch deduction documentation rule:
  // If working > 4 hours (which is 240+ minutes) → subtract 60 minutes
  if (hoursFloat > 4) {
    hoursFloat -= 1;
  }

  const adjustedMinutes = Math.max(0, Math.round(hoursFloat * 60));
  const formattedHours = `${Math.floor(adjustedMinutes / 60)}h ${adjustedMinutes % 60}m`;

  return { minutes: adjustedMinutes, hoursFloat, formattedHours, effectivePunchOut };
};

/**
 * Returns attendance status based on net working hours and missed punch-out flag.
 */
const getAttendanceStatus = (hoursFloat, missedPunchOut) => {
  if (missedPunchOut) return "missed punch-out";

  // Documentation Logic:
  // ≥ 5 hours → Present
  // ≥ 2.5 hours → Half-Day
  // < 2.5 hours → Absent
  if (hoursFloat >= 5) return "present";
  if (hoursFloat >= 2.5) return "half-day";
  return "absent";
};

module.exports = { calculateWorkingHours, getAttendanceStatus, getAutoPunchOutTime };