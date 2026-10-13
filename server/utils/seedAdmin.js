require("dotenv").config();
const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");
const connectDB = require("../config/db");
const User = require("../models/User");
const { isStrongPassword } = require("./validation");

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

    const adminPassword = process.env.ADMIN_PASSWORD;
    if (!isStrongPassword(adminPassword)) {
      throw new Error("ADMIN_PASSWORD is required and must meet the password policy");
    }
    const hashedPassword = await bcrypt.hash(adminPassword, 10);

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
