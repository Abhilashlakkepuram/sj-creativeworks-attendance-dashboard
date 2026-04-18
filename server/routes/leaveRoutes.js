const express = require("express");

const router = express.Router();

const {
    requestLeave,
    getLeaves,
    getMyLeaves,
    approveLeave,
    rejectLeave,
    deleteLeave,
    getLeaveBalance,
    getLeavesByUser,
    getLeaveBalanceByAdmin,
    getEmployeeList,
} = require("../controllers/leaveController");

const verifyToken = require("../middleware/authMiddleware");
const isAdmin = require("../middleware/adminMiddleware");


router.post("/request", verifyToken, requestLeave);
router.get("/my-leaves", verifyToken, getMyLeaves);
router.get("/balance", verifyToken, getLeaveBalance);
router.get("/employees", verifyToken, getEmployeeList); // ✅ token-only: for on-behalf dropdown

router.get("/all", verifyToken, isAdmin, getLeaves);
router.get("/user/:id", verifyToken, isAdmin, getLeavesByUser);
router.get("/balance/:id", verifyToken, isAdmin, getLeaveBalanceByAdmin);

router.patch("/approve/:id", verifyToken, isAdmin, approveLeave);
router.patch("/reject/:id", verifyToken, isAdmin, rejectLeave);
router.delete("/delete/:id", verifyToken, isAdmin, deleteLeave);


module.exports = router;