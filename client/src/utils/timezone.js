export const IST_TIMEZONE = "Asia/Kolkata";

const pad2 = (value) => String(value).padStart(2, "0");

export const getISTDateKey = (value) => {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";

  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: IST_TIMEZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date).reduce((result, part) => {
    if (part.type !== "literal") result[part.type] = part.value;
    return result;
  }, {});

  return `${parts.year}-${parts.month}-${parts.day}`;
};

export const getTodayISTDateKey = () => getISTDateKey(new Date());

export const getISTMonthKey = (value) => getISTDateKey(value).slice(0, 7);

export const getCalendarDateKey = (date) => {
  if (!(date instanceof Date) || Number.isNaN(date.getTime())) return "";
  return `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}`;
};

export const getTodayCalendarDate = () => {
  const [year, month, day] = getTodayISTDateKey().split("-").map(Number);
  return new Date(year, month - 1, day);
};

export const getISTDayOfWeek = (value) => {
  const [year, month, day] = getISTDateKey(value).split("-").map(Number);
  if (!year || !month || !day) return null;
  return new Date(Date.UTC(year, month - 1, day)).getUTCDay();
};

export const dateKeyToISTDate = (dateKey) => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateKey)) return null;
  return new Date(`${dateKey}T00:00:00+05:30`);
};

export const formatISTDateKey = (dateKey, options = {}) => {
  const date = dateKeyToISTDate(dateKey);
  if (!date) return "-";
  return new Intl.DateTimeFormat("en-IN", {
    timeZone: IST_TIMEZONE,
    ...options,
  }).format(date);
};
