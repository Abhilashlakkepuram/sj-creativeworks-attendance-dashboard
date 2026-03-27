const express = require("express");
const router = express.Router();
const { upload, uploadFile } = require("../controllers/uploadController");
const verifyToken = require("../middleware/authMiddleware");

// POST /api/upload
router.post("/", verifyToken, upload.single("file"), uploadFile);

module.exports = router;
