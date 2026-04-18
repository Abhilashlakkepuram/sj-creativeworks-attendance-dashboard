const TIMEZONE = "Asia/Kolkata";
const date = new Date("2024-04-17T03:30:00Z"); // 9:00 AM IST

const fmt = new Intl.DateTimeFormat("en-US", {
    timeZone: TIMEZONE,
    year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", second: "2-digit",
    hour12: false
});

const parts = fmt.formatToParts(date).reduce((acc, p) => {
    if (p.type !== "literal") acc[p.type] = p.value;
    return acc;
}, {});

console.log("Date:", date.toISOString());
console.log("Timezone:", TIMEZONE);
console.log("Parts:", JSON.stringify(parts, null, 2));

const probe = Date.UTC(parts.year, parts.month - 1, parts.day, parts.hour, parts.minute, parts.second);
console.log("Probe UTC:", new Date(probe).toISOString());
