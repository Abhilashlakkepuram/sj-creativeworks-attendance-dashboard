const Message = require("../models/Message");
const User = require("../models/User");
const mongoose = require("mongoose");

const validateFile = ({ fileUrl, fileType, fileName }) => {
    if (!fileUrl) return true;
    const allowedTypes = new Set([
        "image/jpeg", "image/png", "application/pdf", "application/msword",
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    ]);
    return typeof fileUrl === "string" && /^\/uploads\/chat\/[A-Za-z0-9._-]+$/.test(fileUrl) &&
        allowedTypes.has(fileType) && typeof fileName === "string" &&
        fileName.length > 0 && fileName.length <= 255 && !/[\r\n]/.test(fileName);
};

// Send Message (API fallback if needed)
const sendMessage = async (req, res) => {
    try {
        const { receiverId, message, fileUrl, fileType, fileName } = req.body || {};
        if (!mongoose.isObjectIdOrHexString(receiverId) || receiverId === req.user.id) {
            return res.status(400).json({ message: "Invalid receiver" });
        }
        if (typeof message !== "string" || message.trim().length > 4000 ||
            (!message.trim() && !fileUrl) || !validateFile({ fileUrl, fileType, fileName })) {
            return res.status(400).json({ message: "Invalid message" });
        }
        const receiver = await User.findOne({ _id: receiverId, isApproved: true, isBlocked: false }).select("_id");
        if (!receiver) return res.status(404).json({ message: "Receiver not found" });

        const newMessage = await Message.create({
            sender: req.user.id,
            receiver: receiverId,
            message: message.trim() || undefined,
            fileUrl,
            fileType,
            fileName
        });

        res.json(newMessage);
    } catch (err) {
        res.status(500).json({ message: "Server error" });
    }
};

// Get chat history between 2 users
const getMessages = async (req, res) => {
    try {
        const { userId } = req.params;
        if (!mongoose.isObjectIdOrHexString(userId) || userId === req.user.id) {
            return res.status(400).json({ message: "Invalid user" });
        }

        const messages = await Message.find({
            $or: [
                { sender: req.user.id, receiver: userId },
                { sender: userId, receiver: req.user.id }
            ]
        }).sort({ createdAt: 1 });

        res.json(messages);
    } catch (err) {
        res.status(500).json({ message: "Server error" });
    }
};

// Get all valid users for chat, prioritized by latest message
const getUsersToChat = async (req, res) => {
    try {
        const users = await User.find({
            _id: { $ne: req.user.id },
            isApproved: true
        }).select("name role").lean();

        // Pre-fetch the latest message for each user to construct the initial chatList
        const usersWithMessages = await Promise.all(users.map(async (u) => {
            const lastMsg = await Message.findOne({
                isGroupMessage: false,
                $or: [
                    { sender: req.user.id, receiver: u._id },
                    { sender: u._id, receiver: req.user.id }
                ]
            }).sort({ createdAt: -1 }).lean();

            const unreadCount = await Message.countDocuments({
                sender: u._id,
                receiver: req.user.id,
                isRead: false,
                isGroupMessage: false
            });

            return {
                ...u,
                lastMessage: lastMsg ? (lastMsg.message || "📁 Shared a file") : "",
                time: lastMsg ? lastMsg.createdAt : null,
                unread: unreadCount 
            };
        }));

        // Sort by time (most recent first), fallback to name if no message exists
        usersWithMessages.sort((a, b) => {
            if (a.time && b.time) return new Date(b.time) - new Date(a.time);
            if (a.time) return -1;
            if (b.time) return 1;
            return a.name.localeCompare(b.name);
        });

        res.json(usersWithMessages);
    } catch (err) {
        res.status(500).json({ message: "Server error" });
    }
};

// Get chat history for a specific role
const getRoleMessages = async (req, res) => {
    try {
        const { role } = req.params;
        const validRoles = ["developer", "seo", "designer", "marketing", "admin"];
        if (!validRoles.includes(role)) return res.status(400).json({ message: "Invalid role" });

        // Ensure user has permission to view this role's messages
        // Admins can see any role, employees only their own
        if (req.user.role !== "admin" && req.user.role !== role) {
            return res.status(403).json({ message: "Access denied" });
        }

        const messages = await Message.find({
            isGroupMessage: true,
            roleReceiver: role
        }).sort({ createdAt: 1 });

        // 🔥 Auto-mark as read when fetching role messages
        const user = await User.findById(req.user.id);
        if (user) {
            if (!user.roleReadTimestamps) user.roleReadTimestamps = new Map();
            user.roleReadTimestamps.set(role, new Date());
            await user.save();
        }

        res.json(messages);
    } catch (err) {
        res.status(500).json({ message: "Server error" });
    }
};

// Mark messages from a specific user as read
const markMessagesAsRead = async (req, res) => {
    try {
        const { userId } = req.params;
        if (!mongoose.isObjectIdOrHexString(userId)) {
            return res.status(400).json({ message: "Invalid user" });
        }
        await Message.updateMany(
            { sender: userId, receiver: req.user.id, isRead: false },
            { $set: { isRead: true } }
        );
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ message: "Server error" });
    }
};

// Get unread counts for all relevant roles
const getRoleUnreadCounts = async (req, res) => {
    try {
        const user = await User.findById(req.user.id);
        const roles = user.role === "admin"
            ? ["developer", "seo", "designer", "marketing"]
            : [user.role];

        const unreadCounts = {};

        await Promise.all(roles.map(async (role) => {
            const lastRead = user.roleReadTimestamps?.get(role) || new Date(0);
            const count = await Message.countDocuments({
                isGroupMessage: true,
                roleReceiver: role,
                createdAt: { $gt: lastRead },
                sender: { $ne: req.user.id } // Don't count own messages
            });
            unreadCounts[role] = count;
        }));

        res.json(unreadCounts);
    } catch (err) {
        res.status(500).json({ message: "Server error" });
    }
};

// Explicitly mark a role as read
const markRoleAsRead = async (req, res) => {
    try {
        const { role } = req.params;
        const validRoles = ["developer", "seo", "designer", "marketing", "admin"];
        if (!validRoles.includes(role) || (req.user.role !== "admin" && req.user.role !== role)) {
            return res.status(403).json({ message: "Access denied" });
        }
        const user = await User.findById(req.user.id);
        if (user) {
            if (!user.roleReadTimestamps) user.roleReadTimestamps = new Map();
            user.roleReadTimestamps.set(role, new Date());
            await user.save();
        }
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ message: "Server error" });
    }
};

module.exports = {
    sendMessage,
    getMessages,
    getUsersToChat,
    getRoleMessages,
    markMessagesAsRead,
    getRoleUnreadCounts,
    markRoleAsRead
};
