const express = require("express");
const router = express.Router();
const { upload, uploadFile } = require("../controllers/uploadController");
const verifyToken = require("../middleware/authMiddleware");
const multer = require("multer");

// POST /api/upload
router.post("/", verifyToken, (req, res, next) => {
  upload.single("file")(req, res, (error) => {
    if (!error) return next();
    if (error instanceof multer.MulterError && error.code === "LIMIT_FILE_SIZE") {
      return res.status(413).json({ message: "File exceeds the 10 MB limit" });
    }
    if (error instanceof multer.MulterError && error.code === "LIMIT_UNEXPECTED_FILE") {
      return res.status(400).json({ message: "Only one file can be uploaded" });
    }
    if (error.message === "Upload storage is unavailable") {
      return res.status(503).json({ message: "Upload storage is unavailable" });
    }
    if (error.message === "Invalid file type. Only JPG, PNG, PDF, DOC, and DOCX are allowed.") {
      return res.status(400).json({ message: error.message });
    }
    return res.status(400).json({ message: "Invalid upload" });
  });
}, uploadFile);

module.exports = router;
