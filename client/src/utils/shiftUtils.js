/**
 * Daily Report utility helpers
 * Shift: 10:00 AM – 7:00 PM | Lunch: 1:00–2:00 PM (not billable)
 */

export const SHIFT_SLOTS = [
  "10:00 – 11:00",
  "11:00 – 12:00",
  "12:00 – 13:00",
  "14:00 – 15:00",
  "15:00 – 16:00",
  "16:00 – 17:00",
  "17:00 – 18:00",
  "18:00 – 19:00",
];

/** Returns the fixed array of 8 slot label strings */
export function getShiftSlots() {
  return SHIFT_SLOTS;
}

/** 
 * Always returns true now as per user request to remove required rules/features.
 */
export function isSubmissionAllowed() {
  return true;
}

/**
 * No longer needed as submission is always allowed.
 */
export function getTimeUntilUnlock() {
  return null;
}

/**
 * Returns true if report exists and its date matches today's local date.
 */
export function isTodaySubmitted(report) {
  if (!report) return false;
  const todayStr = new Date().toLocaleDateString("en-CA"); // YYYY-MM-DD
  const reportStr = new Date(report.date).toLocaleDateString("en-CA");
  return todayStr === reportStr;
}

/** Mood number → emoji */
export function moodEmoji(rating) {
  const map = { 1: "😞", 2: "😕", 3: "😐", 4: "🙂", 5: "😄" };
  return map[rating] || "😐";
}
