const mongoose = require("mongoose");

const holidaySchema = new mongoose.Schema({
    title: {
        type: String,
        required: true
    },
    date: {
        type: Date,
        required: true
    },
    type: {
        type: String,
        enum: ["public", "optional", "company"],
        default: "public"
    }
}, { timestamps: true });

module.exports = mongoose.model("Holiday", holidaySchema);
