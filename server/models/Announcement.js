const mongoose = require("mongoose");

const announcementSchema = new mongoose.Schema({
  title: String,
  message: String,

  priority: {
    type: String,
    enum: ["low", "medium", "high"],
    default: "medium"
  },

  targetRole: {
    type: String,
    default: "all" // or developer, seo etc
  },

  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User"
  }
}, { timestamps: true });

module.exports = mongoose.model("Announcement", announcementSchema);