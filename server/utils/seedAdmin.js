require("dotenv").config();
const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");
const connectDB = require("../config/db");
const User = require("../models/User");

const createAdmin = async () => {
  try {
    await connectDB();

    const adminExists = await User.findOne({
      email: "admin@sjcreativeworks.com"
    });

    if (adminExists) {
      console.log("Admin already exists");
      process.exit();
    }

    const hashedPassword = await bcrypt.hash("admin123", 10);

    const admin = new User({
      name: "SJ Creativeworks Admin",
      email: "admin@sjcreativeworks.com",
      password: hashedPassword,
      role: "admin",
      isApproved: true
    });

    await admin.save();

    console.log("SJ Creativeworks Admin Created");

    process.exit();

  } catch (error) {

    console.log(error);

    process.exit();

  }

};

createAdmin();