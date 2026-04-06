const Announcement = require("../models/Announcement");

const createAnnouncement = async (req, res) => {
    try {
        const { title, message, priority, targetRole } = req.body;

        const announcement = await Announcement.create({
            title,
            message,
            priority,
            targetRole,
            createdBy: req.user.id
        });

        const io = req.app.get("io");

        // 🔥 SEND REALTIME ANNOUNCEMENT
        if (targetRole === "all") {
            io.emit("new-announcement", announcement);
        } else {
            io.to(`role_${targetRole}`).emit("new-announcement", announcement);
        }

        // 🔔 CREATE GLOBAL NOTIFICATIONS FOR TARGET USES
        try {
            const User = require("../models/User");
            const Notification = require("../models/Notification");

            let query = { _id: { $ne: req.user.id } }; // Exclude sender
            if (targetRole !== "all") {
                query.role = targetRole;
            }

            const users = await User.find(query).select("_id");

            if (users.length > 0) {
                const notificationData = users.map(u => ({
                    user: u._id,
                    type: "announcement",
                    message: `📢 NEW ANNOUNCEMENT: ${title}`,
                    link: "/employee/dashboard"
                }));

                const savedNotifs = await Notification.insertMany(notificationData);

                // Emit to each user's private room
                savedNotifs.forEach(notif => {
                    io.to(`user_${notif.user}`).emit("new-notification", notif);
                });
            }
        } catch (notifErr) {
            console.error("Failed to create announcement notifications:", notifErr);
        }

        res.json({ message: "Announcement posted", announcement });

    } catch (err) {
        res.status(500).json({ message: err.message });
    }
};

const getAnnouncements = async (req, res) => {
    const announcements = await Announcement.find().sort({ createdAt: -1 });
    res.json(announcements);
};

const deleteAnnouncement = async (req, res) => {
    try {
        const { id } = req.params;
        await Announcement.findByIdAndDelete(id);

        const io = req.app.get("io");
        io.emit("announcement-deleted", id);

        res.json({ message: "Announcement deleted successfully" });
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
};

module.exports = { createAnnouncement, getAnnouncements, deleteAnnouncement };