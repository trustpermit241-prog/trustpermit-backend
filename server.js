const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
require("dotenv").config();

const applicationRoutes = require("./routes/applicationRoutes");
const authRoutes = require("./routes/authRoutes");
const paymentRoutes = require("./routes/paymentRoutes");

const app = express();

// ===== IMPROVED CORS CONFIGURATION =====
const allowedOrigins = [
  'http://localhost:5000',
  'http://localhost:3000',
  'http://10.0.2.2:5000',
  'http://10.0.2.2:3000',
  'https://trustpermit-backend.onrender.com',
  'https://trustpermit-web.vercel.app',
  'https://trustpermit-web.netlify.app',
  // Add your web domain here when deployed
];

app.use(cors({
  origin: function (origin, callback) {
    // Allow requests with no origin (like mobile apps)
    if (!origin) return callback(null, true);
    
    if (allowedOrigins.indexOf(origin) !== -1) {
      callback(null, true);
    } else {
      console.log(`CORS blocked origin: ${origin}`);
      callback(null, true); // Allow for now, log for debugging
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}));

app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

// ===== HEALTH CHECK ENDPOINTS =====
app.get("/", (req, res) => {
  res.json({
    status: "ok",
    message: "TrustPermit Backend API is running",
    timestamp: new Date().toISOString(),
  });
});

app.get("/api", (req, res) => {
  res.json({
    success: true,
    message: "TrustPermit API is running",
    version: "1.0.0",
  });
});

app.get("/api/health", (req, res) => {
  const health = {
    status: "healthy",
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    mongodb: mongoose.connection.readyState === 1 ? "connected" : "disconnected",
  };
  res.json(health);
});

// ===== ROUTES =====
app.use("/api/auth", authRoutes);
app.use("/api/applications", applicationRoutes);
app.use("/api/payments", paymentRoutes);

// ===== MONGODB CONNECTION =====
const MONGODB_URI = process.env.MONGODB_URI;
const MONGO_DB_NAME = process.env.MONGO_DB_NAME || 'trustpermit';

if (!MONGODB_URI) {
  console.error("❌ MONGODB_URI is not set in environment variables");
  console.error("Please set MONGODB_URI in your .env file or Render environment");
} else {
  mongoose
    .connect(MONGODB_URI, {
      dbName: MONGO_DB_NAME,
      maxPoolSize: 10,
    })
    .then(() => {
      console.log(`✅ MongoDB Connected Successfully to ${MONGO_DB_NAME}`);
    })
    .catch((err) => {
      console.error("❌ MongoDB Connection Error:", err.message);
      // Don't exit - app can start but will fail on DB operations
    });
}

// ===== MONGODB EVENT HANDLERS =====
mongoose.connection.on('disconnected', () => {
  console.warn('⚠️  MongoDB disconnected');
});

mongoose.connection.on('reconnected', () => {
  console.log('✅ MongoDB reconnected');
});

// ===== ERROR HANDLING MIDDLEWARE =====
app.use((err, req, res, next) => {
  console.error('Unhandled Error:', {
    message: err.message,
    status: err.status || 500,
    path: req.path,
    method: req.method,
  });

  const statusCode = err.status || 500;
  res.status(statusCode).json({
    success: false,
    message: err.message || 'Internal Server Error',
    status: statusCode,
  });
});

// ===== 404 HANDLER =====
app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: 'Endpoint not found',
    path: req.path,
    method: req.method,
  });
});

// ===== SERVER START =====
const PORT = process.env.PORT || 5000;

const server = app.listen(PORT, () => {
  console.log(`✅ Server running on port ${PORT}`);
  console.log(`📍 Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log(`📊 API URL: http://localhost:${PORT}/api`);
});

// ===== GRACEFUL SHUTDOWN =====
process.on('SIGTERM', () => {
  console.log('SIGTERM signal received: closing HTTP server');
  server.close(() => {
    console.log('HTTP server closed');
    mongoose.connection.close(false, () => {
      console.log('MongoDB connection closed');
      process.exit(0);
    });
  });
});