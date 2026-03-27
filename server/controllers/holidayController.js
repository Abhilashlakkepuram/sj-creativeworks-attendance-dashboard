const Holiday = require("../models/Holiday");

// Get all holidays
const getHolidays = async (req, res) => {
    try {
        const holidays = await Holiday.find().sort({ date: 1 });
        res.json(holidays);
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
};

// Create a holiday (Admin only)
const createHoliday = async (req, res) => {
    try {
        const { title, date, type } = req.body;
        const holiday = await Holiday.create({ title, date, type });

        // 🚀 Real-time Update
        req.app.get("io").emit("holiday-update");

        res.json(holiday);
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
};

// Delete a holiday (Admin only)
const deleteHoliday = async (req, res) => {
    try {
        const { id } = req.params;
        await Holiday.findByIdAndDelete(id);

        // 🚀 Real-time Update
        req.app.get("io").emit("holiday-update");

        res.json({ message: "Holiday deleted safely" });
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
};

module.exports = { getHolidays, createHoliday, deleteHoliday };
