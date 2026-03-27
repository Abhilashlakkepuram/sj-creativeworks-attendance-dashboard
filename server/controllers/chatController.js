const Message = require("../models/Message");
const User = require("../models/User");

// Send Message (API fallback if needed)
const sendMessage = async (req, res) => {
    try {
        const { receiverId, message, fileUrl, fileType, fileName } = req.body;

        const newMessage = await Message.create({
            sender: req.user.id,
            receiver: receiverId,
            message,
            fileUrl,
            fileType,
            fileName
        });

        res.json(newMessage);
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
};

// Get chat history between 2 users
const getMessages = async (req, res) => {
    try {
        const { userId } = req.params;

        const messages = await Message.find({
            $or: [
                { sender: req.user.id, receiver: userId },
                { sender: userId, receiver: req.user.id }
            ]
        }).sort({ createdAt: 1 });

        res.json(messages);
    } catch (err) {
        res.status(500).json({ message: err.message });
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
        res.status(500).json({ message: err.message });
    }
};

// Get chat history for a specific role
const getRoleMessages = async (req, res) => {
    try {
        const { role } = req.params;

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
        res.status(500).json({ message: err.message });
    }
};

// Mark messages from a specific user as read
const markMessagesAsRead = async (req, res) => {
    try {
        const { userId } = req.params;
        await Message.updateMany(
            { sender: userId, receiver: req.user.id, isRead: false },
            { $set: { isRead: true } }
        );
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ message: err.message });
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
        res.status(500).json({ message: err.message });
    }
};

// Explicitly mark a role as read
const markRoleAsRead = async (req, res) => {
    try {
        const { role } = req.params;
        const user = await User.findById(req.user.id);
        if (user) {
            if (!user.roleReadTimestamps) user.roleReadTimestamps = new Map();
            user.roleReadTimestamps.set(role, new Date());
            await user.save();
        }
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ message: err.message });
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