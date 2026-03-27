const express = require("express");
const router = express.Router();
const { sendMessage, getMessages, getUsersToChat, getRoleMessages, markMessagesAsRead } = require("../controllers/chatController");
const authMiddleware = require("../middleware/authMiddleware");

router.post("/send", authMiddleware, sendMessage);
router.get("/users", authMiddleware, getUsersToChat);
router.get("/role/:role", authMiddleware, getRoleMessages);
router.get("/:userId", authMiddleware, getMessages);
router.patch("/read/:userId", authMiddleware, markMessagesAsRead);

// Role-based unread routes
const { getRoleUnreadCounts, markRoleAsRead } = require("../controllers/chatController");
router.get("/unread-roles", authMiddleware, getRoleUnreadCounts);
router.patch("/read-role/:role", authMiddleware, markRoleAsRead);

module.exports = router;