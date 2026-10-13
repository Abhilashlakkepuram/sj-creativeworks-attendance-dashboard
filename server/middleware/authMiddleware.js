const jwt = require("jsonwebtoken");
const User = require("../models/User");
const mongoose = require("mongoose");
const { ALL_ROLES } = require("../utils/validation");

const verifyToken = async (req, res, next) => {
    const authHeader = req.headers.authorization;

    if (!authHeader || !/^Bearer\s+\S+$/i.test(authHeader)) {
        return res.status(401).json({
            message: "Access denied. No token provided"
        });
    }

    try {
        const token = authHeader.replace(/^Bearer\s+/i, "").trim();

        const decoded = jwt.verify(token, process.env.JWT_SECRET, { algorithms: ["HS256"] });
        if (!mongoose.isObjectIdOrHexString(decoded.id)) return res.status(401).json({ message: "Invalid token" });
        const user = await User.findById(decoded.id).select("name role isApproved isBlocked").lean();

        if (!user || !ALL_ROLES.includes(user.role)) {
            return res.status(401).json({ message: "Invalid token" });
        }

        if (user.isBlocked) {
            return res.status(403).json({ message: "Account is blocked" });
        }

        if (!user.isApproved && user.role !== "admin") {
            return res.status(403).json({ message: "Account is not approved" });
        }

        // Use the current database role so a stale token cannot grant a new role.
        req.user = {
            ...decoded,
            id: user._id.toString(),
            role: user.role,
            name: user.name,
        };

        next();

    } catch (error) {
        return res.status(401).json({ message: "Invalid token" });
    }
};

module.exports = verifyToken;
