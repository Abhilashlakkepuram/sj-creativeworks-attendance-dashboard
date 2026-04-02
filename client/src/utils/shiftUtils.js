// shiftUtils.js - Shared utilities for shift reports

export const getShiftSlots = () => {
    return [
        "10:00 – 11:00",
        "11:00 – 12:00",
        "12:00 – 13:00",
        "14:00 – 15:00",
        "15:00 – 16:00",
        "16:00 – 17:00",
        "17:00 – 18:00",
        "18:00 – 19:00"
    ];
};

export const isSubmissionAllowed = () => {
    const now = new Date();
    const hours = now.getHours();
    const minutes = now.getMinutes();

    // 18:45 is 6:45 PM
    if (hours > 18) return true;
    if (hours === 18 && minutes >= 45) return true;

    return false;
};

export const getTimeUntilUnlock = () => {
    if (isSubmissionAllowed()) return null;

    const now = new Date();
    const unlockTime = new Date();
    unlockTime.setHours(18, 45, 0, 0);

    const diffMs = unlockTime - now;
    if (diffMs <= 0) return null;

    const hours = Math.floor(diffMs / (1000 * 60 * 60));
    const minutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));

    return { hours, minutes };
};

export const isTodaySubmitted = (report) => {
    if (!report || !report.date) return false;

    const today = new Date();
    const reportDate = new Date(report.date);

    return (
        today.getFullYear() === reportDate.getFullYear() &&
        today.getMonth() === reportDate.getMonth() &&
        today.getDate() === reportDate.getDate()
    );
};
