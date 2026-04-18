const TIMEZONE = "Asia/Kolkata";

const getISTDateParts = (date) => {
    const fmt = new Intl.DateTimeFormat("en-US", {
        timeZone: TIMEZONE,
        year: "numeric", month: "2-digit", day: "2-digit",
        hour: "2-digit", minute: "2-digit", second: "2-digit",
        hour12: false
    });
    return fmt.formatToParts(date).reduce((acc, p) => {
        if (p.type !== "literal") acc[p.type] = Number(p.value);
        return acc;
    }, {});
};

const toUTC = (year, month, day, hour, minute, second = 0) => {
    const probe = Date.UTC(year, month - 1, day, hour, minute, second);
    const probeDate = new Date(probe);
    const fmt = new Intl.DateTimeFormat("en-US", {
        timeZone: TIMEZONE,
        year: "numeric", month: "2-digit", day: "2-digit",
        hour: "2-digit", minute: "2-digit", second: "2-digit",
        hour12: false
    });
    const p = fmt.formatToParts(probeDate).reduce((acc, part) => {
        if (part.type !== "literal") acc[part.type] = Number(part.value);
        return acc;
    }, {});
    const probeAsUTC = Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second);
    const offsetMs = probeAsUTC - probeDate.getTime();
    return new Date(probe - offsetMs);
};

const getAutoPunchOutTime = (punchIn, targetHour = 19) => {
  const parts = getISTDateParts(new Date(punchIn));
  return toUTC(parts.year, parts.month, parts.day, targetHour, 0, 0);
};

const calculateWorkingHours = (punchIn, punchOut) => {
  const punchInDate = new Date(punchIn);
  const capTime = getAutoPunchOutTime(punchInDate);
  let effectivePunchOut = punchOut ? new Date(punchOut) : capTime;
  if (effectivePunchOut > capTime) effectivePunchOut = capTime;

  const diff = effectivePunchOut - punchInDate;
  const minutes = Math.max(0, Math.floor(diff / (1000 * 60)));
  let hoursFloat = parseFloat((minutes / 60).toFixed(2));
  if (hoursFloat > 4) hoursFloat -= 1;
  return { minutes, hoursFloat, in: punchInDate.toISOString(), out: effectivePunchOut.toISOString(), cap: capTime.toISOString() };
};

console.log("Scenario 1: Full Day (9 AM - 6 PM IST)");
console.log(calculateWorkingHours("2024-04-17T03:30:00Z", "2024-04-17T12:30:00Z"));

console.log("\nScenario 2: Late Entry (10 AM - 7 PM IST)");
console.log(calculateWorkingHours("2024-04-17T04:30:00Z", "2024-04-17T13:30:00Z"));

console.log("\nScenario 3: Half-Day (9 AM - 1 PM IST)");
console.log(calculateWorkingHours("2024-04-17T03:30:00Z", "2024-04-17T07:30:00Z"));
