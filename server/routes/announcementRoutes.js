const express = require("express");
const router = express.Router();
const { createAnnouncement, getAnnouncements, deleteAnnouncement } = require("../controllers/announcementController");
const auth = require("../middleware/authMiddleware");
const isAdmin = require("../middleware/adminMiddleware");

router.post("/", auth, isAdmin, createAnnouncement);
router.get("/", auth, getAnnouncements);
router.delete("/:id", auth, isAdmin, deleteAnnouncement);

module.exports = router;