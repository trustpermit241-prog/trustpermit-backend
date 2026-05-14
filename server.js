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
const logRoutes = require("./routes/logRoutes");
const blockchainRoutes = require("./routes/blockchainRoutes");
const reviewRoutes = require("./routes/reviewRoutes");

// ===================== MODELS =====================
const User = require("./models/User");

// ===================== EXPRESS APP =====================
const app = express();

// ===================== ALLOWED ORIGINS =====================
const allowedOrigins = [
  "http://localhost:3000",
  "http://localhost:5173",

  // FRONTEND URL
  "https://trustpermit-frontend.onrender.com",

  // BACKEND URL
  "https://trustpermit-backend.onrender.com",
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

    methods: [
      "GET",
      "POST",
      "PUT",
      "PATCH",
      "DELETE",
      "OPTIONS",
    ],

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

// ===================== SOCKET SERVER =====================
const server = http.createServer(app);

const io = new Server(server, {
  cors: {
    origin: allowedOrigins,
    credentials: true,
    methods: ["GET", "POST", "PUT", "DELETE"],
  },

  transports: ["websocket", "polling"],
});

app.set("io", io);

// ===================== SOCKET EVENTS =====================
io.on("connection", (socket) => {
  console.log("🟢 User connected:", socket.id);

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
        fullName:
          role === "admin"
            ? "Default Admin"
            : "Default Staff",
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
  .connect(
    process.env.MONGO_URI ||
      "mongodb://127.0.0.1:27017/trustpermit"
  )
  .then(async () => {
    console.log("✅ MongoDB connected");

    await createDefaultUser(
      "admin",
      "admin@trustpermit.com",
      "admin123"
    );

    await createDefaultUser(
      "staff",
      "staff@cityhall.gov",
      "staff123"
    );
  })
  .catch((err) => {
    console.error("❌ MongoDB connection error:", err);
  });

// ===================== MONGOOSE EVENTS =====================
mongoose.connection.on("connected", () => {
  console.log("✅ MongoDB connection established");
});

mongoose.connection.on("error", (err) => {
  console.error("❌ MongoDB connection error:", err);
});

mongoose.connection.on("disconnected", () => {
  console.log("⚠️ MongoDB disconnected");
});

// ===================== API ROUTES =====================
app.use("/api/auth", authRoutes);
app.use("/api/clearance", clearanceRoutes);
app.use("/api/otp", otpRoutes);
app.use("/api/inspection", inspectionRoutes);
app.use("/api/applications", applicationRoutes);
app.use("/api/review", reviewRoutes);
app.use("/api/logs", logRoutes);
app.use("/api/blockchain", blockchainRoutes);

// ===================== STATIC FILES =====================
app.use(
  "/uploads",
  express.static(path.join(__dirname, "uploads"))
);

// ===================== USERS ROUTE =====================
app.get("/api/users", async (req, res) => {
  try {
    const filter = {};

    if (req.query.role) {
      filter.role = req.query.role;
    }

    const users = await User.find(
      filter,
      "-password -resetToken -resetTokenExpiry"
    );

    res.json(users);
  } catch (err) {
    console.error("❌ Error fetching users:", err);

    res.status(500).json({
      message: "Server error",
    });
  }
});

// ===================== ROOT ROUTES =====================
app.get("/", (req, res) => {
  res.send("🚀 TrustPermit API running");
});

app.get("/api", (req, res) => {
  res.json({
    success: true,
    message: "TrustPermit API is running",
  });
});

app.get("/api/test", (req, res) => {
  res.json({
    success: true,
    message: "Backend connected successfully",
  });
});

// ===================== SERVER =====================
const PORT = process.env.PORT || 5000;

server.listen(PORT, "0.0.0.0", () => {
  console.log(`🚀 Server running on port ${PORT}`);
  console.log(`🌐 Local: http://localhost:${PORT}`);
});