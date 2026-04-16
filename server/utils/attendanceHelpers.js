// utils/attendanceHelpers.js

const DEFAULT_TIMEZONE = process.env.TIMEZONE || "Asia/Kolkata";
const DEFAULT_AUTO_PUNCH_OUT_TARGET_HOUR = parseInt(process.env.AUTO_PUNCH_OUT_TARGET_HOUR, 10) || 19;
const DEFAULT_AUTO_PUNCH_OUT_TARGET_MINUTE = parseInt(process.env.AUTO_PUNCH_OUT_TARGET_MINUTE, 10) || 0;

const getDatePartsInTimezone = (date, timeZone) => {
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false
  });

  const parts = formatter.formatToParts(date).reduce((acc, part) => {
    if (part.type !== "literal") acc[part.type] = part.value;
    return acc;
  }, {});

  return {
    year: Number(parts.year),
    month: Number(parts.month),
    day: Number(parts.day),
    hour: Number(parts.hour),
    minute: Number(parts.minute),
    second: Number(parts.second)
  };
};

const getTimezoneOffsetMinutes = (date, timeZone) => {
  const tzParts = getDatePartsInTimezone(date, timeZone);
  const asUTC = Date.UTC(
    tzParts.year,
    tzParts.month - 1,
    tzParts.day,
    tzParts.hour,
    tzParts.minute,
    tzParts.second
  );

  return Math.round((asUTC - date.getTime()) / 60000);
};

const makeDateInTimezone = (year, month, day, hour, minute, timeZone) => {
  const utcGuess = Date.UTC(year, month - 1, day, hour, minute, 0, 0);
  const offsetMinutes = getTimezoneOffsetMinutes(new Date(utcGuess), timeZone);
  return new Date(utcGuess - offsetMinutes * 60000);
};
const getAutoPunchOutTime = (punchIn, options = {}) => {
  const date = new Date(
    new Date(punchIn).toLocaleString("en-US", { timeZone: "Asia/Kolkata" })
  );

  date.setHours(19, 0, 0, 0); // 7 PM IST
  return date;
};

const calculateWorkingHours = (punchIn, punchOut, options = {}) => {
  const punchInDate = new Date(punchIn);
  if (Number.isNaN(punchInDate.getTime())) {
    return { minutes: 0, hoursFloat: 0, formattedHours: "0h 0m", effectivePunchOut: new Date() };
  }
  console.log("PunchIn:", punchInDate);


  let effectivePunchOut = punchOut ? new Date(punchOut) : null;

  // ✅ Always get 7 PM cap
  const maxPunchOut = getAutoPunchOutTime(punchInDate, {
    timeZone: options.timeZone || DEFAULT_TIMEZONE,
    targetHour: 19,
    targetMinute: 0
  });

  // ✅ If no punch-out → use 7 PM
  if (!effectivePunchOut || Number.isNaN(effectivePunchOut.getTime())) {
    effectivePunchOut = maxPunchOut;
  }

  // 🔥 IMPORTANT FIX: HARD CAP
  if (effectivePunchOut > maxPunchOut) {
    effectivePunchOut = maxPunchOut;
    console.log("MaxPunchOut (7PM):", maxPunchOut);
  }
  console.log("EffectivePunchOut BEFORE:", effectivePunchOut);

  const diff = effectivePunchOut - punchInDate;
  const minutes = Math.max(0, Math.floor(diff / (1000 * 60)));
  let hoursFloat = parseFloat((minutes / 60).toFixed(2));

  // Lunch deduction
  if (hoursFloat > 4) {
    hoursFloat -= 1;
  }

  const adjustedMinutes = Math.round(hoursFloat * 60);
  const formattedHours = `${Math.floor(adjustedMinutes / 60)}h ${adjustedMinutes % 60}m`;

  return { minutes: adjustedMinutes, hoursFloat, formattedHours, effectivePunchOut };
};

const getAttendanceStatus = (hoursFloat, missedPunchOut) => {
  if (missedPunchOut) return "missed punch-out";
  if (hoursFloat >= 8) return "present";
  if (hoursFloat >= 4) return "half-day";
  return "absent";
};
console.log("🔥 NEW CALCULATION FUNCTION RUNNING");

module.exports = { calculateWorkingHours, getAttendanceStatus, getAutoPunchOutTime };
