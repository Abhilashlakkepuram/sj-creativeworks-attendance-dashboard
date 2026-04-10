const mongoose = require("mongoose");
require("dotenv").config();
const Attendance = require("../models/Attendance");
const { calculateWorkingHours, getAttendanceStatus } = require("../utils/attendanceHelpers");

const MONGODB_URI = process.env.MONGODB_URI;

mongoose.connect(MONGODB_URI, {
    useNewUrlParser: true,
    useUnifiedTopology: true
}).then(async () => {
    console.log("MongoDB Connected. Starting recalculation...");

    try {
        const records = await Attendance.find({});
        console.log(`Found ${records.length} records to recalculate.`);

        let updatedCount = 0;

        for (let record of records) {
            if (!record.punchIn) continue;

            const { effectivePunchOut, minutes, hoursFloat } = calculateWorkingHours(record.punchIn, record.punchOut);
            
            // Reapply missing punch-out data based on the effective calculation
            if (!record.punchOut) {
                record.punchOut = effectivePunchOut;
                record.missedPunchOut = true;
                record.autoPunchOut = true;
            }

            // Sync legacy boolean field for consistency (optional)
            if (record.missedPunchOut) {
                record.autoPunchOut = true;
            }

            record.workMinutes = Math.max(0, minutes);
            record.status = getAttendanceStatus(hoursFloat, record.missedPunchOut);
            
            await record.save();
            updatedCount++;
        }

        console.log(`Successfully recalculated ${updatedCount} records.`);
    } catch (error) {
        console.error("Error recalculating:", error);
    } finally {
        mongoose.disconnect();
    }
}).catch((err) => {
    console.error("MongoDB Connection Error:", err);
});
