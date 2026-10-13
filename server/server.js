const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const cors = require("cors");
const mongoose = require("mongoose");
require("dotenv").config();

const connectDB = require("./config/db");

const authRoutes = require("./routes/authRoutes");
const adminRoutes = require("./routes/adminRoutes");
const attendanceRoutes = require("./routes/attendanceRoutes");
const leaveRoutes = require("./routes/leaveRoutes");
const notificationRoutes = require("./routes/notificationRoutes");
const chatRoutes = require("./routes/chatRoutes");
const uploadRoutes = require("./routes/uploadRoutes");
const { initCronJobs } = require("./services/cronService");
const authenticateSocket = require("./utils/socketAuth");
const User = require("./models/User");
const Message = require("./models/Message");
const Notification = require("./models/Notification");

const app = express();
const server = http.createServer(app);

// ─────────────────────────────────────────────────────
// ✅ ALLOWED ORIGINS — exact live URLs hardcoded + env
// ─────────────────────────────────────────────────────
const allowedOrigins = [
  // Local dev
  "http://localhost:5173",
  "http://localhost:5174",
  "http://localhost:5175",
  "http://localhost:5176",
  "http://127.0.0.1:5173",
  "http://127.0.0.1:5174",
  // ✅ Production Vercel URLs
  "https://sj-creative-works-dashboard.vercel.app",
  "https://sj-creative-works-dashboard-px0m1z7qc-sjcreativeworks.vercel.app",
  // ✅ Custom domain
  "https://dashboard.visionthoughts.com",
  // ✅ From .env (future custom domain support)
  process.env.CLIENT_URL,
].filter(Boolean);

const isOriginAllowed = (origin) => {
  if (!origin) return true;
  if (allowedOrigins.includes(origin)) return true;
  if (origin.endsWith(".vercel.app")) return true; // all Vercel preview URLs
  return false;
};


// ─────────────────────────────────────────────────────
// ✅ CORS
// ─────────────────────────────────────────────────────
const corsOptions = {
  origin: function (origin, callback) {
    if (isOriginAllowed(origin)) return callback(null, true);
    console.log("❌ CORS BLOCKED:", origin);
    return callback(new Error("Not allowed by CORS"));
  },
  credentials: true,
  methods: ["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization", "X-Requested-With"],
};

app.use(cors(corsOptions));
app.options(/.*/, cors(corsOptions));

// ─────────────────────────────────────────────────────
// ✅ SOCKET.IO
// ─────────────────────────────────────────────────────
const io = new Server(server, {
  cors: {
    origin: (origin, callback) => {
      if (isOriginAllowed(origin)) return callback(null, true);
      return callback(new Error("Socket CORS blocked"), false);
    },
    methods: ["GET", "POST"],
    credentials: true,
  },
  transports: ["websocket", "polling"], // polling fallback for Render
  pingTimeout: 60000,
  pingInterval: 25000,
  maxHttpBufferSize: 64 * 1024,
});

io.use(authenticateSocket);

app.set("io", io);

// ─────────────────────────────────────────────────────
// ✅ SOCKET EVENTS
// ─────────────────────────────────────────────────────
io.on("connection", (socket) => {
  console.log("🔌 Socket connected:", socket.id);

  const emitSocketError = (ack, message) => {
    const error = { success: false, message };
    if (typeof ack === "function") ack(error);
    else socket.emit("socket-error", error);
  };

  socket.join(`user_${socket.user.id}`);
  socket.join(`role_${socket.user.role}`);
  const expiryTimer = Number.isFinite(socket.tokenExpiresAt)
    ? setTimeout(() => socket.disconnect(true), Math.max(0, socket.tokenExpiresAt - Date.now()))
    : null;
  expiryTimer?.unref();

  // Recheck current account state and token validity before every event.
  socket.use((packet, next) => {
    const previousRole = socket.user.role;
    authenticateSocket(socket, (error) => {
      if (error || socket.user.role !== previousRole) {
        emitSocketError(packet[packet.length - 1], "Authentication failed; reconnect to continue");
        socket.disconnect(true);
        return;
      }
      next();
    });
  });

  socket.on("join", () => {
    // Room identity is derived from the authenticated socket, never from the
    // client event payload.
    socket.join(`user_${socket.user.id}`);
    socket.join(`role_${socket.user.role}`);
  });

  socket.on("send-message", async (data, ack) => {
    try {
      if (!data || typeof data !== "object" || Array.isArray(data) ||
        (data.message !== undefined && typeof data.message !== "string") ||
        (data.isGroupMessage !== undefined && typeof data.isGroupMessage !== "boolean")) {
        return emitSocketError(ack, "Invalid message");
      }

      const isGroupMessage = data.isGroupMessage === true;
      const message = typeof data.message === "string" ? data.message.trim() : "";
      const fileUrl = data.fileUrl;
      const fileType = data.fileType;
      const fileName = data.fileName;
      const allowedFileTypes = new Set([
        "image/jpeg", "image/png", "application/pdf", "application/msword",
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      ]);

      if (!message && !fileUrl) return emitSocketError(ack, "Message or file is required");
      if (message.length > 4000) return emitSocketError(ack, "Message is too long");
      if (fileUrl && (typeof fileUrl !== "string" ||
        !/^\/uploads\/chat\/[A-Za-z0-9._-]+$/.test(fileUrl))) {
        return emitSocketError(ack, "Invalid file URL");
      }
      if (fileUrl && (!allowedFileTypes.has(fileType) ||
        typeof fileName !== "string" || !fileName || fileName.length > 255 || /[\r\n]/.test(fileName))) {
        return emitSocketError(ack, "Invalid file metadata");
      }

      let receiverId;
      let roleReceiver;
      if (isGroupMessage) {
        roleReceiver = data.roleReceiver;
        const validRoles = ["developer", "seo", "designer", "marketing", "admin"];
        if (!validRoles.includes(roleReceiver) ||
          (socket.user.role !== "admin" && socket.user.role !== roleReceiver)) {
          return emitSocketError(ack, "You cannot send to this role");
        }
      } else {
        receiverId = data.receiverId;
        if (typeof receiverId !== "string" || !mongoose.isObjectIdOrHexString(receiverId) || receiverId === socket.user.id) {
          return emitSocketError(ack, "Invalid receiver");
        }
        const receiver = await User.findOne({
          _id: receiverId, isApproved: true, isBlocked: false,
        }).select("_id").lean();
        if (!receiver) return emitSocketError(ack, "Receiver not found");
      }

      const newMessage = await Message.create({
        sender: socket.user.id,
        receiver: isGroupMessage ? undefined : receiverId,
        roleReceiver,
        isGroupMessage,
        message: message || undefined,
        fileUrl,
        fileType,
        fileName,
      });

      if (isGroupMessage) {
        io.to(`role_${roleReceiver}`).emit("new-message", newMessage);
        if (socket.user.role !== roleReceiver) io.to(`user_${socket.user.id}`).emit("new-message", newMessage);
        const targetUsers = await User.find({
          role: roleReceiver, isApproved: true, isBlocked: false, _id: { $ne: socket.user.id },
        }).select("_id").lean();
        if (targetUsers.length) {
          const savedNotifs = await Notification.insertMany(targetUsers.map((user) => ({
            user: user._id,
            type: "chat",
            message: `New chat message in #${roleReceiver} from ${socket.user.name || "A colleague"}`,
          })));
          savedNotifs.forEach((notification) => {
            io.to(`user_${notification.user}`).emit("new-notification", notification);
          });
        }
      } else {
        io.to(`user_${receiverId}`).emit("new-message", newMessage);
        io.to(`user_${socket.user.id}`).emit("new-message", newMessage);
        const notification = await Notification.create({
          user: receiverId,
          type: "chat",
          message: `New chat message from ${socket.user.name || "A colleague"}`,
        });
        io.to(`user_${receiverId}`).emit("new-notification", notification);
      }
      if (typeof ack === "function") ack({ success: true, data: newMessage });
    } catch (err) {
      console.error("Socket message failed:", err.message);
      emitSocketError(ack, "Unable to send message");
    }
  });

  socket.on("mark-seen", async (data, ack) => {
    try {
      const senderId = data?.senderId;
      if (typeof senderId !== "string" || !mongoose.isObjectIdOrHexString(senderId) || senderId === socket.user.id) {
        return emitSocketError(ack, "Invalid sender");
      }
      await Message.updateMany(
        { sender: senderId, receiver: socket.user.id, isSeen: false },
        { $set: { isSeen: true } }
      );
      io.to(`user_${senderId}`).emit("messages-seen", { seenBy: socket.user.id });
      if (typeof ack === "function") ack({ success: true });
    } catch (err) {
      console.error("Failed to mark messages as seen:", err);
      emitSocketError(ack, "Unable to mark messages as seen");
    }
  });

  socket.on("disconnect", () => {
    clearTimeout(expiryTimer);
    console.log("❌ Socket disconnected:", socket.id);
  });
});

// ─────────────────────────────────────────────────────
// ✅ MIDDLEWARE
// ─────────────────────────────────────────────────────
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use("/uploads", express.static(require("path").join(__dirname, "uploads")));

// ─────────────────────────────────────────────────────
// ✅ HEALTH CHECK
// ─────────────────────────────────────────────────────
app.get("/health", (req, res) => {
  res.status(200).json({ status: "ok", timestamp: new Date().toISOString() });
});

app.get("/test", (req, res) => {
  res.send("SJ Creativeworks API Running 🚀");
});

// ─────────────────────────────────────────────────────
// ✅ ROUTES
// ─────────────────────────────────────────────────────
app.use("/api/auth", authRoutes);
app.use("/api/admin", adminRoutes);
app.use("/api/attendance", attendanceRoutes);
app.use("/api/leaves", leaveRoutes);
app.use("/api/notifications", notificationRoutes);
app.use("/api/chat", chatRoutes);
app.use("/api/announcements", require("./routes/announcementRoutes"));
app.use("/api/holidays", require("./routes/holidayRoutes"));
app.use("/api/upload", uploadRoutes);
console.log("🛠 Mounting /api/reports...");
app.use("/api/reports", require("./routes/reportRoutes"));


// ─────────────────────────────────────────────────────
// ✅ ERROR HANDLER
// ─────────────────────────────────────────────────────
app.use((err, req, res, next) => {
  if (res.headersSent) return next(err);
  if (err.type === "entity.parse.failed") return res.status(400).json({ message: "Invalid JSON" });
  if (err.type === "entity.too.large") return res.status(413).json({ message: "Request too large" });
  console.error("Request failed");
  res.status(500).json({ message: "Server error" });
});

// ─────────────────────────────────────────────────────
// ✅ START — DB first, then server
// ─────────────────────────────────────────────────────
const PORT = process.env.PORT || 5000;

// ─────────────────────────────────────────────────────
// ✅ GLOBAL ERROR HANDLERS
// ─────────────────────────────────────────────────────
process.on("unhandledRejection", (reason, promise) => {
  console.error("🔥 Unhandled Rejection at:", promise, "reason:", reason);
});

process.on("uncaughtException", (err) => {
  console.error("🔥 Uncaught Exception:", err);
  // Give process time to log before exiting if needed
  setTimeout(() => process.exit(1), 1000);
});

connectDB().then(() => {
  // ✅ LOG EVERY REQUEST
  app.use((req, res, next) => {
    const start = Date.now();
    res.on("finish", () => {
      const duration = Date.now() - start;
      console.log(`📡 ${req.method} ${req.originalUrl} - ${res.statusCode} (${duration}ms)`);
    });
    next();
  });

  server.listen(PORT, () => {
    console.log(`🚀 Server running on port ${PORT}`);
    console.log(`🌍 ENV: ${process.env.NODE_ENV || "development"}`);
    console.log(`🌐 CLIENT_URL: ${process.env.CLIENT_URL || "not set"}`);
  });

  // ✅ Initialize Background Jobs
  initCronJobs(app);

  // ✅ KEEP-ALIVE: prevents Render free tier from sleeping (protects server process)
  if (process.env.NODE_ENV === "production") {
    const https = require("https");
    const pingUrl = "https://sj-creativeworksdashboard.onrender.com/health";
    setInterval(() => {
      https.get(pingUrl, (res) => {
        console.log(`💓 Keep-alive: ${res.statusCode}`);
      }).on("error", (e) => console.error("Keep-alive error:", e.message));
    }, 14 * 60 * 1000); // every 14 minutes
  }

}).catch((err) => {
  console.error("❌ DB connection failed. Server not started:", err.message);
  process.exit(1);
});
