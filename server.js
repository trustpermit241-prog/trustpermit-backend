// ===================== IMPORTS =====================
const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
const bcrypt = require("bcryptjs");
const http = require("http");
const { Server } = require("socket.io");
const path = require("path");
require("dotenv").config();

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

// ===================== EXPRESS APP =====================
const app = express();

// ===================== ALLOWED ORIGINS =====================
const allowedOrigins = [
  "https://trustpermit.com",
  "https://trustpermit-backend.onrender.com",
  "http://localhost:3000",
  "http://localhost:5173",
];

// ===================== CORS =====================
app.use(
  cors({
    origin: function (origin, callback) {
      if (!origin || allowedOrigins.includes(origin)) {
        callback(null, true);
      } else {
        console.log("❌ Blocked by CORS:", origin);
        callback(new Error("Not allowed by CORS"));
      }
    },
    credentials: true,
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: [
      "Origin",
      "X-Requested-With",
      "Content-Type",
      "Accept",
      "Authorization",
    ],
  })
);

// ===================== BODY PARSER =====================
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// ===================== STATIC FILES =====================
app.use("/uploads", express.static(path.join(__dirname, "uploads")));

// ===================== SERVER + SOCKET.IO =====================
const server = http.createServer(app);

const io = new Server(server, {
  path: "/socket.io", // Important for Render deployment
  cors: {
    origin: allowedOrigins,
    credentials: true,
  },
  transports: ["websocket", "polling"],
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

  socket.on("send_chat_message", async ({ roomId, sender, text, time }) => {
    try {
      if (!roomId || !text) return;

      let chat = await Chat.findOne({ roomId });

      if (!chat) return;

      const message = { sender, text, time };

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
    const exists = await User.findOne({ role });

    if (!exists) {
      const hashedPassword = await bcrypt.hash(password, 10);

      await User.create({
        email,
        password: hashedPassword,
        role,
        emailVerified: true,
        fullName: role === "admin" ? "Default Admin" : "Default Staff",
      });

      console.log(`✅ Default ${role} account created`);
    } else {
      console.log(`ℹ️ ${role} already exists`);
    }
  } catch (err) {
    console.error(`❌ Error creating ${role}:`, err);
  }
};

// ===================== MONGODB CONNECTION =====================
mongoose
  .connect(process.env.MONGO_URI || "mongodb://127.0.0.1:27017/trustpermit")
  .then(async () => {
    console.log("✅ MongoDB connected");

    await createDefaultUser("admin", "admin@trustpermit.com", "admin123");
    await createDefaultUser("staff", "staff@cityhall.gov", "staff123");
  })
  .catch((err) => {
    console.error("❌ MongoDB connection error:", err);
  });

// ===================== ROUTES =====================
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

// ===================== USERS ROUTE =====================
app.get("/api/users", async (req, res) => {
  try {
    const filter = {};
    if (req.query.role) filter.role = req.query.role;
    const users = await User.find(filter, "-password -resetToken -resetTokenExpiry");
    res.json(users);
  } catch (err) {
    console.error("❌ Error fetching users:", err);
    res.status(500).json({ message: "Server error" });
  }
});

// ===================== ROOT ROUTES =====================
app.get("/", (req, res) => res.send("🚀 TrustPermit API running"));
app.get("/api", (req, res) =>
  res.json({ success: true, message: "TrustPermit API is running" })
);
app.get("/api/test", (req, res) =>
  res.json({ success: true, message: "Backend connected successfully" })
);

// ===================== SERVER =====================
const PORT = process.env.PORT || 5000;
server.listen(PORT, "0.0.0.0", () => {
  console.log(`🚀 Server running on port ${PORT}`);
  console.log(`🌐 Local: http://localhost:${PORT}`);
});