const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const cors = require("cors");
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
  // ✅ Production Vercel URLs (both domains)
  "https://sj-creative-works-dashboard.vercel.app",
  "https://sj-creative-works-dashboard-px0m1z7qc-sjcreativeworks.vercel.app",
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
});

app.set("io", io);

// ─────────────────────────────────────────────────────
// ✅ SOCKET EVENTS
// ─────────────────────────────────────────────────────
io.on("connection", (socket) => {
  console.log("🔌 Socket connected:", socket.id);

  socket.on("join", (userData) => {
    const userId = typeof userData === "string" ? userData : userData?.userId;
    const role = userData?.role;
    if (userId) socket.join(`user_${userId}`);
    if (role) socket.join(`role_${role}`);
  });

  socket.on("send-message", async (data) => {
    const { senderId, receiverId, roleReceiver, message, isGroupMessage, fileUrl, fileType, fileName } = data;
    const Message = require("./models/Message");

    const newMessage = await Message.create({
      sender: senderId,
      receiver: isGroupMessage ? undefined : receiverId,
      roleReceiver: isGroupMessage ? roleReceiver : undefined,
      isGroupMessage: !!isGroupMessage,
      message,
      fileUrl,
      fileType,
      fileName,
    });

    if (isGroupMessage && roleReceiver) {
      io.to(`role_${roleReceiver}`).emit("new-message", newMessage);
      io.to(`user_${senderId}`).emit("new-message", newMessage);

      try {
        const User = require("./models/User");
        const Notification = require("./models/Notification");
        const sender = await User.findById(senderId).select("name");
        const senderName = sender?.name || "A colleague";
        const targetUsers = await User.find({ role: roleReceiver, _id: { $ne: senderId } }).select("_id");

        if (targetUsers.length > 0) {
          const notifications = targetUsers.map((u) => ({
            user: u._id,
            type: "chat",
            message: `New chat message in #${roleReceiver} from ${senderName}`,
          }));
          const savedNotifs = await Notification.insertMany(notifications);
          savedNotifs.forEach((notif) => {
            io.to(`user_${notif.user}`).emit("new-notification", notif);
          });
        }
      } catch (err) {
        console.error("Failed to create role chat notifications:", err);
      }
    } else if (receiverId) {
      io.to(`user_${receiverId}`).emit("new-message", newMessage);
      io.to(`user_${senderId}`).emit("new-message", newMessage);

      try {
        const User = require("./models/User");
        const Notification = require("./models/Notification");
        const sender = await User.findById(senderId).select("name");
        const senderName = sender?.name || "A colleague";
        const newNotification = await Notification.create({
          user: receiverId,
          type: "chat",
          message: `New chat message from ${senderName}`,
        });
        io.to(`user_${receiverId}`).emit("new-notification", newNotification);
      } catch (err) {
        console.error("Failed to create chat notification:", err);
      }
    }
  });

  socket.on("mark-seen", async (data) => {
    const { senderId, receiverId } = data;
    const Message = require("./models/Message");
    try {
      await Message.updateMany(
        { sender: senderId, receiver: receiverId, isSeen: false },
        { $set: { isSeen: true } }
      );
      io.to(`user_${senderId}`).emit("messages-seen", { seenBy: receiverId });
    } catch (err) {
      console.error("Failed to mark messages as seen:", err);
    }
  });

  socket.on("disconnect", () => {
    console.log("❌ Socket disconnected:", socket.id);
  });
});

// ─────────────────────────────────────────────────────
// ✅ MIDDLEWARE
// ─────────────────────────────────────────────────────
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use("/uploads", express.static("uploads"));

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
  console.error("🔥 ERROR:", err.message);
  res.status(500).json({ message: err.message || "Server Error" });
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
