const jwt = require("jsonwebtoken");
const User = require("../models/User");
const mongoose = require("mongoose");
const { ALL_ROLES } = require("./validation");

const getSocketToken = (socket) => {
  const authToken = socket.handshake.auth?.token;
  const header = socket.handshake.headers?.authorization;
  const rawToken = authToken || header;
  if (typeof rawToken !== "string") return null;
  return rawToken.replace(/^Bearer\s+/i, "").trim();
};

const authenticateSocket = async (socket, next) => {
  try {
    const token = getSocketToken(socket);
    if (!token) return next(new Error("Authentication required"));

    const decoded = jwt.verify(token, process.env.JWT_SECRET, { algorithms: ["HS256"] });
    if (!mongoose.isObjectIdOrHexString(decoded.id)) return next(new Error("Authentication failed"));
    const user = await User.findById(decoded.id).select("name role isApproved isBlocked").lean();
    if (!user || user.isBlocked || !ALL_ROLES.includes(user.role) || (!user.isApproved && user.role !== "admin")) {
      return next(new Error("Authentication failed"));
    }

    socket.user = {
      id: user._id.toString(),
      name: user.name,
      role: user.role,
    };
    socket.tokenExpiresAt = decoded.exp * 1000;
    return next();
  } catch {
    return next(new Error("Authentication failed"));
  }
};

module.exports = authenticateSocket;
