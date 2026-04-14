const express = require("express");

const router = express.Router();

const {
    requestLeave,
    getLeaves,
    getMyLeaves,
    approveLeave,
    rejectLeave,
    deleteLeave
} = require("../controllers/leaveController");

const verifyToken = require("../middleware/authMiddleware");
const isAdmin = require("../middleware/adminMiddleware");


router.post("/request", verifyToken, requestLeave);
router.get("/my-leaves", verifyToken, getMyLeaves);

router.get("/all", verifyToken, isAdmin, getLeaves);

router.patch("/approve/:id", verifyToken, isAdmin, approveLeave);
router.patch("/reject/:id", verifyToken, isAdmin, rejectLeave);
router.delete("/delete/:id", verifyToken, isAdmin, deleteLeave);


module.exports = router;