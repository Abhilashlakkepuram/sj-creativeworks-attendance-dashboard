const express = require("express");
const router = express.Router();

const { registerUser, loginUser, forgotPassword, resetPassword } = require("../controllers/authController");
console.log("running");
router.post("/register", registerUser);
router.post("/login", loginUser);
router.post("/forgot-password", (req, res, next) => { console.log("📍 Route Hit: /api/auth/forgot-password"); next(); }, forgotPassword);
router.post("/reset-password", resetPassword);

module.exports = router;