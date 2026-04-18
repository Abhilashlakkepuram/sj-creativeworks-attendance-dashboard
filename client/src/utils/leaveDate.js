const LEAVE_TZ = "Asia/Kolkata";
const pad2 = (n) => String(n).padStart(2, "0");

const getTzYmd = (value) => {
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return null;
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: LEAVE_TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).formatToParts(d).reduce((acc, p) => {
    if (p.type !== "literal") acc[p.type] = Number(p.value);
    return acc;
  }, {});
  return { year: parts.year, month: parts.month, day: parts.day };
};

export const formatLeaveDate = (
  value,
  opts = { day: "2-digit", month: "short", year: undefined }
) => {
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "-";
  return new Intl.DateTimeFormat("en-IN", { timeZone: LEAVE_TZ, ...opts }).format(d);
};

export const calculateLeaveDays = (startDate, endDate) => {
  const s = getTzYmd(startDate);
  const e = getTzYmd(endDate);
  if (!s || !e) return 0;
  const sUtc = Date.UTC(s.year, s.month - 1, s.day);
  const eUtc = Date.UTC(e.year, e.month - 1, e.day);
  const diff = Math.abs(eUtc - sUtc);
  return Math.round(diff / 86400000) + 1;
};

export const leaveDateKey = (value) => {
  const ymd = getTzYmd(value);
  if (!ymd) return "";
  return `${ymd.year}-${pad2(ymd.month)}-${pad2(ymd.day)}`;
};
