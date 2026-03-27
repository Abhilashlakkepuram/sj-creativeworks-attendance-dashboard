const express = require("express");
const router = express.Router();

const {
  getEmployees,
  getPendingUsers,
  approveUser,
  rejectUser,
  getAllAttendance,
  getUserAttendance,
  getDashboardStats,
  addEmployee,
  updateEmployee,
  deleteEmployee,
  toggleBlockUser,
  getEmployeeProfile,
} = require("../controllers/adminController");

const verifyToken = require("../middleware/authMiddleware");
const isAdmin = require("../middleware/adminMiddleware");

router.get("/employees", verifyToken, isAdmin, getEmployees);
router.get("/pending-users", verifyToken, isAdmin, getPendingUsers);
router.patch("/approve-user/:id", verifyToken, isAdmin, approveUser);
router.patch("/reject-user/:id", verifyToken, isAdmin, rejectUser);
router.get("/attendance", verifyToken, isAdmin, getAllAttendance);
router.get("/attendance/user/:id", verifyToken, isAdmin, getUserAttendance);
router.get("/employee/:id", verifyToken, isAdmin, getEmployeeProfile);
router.get("/dashboard-stats", verifyToken, isAdmin, getDashboardStats);

// ✅ Each route registered exactly once (duplicates removed)
router.post("/add-employee", verifyToken, isAdmin, addEmployee);
router.patch("/update-employee/:id", verifyToken, isAdmin, updateEmployee);
router.delete("/delete-employee/:id", verifyToken, isAdmin, deleteEmployee);
router.patch("/toggle-block-user/:id", verifyToken, isAdmin, toggleBlockUser);

module.exports = router;
