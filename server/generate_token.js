const jwt = require("jsonwebtoken");
const dotenv = require("dotenv");
const path = require("path");

dotenv.config({ path: path.join(__dirname, "server", ".env") });

const secret = process.env.JWT_SECRET || "sjcreativeworks_secret";
const token = jwt.sign(
    { id: "test-admin-id", role: "admin", name: "Test Admin" },
    secret,
    { expiresIn: "1h" }
);

console.log(token);
