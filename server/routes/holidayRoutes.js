const express = require("express");
const router = express.Router();
const { getHolidays, createHoliday, deleteHoliday } = require("../controllers/holidayController");
const auth = require("../middleware/authMiddleware");
const isAdmin = require("../middleware/adminMiddleware");

router.get("/", auth, getHolidays);
router.post("/", auth, isAdmin, createHoliday);
router.delete("/:id", auth, isAdmin, deleteHoliday);

module.exports = router;
