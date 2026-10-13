// server/seedAdmin.js
const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");
require("dotenv").config();
const User = require("./models/User");
const { isStrongPassword, PASSWORD_MESSAGE } = require("./utils/validation");

const seedAdmin = async () => {
  try {
    const mongoUri = process.env.MONGO_URI;
    if (!mongoUri) {
        throw new Error("MONGO_URI is missing in .env");
    }

    console.log("Connecting to MongoDB...");
    await mongoose.connect(mongoUri);
    console.log("Connected Successfully.");

    const adminEmail = "admin@sjcreativeworks.com";
    const adminPassword = process.env.ADMIN_PASSWORD;
    if (!isStrongPassword(adminPassword)) {
      throw new Error(`ADMIN_PASSWORD is required and must be strong. ${PASSWORD_MESSAGE}`);
    }

    const existingAdmin = await User.findOne({ email: adminEmail });

    if (existingAdmin) {
      console.log(`Admin user already exists: ${adminEmail}`);
      process.exit(0);
    }

    const hashedPassword = await bcrypt.hash(adminPassword, 10);

    const admin = new User({
      name: "SJ Admin",
      email: adminEmail,
      password: hashedPassword,
      role: "admin",
      isApproved: true
    });

    await admin.save();

    console.log("-----------------------------------------");
    console.log("✅ Admin user created successfully!");
    console.log(`📧 Email: ${adminEmail}`);
    console.log("Use the configured ADMIN_PASSWORD to sign in.");
    console.log("-----------------------------------------");

    process.exit(0);

  } catch (error) {
    console.error("❌ Error seeding admin:", error.message);
    process.exit(1);
  }
};

seedAdmin();
