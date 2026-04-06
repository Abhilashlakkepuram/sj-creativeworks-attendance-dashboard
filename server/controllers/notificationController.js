const Notification = require("../models/Notification");
const User = require("../models/User");

// Helper: create a notification and emit via Socket.IO
const createNotification = async (app, userIds, type, message, link = null) => {
  try {
    const ids = Array.isArray(userIds) ? userIds : [userIds];
    const io = app.get("io");

    const notifications = ids.map(id => ({ user: id, type, message, link }));
    const savedNotifs = await Notification.insertMany(notifications);

    if (io) {
      savedNotifs.forEach(notif => {
        io.to(`user_${notif.user}`).emit("new-notification", notif);
      });
    }
    return savedNotifs;
  } catch (err) {
    console.error("Notification creation error:", err.message);
  }
};

// Helper: notify all admin users
const notifyAdmins = async (app, type, message, link = null) => {
  try {
    const admins = await User.find({ role: "admin" }).select("_id");
    const adminIds = admins.map(a => a._id);
    if (adminIds.length > 0) {
      const res = await createNotification(app, adminIds, type, message, link);

      const io = app.get("io");
      if (io) {
        io.emit("dashboard-update");
      }
      return res;
    }
  } catch (err) {
    console.error("Notify Admins error:", err.message);
  }
};

// GET /api/notifications/my — get all notifications for logged-in user
const getMyNotifications = async (req, res) => {
  try {
    const notifications = await Notification.find({ user: req.user.id })
      .sort({ createdAt: -1 })
      .limit(50);
    res.json(notifications);
  } catch (err) {
    res.status(500).json({ message: "Server error", error: err.message });
  }
};

// PATCH /api/notifications/read/:id — mark one as read
const markAsRead = async (req, res) => {
  try {
    await Notification.findOneAndUpdate(
      { _id: req.params.id, user: req.user.id },
      { isRead: true }
    );
    res.json({ message: "Marked as read" });
  } catch (err) {
    res.status(500).json({ message: "Server error", error: err.message });
  }
};

// PATCH /api/notifications/read-all — mark all as read
const markAllRead = async (req, res) => {
  try {
    await Notification.updateMany({ user: req.user.id, isRead: false }, { isRead: true });
    res.json({ message: "All marked as read" });
  } catch (err) {
    res.status(500).json({ message: "Server error", error: err.message });
  }
};

// DELETE /api/notifications/:id — delete a notification
const deleteNotification = async (req, res) => {
  try {
    const notif = await Notification.findOneAndDelete({ _id: req.params.id, user: req.user.id });
    if (!notif) return res.status(404).json({ message: "Notification not found" });
    res.json({ message: "Notification deleted" });
  } catch (err) {
    res.status(500).json({ message: "Server error", error: err.message });
  }
};

// DELETE /api/notifications — delete all notifications for user
const deleteAllNotifications = async (req, res) => {
  try {
    await Notification.deleteMany({ user: req.user.id });
    res.json({ message: "All notifications deleted" });
  } catch (err) {
    res.status(500).json({ message: "Server error", error: err.message });
  }
};

module.exports = {
  createNotification,
  notifyAdmins,
  getMyNotifications,
  markAsRead,
  markAllRead,
  deleteNotification,
  deleteAllNotifications
};
