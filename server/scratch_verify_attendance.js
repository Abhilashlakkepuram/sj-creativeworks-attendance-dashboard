// Mock process.env for test - MUST BE BEFORE REQUIRE
process.env.TIMEZONE = "Asia/Kolkata";

const { calculateWorkingHours, getAttendanceStatus } = require("./utils/attendanceHelpers");


const testScenarios = [
  { name: "Full Day", in: "2024-04-17T03:30:00Z", out: "2024-04-17T12:30:00Z", expectedHours: 8, expectedStatus: "present" }, // 9:00 AM - 6:00 PM IST
  { name: "Late Entry", in: "2024-04-17T04:30:00Z", out: "2024-04-17T13:30:00Z", expectedHours: 8, expectedStatus: "present" }, // 10:00 AM - 7:00 PM IST
  { name: "Half Day (4h exact)", in: "2024-04-17T03:30:00Z", out: "2024-04-17T07:30:00Z", expectedHours: 4, expectedStatus: "half-day" }, // 9:00 AM - 1:00 PM IST
  { name: "Short Work (2h)", in: "2024-04-17T05:30:00Z", out: "2024-04-17T07:30:00Z", expectedHours: 2, expectedStatus: "absent" }, // 11:00 AM - 1:00 PM IST
  { name: "Lunch Deduction (>4h)", in: "2024-04-17T03:30:00Z", out: "2024-04-17T08:00:00Z", expectedHours: 3.5, expectedStatus: "half-day" }, // 9:00 AM - 1:30 PM IST (4.5h - 1h lunch = 3.5h)
  { name: "Missed Punch-Out", in: "2024-04-17T04:00:00Z", out: null, expectedStatus: "missed punch-out" } // 9:30 AM IST
];

console.log("--- Attendance Logic Verification ---");

testScenarios.forEach(s => {
  const result = calculateWorkingHours(s.in, s.out);
  const status = getAttendanceStatus(result.hoursFloat, s.out === null);
  
  // Debug logs
  const inD = new Date(s.in);
  const outD = s.out ? new Date(s.out) : "AUTO";
  console.log(`\nDEBUG: in=${inD.toISOString()} (${inD.getTime()}), out=${outD === "AUTO" ? "AUTO" : outD.toISOString()} (${outD === "AUTO" ? "AUTO" : outD.getTime()})`);
  console.log(`DEBUG: Result Minutes Raw: ${result.minutes}, hoursFloat: ${result.hoursFloat}`);

  console.log(`Punch In: ${s.in}`);
  console.log(`Punch Out: ${s.out || "AUTO (7 PM IST)"}`);
  console.log(`Calculated adjustment: ${result.formattedHours} (${result.hoursFloat}h)`);
  console.log(`Result Status: ${status}`);
  
  if (s.expectedStatus && status !== s.expectedStatus) {
    console.error(`❌ STATUS MISMATCH! Expected: ${s.expectedStatus}, Got: ${status}`);
  } else {
    console.log("✅ Match");
  }
});
