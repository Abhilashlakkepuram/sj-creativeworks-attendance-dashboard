const mongoose = require("mongoose");

const messageSchema = new mongoose.Schema(
    {
        sender: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            required: true
        },
        receiver: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            required: false
        },
        roleReceiver: {
            type: String,
            required: false
        },
        isGroupMessage: {
            type: Boolean,
            default: false
        },
        isRead: {
            type: Boolean,
            default: false
        },
        isSeen: {
            type: Boolean,
            default: false
        },
        message: {
            type: String,
            required: false, // 🚀 Now optional if file is present
            trim: true
        },
        fileUrl: {
            type: String,
            required: false
        },
        fileType: {
            type: String,
            required: false
        },
        fileName: {
            type: String,
            required: false
        }
    },
    { timestamps: true }
);

module.exports = mongoose.model("Message", messageSchema);