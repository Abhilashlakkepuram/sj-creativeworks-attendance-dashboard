const multer = require("multer");
const path = require("path");
const fs = require("fs");
const crypto = require("crypto");

const UPLOAD_DIR = path.join(__dirname, "..", "uploads", "chat");
const FILE_SIZE_LIMIT = 10 * 1024 * 1024;
const MIME_EXTENSIONS = {
  "image/jpeg": ".jpg",
  "image/png": ".png",
  "application/pdf": ".pdf",
  "application/msword": ".doc",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document": ".docx",
};

// Configure storage
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    try {
      fs.mkdirSync(UPLOAD_DIR, { recursive: true });
      cb(null, UPLOAD_DIR);
    } catch {
      cb(new Error("Upload storage is unavailable"));
    }
  },
  filename: (req, file, cb) => {
    const uniqueName = `${Date.now()}-${crypto.randomBytes(16).toString("hex")}`;
    cb(null, uniqueName + MIME_EXTENSIONS[file.mimetype]);
  },
});

// File filter (Images and Docs)
const fileFilter = (req, file, cb) => {
  const allowedTypes = [
    "image/jpeg",
    "image/png",
    "application/pdf",
    "application/msword",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
  ];
  if (allowedTypes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error("Invalid file type. Only JPG, PNG, PDF, DOC, and DOCX are allowed."), false);
  }
};

const upload = multer({
  storage,
  fileFilter,
  limits: { fileSize: FILE_SIZE_LIMIT, files: 1 },
});

const uploadFile = (req, res) => {
  if (!req.file) {
    return res.status(400).json({ message: "No file uploaded" });
  }

  const fileUrl = `/uploads/chat/${req.file.filename}`;
  res.json({
    fileUrl,
    fileType: req.file.mimetype,
    fileName: req.file.originalname,
  });
};

module.exports = {
  upload,
  uploadFile,
  FILE_SIZE_LIMIT,
};
