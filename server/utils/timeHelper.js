// utils/timeHelper.js
const TIMEZONE = "Asia/Kolkata";
const IST_OFFSET_MS = 5.5 * 60 * 60 * 1000;

/**
 * Returns the current wall-clock time in IST as a true UTC-based Date object.
 */
const getNowIST = () => {
  return new Date();
};

/**
 * Converts wall-clock IST (year, month, day, hour, minute, second) to UTC Date.
 * Since IST is always UTC+5:30 (no DST), we can use a fixed offset.
 */
const toUTC = (year, month, day, hour, minute, second = 0) => {
  // Create UTC date as if the IST numbers were UTC
  const dateAsUTC = Date.UTC(year, month - 1, day, hour, minute, second);
  // Subtract the offset to get the real UTC time
  return new Date(dateAsUTC - IST_OFFSET_MS);
};

/**
 * Gets date parts in IST for any UTC Date.
 */
const getISTDateParts = (date) => {
  // We add the offset to the UTC time to get the "IST wall clock" time as a UTC date
  const istWallClock = new Date(new Date(date).getTime() + IST_OFFSET_MS);
  return {
    year: istWallClock.getUTCFullYear(),
    month: istWallClock.getUTCMonth() + 1,
    day: istWallClock.getUTCDate(),
    hour: istWallClock.getUTCHours(),
    minute: istWallClock.getUTCMinutes(),
    second: istWallClock.getUTCSeconds()
  };
};

/**
 * Returns YYYY-MM-DD string for a date in IST.
 */
const getISTYMD = (date) => {
  const p = getISTDateParts(date);
  return `${p.year}-${String(p.month).padStart(2, "0")}-${String(p.day).padStart(2, "0")}`;
};

/**
 * Returns start (00:00:00) and end (23:59:59) of today in IST as UTC-based Date objects.
 */
const getTodayRange = (referenceDate = new Date()) => {
  const parts = getISTDateParts(referenceDate);
  const start = toUTC(parts.year, parts.month, parts.day, 0, 0, 0);
  const end = toUTC(parts.year, parts.month, parts.day, 23, 59, 59);
  return { start, end };
};

/**
 * Returns true if the date is a Sunday or a 2nd Saturday in IST.
 */
const isOfficeHoliday = (date) => {
  const p = getISTDateParts(date);
  
  // High-stability day calculation for IST context
  // 0 = Sunday, 1 = Monday, ..., 6 = Saturday
  const d = new Date(date);
  const istTimeMs = d.getTime() + IST_OFFSET_MS;
  const istDate = new Date(istTimeMs);
  const dayOfWeek = istDate.getUTCDay();

  // 0 = Sunday
  if (dayOfWeek === 0) return true;
  // 6 = Saturday
  if (dayOfWeek === 6) {
    // 2nd Saturday (8th to 14th)
    if (p.day >= 8 && p.day <= 14) return true;
    // 4th Saturday (22nd to 28th)
    if (p.day >= 22 && p.day <= 28) return true;
  }
  return false;
};

/**
 * Returns true if the target date matches any date in the provided holiday list (as YMD strings).
 */
const isPublicHoliday = (date, holidayYMDs = []) => {
  const ymd = getISTYMD(date);
  return holidayYMDs.includes(ymd);
};
const isBeforeJoining = (user, date) => {
  if (!user || (!user.joiningDate && !user.createdAt)) return false;
  const joinDate = new Date(user.joiningDate || user.createdAt);
  const p = getISTDateParts(joinDate);
  const joinMidnight = toUTC(p.year, p.month, p.day, 0, 0, 0);
  return date < joinMidnight;
};

module.exports = {
  getNowIST,
  toUTC,
  getISTDateParts,
  getISTYMD,
  getTodayRange,
  isOfficeHoliday,
  isPublicHoliday,
  isBeforeJoining,
  TIMEZONE
};
