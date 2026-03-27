const express = require("express");
const router = express.Router();
const { 
  getMyNotifications, 
  markAsRead, 
  markAllRead, 
  deleteNotification, 
  deleteAllNotifications 
} = require("../controllers/notificationController");
const verifyToken = require("../middleware/authMiddleware");

router.get("/my", verifyToken, getMyNotifications);
router.patch("/read/:id", verifyToken, markAsRead);
router.patch("/read-all", verifyToken, markAllRead);
router.delete("/all", verifyToken, deleteAllNotifications);
router.delete("/:id", verifyToken, deleteNotification);

module.exports = router;
