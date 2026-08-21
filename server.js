// ===================== IMPORTS =====================
const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
const helmet = require("helmet");
const rateLimit = require("express-rate-limit");
const crypto = require("crypto");
const http = require("http");
const { Server } = require("socket.io");
const path = require("path");
const fs = require("fs");
require("dotenv").config();

if (
  process.env.NODE_ENV === "production" &&
  (!process.env.JWT_SECRET || process.env.JWT_SECRET.length < 32)
) {
  console.error("Startup aborted: JWT_SECRET must contain at least 32 characters in production.");
  process.exit(1);
}

// ===================== ROUTES =====================
const authRoutes = require("./routes/authRoutes");
const clearanceRoutes = require("./routes/clearanceRoutes");
const otpRoutes = require("./routes/otpRoutes");
const inspectionRoutes = require("./routes/inspection");
const applicationRoutes = require("./routes/applicationRoutes");
const uploadDocumentsRoutes = require("./routes/uploadDocumentsRoutes");
const logRoutes = require("./routes/logRoutes");
const blockchainRoutes = require("./routes/blockchainRoutes");
const paymentRoutes = require("./routes/paymentRoutes");
const chatRoutes = require("./routes/chatRoutes");

// ===================== MODELS =====================
const User = require("./models/User");
const Chat = require("./models/Chat");
const SystemLog = require("./models/SystemLog");
const authMiddleware = require("./middleware/authMiddleware");

// ===================== EXPRESS APP =====================
const app = express();

if (process.env.NODE_ENV === "production") {
  app.set("trust proxy", 1);
}

app.disable("x-powered-by");
app.use(helmet());

const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 300,
  standardHeaders: "draft-8",
  legacyHeaders: false,
  message: { success: false, message: "Too many requests. Please try again later." },
});

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  standardHeaders: "draft-8",
  legacyHeaders: false,
  message: { success: false, message: "Too many authentication attempts. Please try again later." },
});

// ===================== ENSURE UPLOAD FOLDERS EXIST =====================
const uploadsDir = path.join(__dirname, "uploads");
const documentsDir = path.join(__dirname, "uploads", "documents");

if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

if (!fs.existsSync(documentsDir)) {
  fs.mkdirSync(documentsDir, { recursive: true });
}

// ===================== PASSWORD HELPERS =====================
function hashPassword(password, salt) {
  return crypto.pbkdf2Sync(password, salt, 100000, 64, "sha512").toString("hex");
}

function generateApiToken() {
  return crypto.randomBytes(32).toString("hex");
}

// ===================== ALLOWED ORIGINS =====================
const allowedOrigins = [
  "https://trustpermit.com",
  "https://www.trustpermit.com",
  "https://trustpermit-webclient.vercel.app",
  "https://trustpermit-backend.onrender.com",
  "http://localhost:3000",
  "http://localhost:3001",
  "http://localhost:5000",
  "http://localhost:5173",
  "http://127.0.0.1:3000",
  "http://127.0.0.1:3001",
  "http://127.0.0.1:5000",
  "http://127.0.0.1:5173",
];

if (process.env.FRONTEND_URL) {
  allowedOrigins.push(process.env.FRONTEND_URL.replace(/\/$/, ""));
}

const isAllowedOrigin = (origin) => {
  if (!origin) return true;

  if (allowedOrigins.includes(origin)) return true;
  if (process.env.NODE_ENV !== "production" && /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/i.test(origin)) return true;
  if (/^https?:\/\/trustpermit-[a-z0-9-]+\.vercel\.app$/i.test(origin)) return true;

  return false;
};

const corsOptions = {
  origin: (origin, callback) => {
    if (isAllowedOrigin(origin) || !origin) {
      callback(null, origin || true);
      return;
    }

    console.warn("Blocked CORS origin:", origin);
    callback(new Error("Origin is not allowed by CORS"));
  },
  credentials: true,
  methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
  allowedHeaders: [
    "Origin",
    "X-Requested-With",
    "Content-Type",
    "Accept",
    "Authorization",
    "X-Auth-Token",
  ],
  optionsSuccessStatus: 200,
};

// ===================== CORS =====================
app.use(cors(corsOptions));
app.options("*", cors(corsOptions));
app.use("/api", apiLimiter);
app.use("/api/auth", authLimiter);

// ===================== BODY PARSER =====================
app.use(express.json({ limit: "2mb" }));
app.use(express.urlencoded({ extended: true, limit: "2mb" }));

// ===================== STATIC FILES =====================
app.use("/uploads", express.static(uploadsDir));
app.use("/uploads/documents", express.static(documentsDir));

// Debug route to check if file exists
app.get("/api/uploads/check/:filename", authMiddleware, (req, res) => {
  if (!["admin", "staff"].includes(req.user.role)) {
    return res.status(403).json({ success: false, message: "Admin or staff access required" });
  }

  if (path.basename(req.params.filename) !== req.params.filename) {
    return res.status(400).json({ success: false, message: "Invalid filename" });
  }

  const filePath = path.join(documentsDir, req.params.filename);
  const exists = fs.existsSync(filePath);

  console.log(`📁 File check: ${req.params.filename} - ${exists ? '✅ FOUND' : '❌ NOT FOUND'}`);
  console.log(`   Full path: ${filePath}`);
  console.log(`   Dir exists: ${fs.existsSync(documentsDir)}`);

  if (exists) {
    const stats = fs.statSync(filePath);
    return res.json({
      success: true,
      exists: true,
      path: `/uploads/documents/${req.params.filename}`,
      size: stats.size,
      created: stats.birthtime,
    });
  }

  // List files in directory for debugging
  let filesInDir = [];
  if (fs.existsSync(documentsDir)) {
    filesInDir = fs.readdirSync(documentsDir).slice(0, 5); // Show first 5 files
  }

  return res.status(404).json({
    success: false,
    exists: false,
    message: "File not found on server. It may have been removed after redeploy/restart.",
    requestedFile: req.params.filename,
    expectedPath: filePath,
    directoryPath: documentsDir,
    directoryExists: fs.existsSync(documentsDir),
    filesInDirectory: filesInDir,
  });
});

// Diagnostic endpoint - lists all files in documents folder
app.get("/api/uploads/list", authMiddleware, (req, res) => {
  if (!["admin", "staff"].includes(req.user.role)) {
    return res.status(403).json({ success: false, message: "Admin or staff access required" });
  }

  try {
    const files = fs.existsSync(documentsDir) 
      ? fs.readdirSync(documentsDir).map(f => ({
          name: f,
          path: `/uploads/documents/${f}`,
          size: fs.statSync(path.join(documentsDir, f)).size,
        }))
      : [];

    return res.json({
      success: true,
      directoryPath: documentsDir,
      directoryExists: fs.existsSync(documentsDir),
      fileCount: files.length,
      files: files.slice(0, 20), // Show first 20 files
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Failed to list files",
      error: error.message,
    });
  }
});

// ===================== SERVER + SOCKET.IO =====================
const server = http.createServer(app);

const io = new Server(server, {
  path: "/socket.io",
  cors: {
    origin: (origin, callback) => {
      if (isAllowedOrigin(origin) || !origin) {
        callback(null, origin || true);
        return;
      }

      console.warn("Blocked Socket.IO origin:", origin);
      callback(new Error("Origin is not allowed by CORS"));
    },
    credentials: true,
    methods: ["GET", "POST"],
    allowedHeaders: ["Authorization", "Content-Type"],
  },
  transports: ["websocket", "polling"],
  allowEIO3: true,
});

app.set("io", io);

// ===================== SOCKET EVENTS =====================
io.on("connection", (socket) => {
  console.log("🟢 User connected:", socket.id);

  socket.on("join_chat_room", ({ roomId }) => {
    if (!roomId) return;
    socket.join(roomId);
  });

  socket.on("user_request_staff", async (data) => {
    try {
      const roomId = data.roomId || `chat_${data.userId}`;
      socket.join(roomId);

      let chat = await Chat.findOne({ roomId });

      if (!chat) {
        chat = await Chat.create({
          userId: data.userId,
          userName: data.userName || "User",
          roomId,
          status: "waiting",
          lastMessage: data.lastMessage || "User requested staff assistance",
          messages: [
            {
              sender: "system",
              text: data.lastMessage || "User requested staff assistance",
            },
          ],
        });
      }

      io.emit("new_staff_request", chat);
      io.emit("chat_updated", chat);
    } catch (err) {
      console.error("❌ user_request_staff error:", err);
    }
  });

  socket.on("staff_approve_chat", async ({ roomId }) => {
    try {
      if (!roomId) return;

      const chat = await Chat.findOneAndUpdate(
        { roomId },
        { status: "approved" },
        { new: true }
      );

      if (!chat) return;

      socket.join(roomId);

      io.to(roomId).emit("chat_approved", {
        roomId,
        message: "City Hall staff approved your chat. You may now send a message.",
        chat,
      });

      io.emit("chat_updated", chat);
    } catch (err) {
      console.error("❌ staff_approve_chat error:", err);
    }
  });

  socket.on("send_chat_message", async ({ roomId, sender, text, time, attachmentUrl, attachmentName, attachmentType }) => {
    try {
      if (!roomId || !text) return;

      const chat = await Chat.findOne({ roomId });
      if (!chat) return;

      const message = { sender, text, time, attachmentUrl, attachmentName, attachmentType };

      chat.messages.push(message);
      chat.lastMessage = text;

      await chat.save();

      io.to(roomId).emit("receive_chat_message", message);
      io.emit("chat_updated", chat);
    } catch (err) {
      console.error("❌ send_chat_message error:", err);
    }
  });

  socket.on("disconnect", () => {
    console.log("🔴 User disconnected:", socket.id);
  });
});

// ===================== DEFAULT ACCOUNTS =====================
const createDefaultUser = async (role, email, password) => {
  try {
    const normalizedEmail = String(email).toLowerCase().trim();

    let user = await User.findOne({
      $or: [{ role }, { email: normalizedEmail }],
    });

    const salt = crypto.randomBytes(16).toString("hex");
    const passwordHash = hashPassword(password, salt);

    if (!user) {
      await User.create({
        fullName: role === "admin" ? "Default Admin" : "Default Staff",
        email: normalizedEmail,
        passwordHash,
        salt,
        role,
        status: "Active",
        isVerified: true,
        emailVerified: true,
        apiToken: generateApiToken(),
      });

      console.log(`✅ Default ${role} account created`);

      await SystemLog.create({
        type: "system",
        message: `Default ${role} account created`,
        meta: {
          role,
          email: normalizedEmail,
        },
      });
    } else {
      let changed = false;

      if (!user.passwordHash || !user.salt) {
        user.passwordHash = passwordHash;
        user.salt = salt;
        changed = true;
      }

      if (!user.fullName) {
        user.fullName = role === "admin" ? "Default Admin" : "Default Staff";
        changed = true;
      }

      if (!user.role) {
        user.role = role;
        changed = true;
      }

      if (!user.status) {
        user.status = "Active";
        changed = true;
      }

      if (user.isVerified !== true) {
        user.isVerified = true;
        changed = true;
      }

      if (user.emailVerified !== true) {
        user.emailVerified = true;
        changed = true;
      }

      if (!user.apiToken) {
        user.apiToken = generateApiToken();
        changed = true;
      }

      if (changed) {
        await user.save();

        console.log(`✅ Existing ${role} account fixed`);

        await SystemLog.create({
          type: "system",
          message: `Existing ${role} account fixed`,
          meta: {
            role,
            email: normalizedEmail,
          },
        });
      } else {
        console.log(`ℹ️ ${role} already exists`);
      }
    }
  } catch (err) {
    console.error(`❌ Error creating/fixing ${role}:`, err);
  }
};

// ===================== MONGODB CONNECTION =====================
mongoose
  .connect(process.env.MONGO_URI || "mongodb://127.0.0.1:27017/trustpermit")
  .then(async () => {
    console.log("✅ MongoDB connected");

    if (process.env.DEFAULT_ADMIN_EMAIL && process.env.DEFAULT_ADMIN_PASSWORD) {
      await createDefaultUser("admin", process.env.DEFAULT_ADMIN_EMAIL, process.env.DEFAULT_ADMIN_PASSWORD);
    }
    if (process.env.DEFAULT_STAFF_EMAIL && process.env.DEFAULT_STAFF_PASSWORD) {
      await createDefaultUser("staff", process.env.DEFAULT_STAFF_EMAIL, process.env.DEFAULT_STAFF_PASSWORD);
    }
  })
  .catch((err) => {
    console.error("❌ MongoDB connection error:", err);
  });

// ===================== ROUTES =====================
// API routes
app.use("/api/auth", authRoutes);
app.use("/api/clearance", clearanceRoutes);
app.use("/api/otp", otpRoutes);
app.use("/api/inspection", inspectionRoutes);
app.use("/api/applications/upload-documents", uploadDocumentsRoutes);
app.use("/api/applications", applicationRoutes);
app.use("/api/logs", logRoutes);
app.use("/api/blockchain", blockchainRoutes);
app.use("/api/payments", paymentRoutes);
app.use("/api/chats", chatRoutes);

// Backward-compatible legacy routes for older frontend builds that still call
// /inspection, /applications, /payments without the /api prefix.
app.use("/inspection", inspectionRoutes);
app.use("/applications", applicationRoutes);
app.use("/payments", paymentRoutes);
app.use("/chats", chatRoutes);

// ===================== USERS ROUTE =====================
app.get("/api/users", authMiddleware, async (req, res) => {
  try {
    if (!["admin", "staff"].includes(req.user.role)) {
      return res.status(403).json({ message: "Admin or staff access required" });
    }

    const filter = {};
    if (req.query.role) filter.role = req.query.role;

    const users = await User.find(filter, "-passwordHash -salt -apiToken");

    res.json(users);
  } catch (err) {
    console.error("❌ Error fetching users:", err);
    res.status(500).json({ message: "Server error" });
  }
});

app.delete("/api/users/:id", authMiddleware, async (req, res) => {
  try {
    if (req.user.role !== "admin") {
      return res.status(403).json({ message: "Admin access required" });
    }

    const deletedUser = await User.findByIdAndDelete(req.params.id);

    if (!deletedUser) {
      return res.status(404).json({ message: "User not found" });
    }

    res.json({ success: true, message: "User deleted successfully" });
  } catch (err) {
    console.error("❌ Error deleting user:", err);
    res.status(500).json({ message: "Server error" });
  }
});

// ===================== ROOT ROUTES =====================
app.get("/", (req, res) => res.send("🚀 TrustPermit API running"));

app.get("/api", (req, res) =>
  res.json({
    success: true,
    message: "TrustPermit API is running",
  })
);

app.get("/api/test", (req, res) =>
  res.json({
    success: true,
    message: "Backend connected successfully",
  })
);

// ===================== SERVER =====================
const PORT = Number(process.env.PORT || 5000);

server.on("error", (error) => {
  if (error && error.code === "EADDRINUSE") {
    console.error(`❌ Port ${PORT} is already in use. Stop the existing process or set PORT to another value.`);
    process.exit(1);
  }

  console.error("❌ Server startup error:", error);
  process.exit(1);
});

server.listen(PORT, "0.0.0.0", () => {
  console.log(`🚀 Server running on port ${PORT}`);
  console.log(`🌐 Local: http://localhost:${PORT}`);
});