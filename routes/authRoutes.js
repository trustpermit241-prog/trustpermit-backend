const express = require("express");
const router = express.Router();
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const User = require("../models/User");
const SystemLog = require("../models/SystemLog");
const protect = require("../middleware/authMiddleware");

// ====================== REGISTER ======================
router.post("/register", async (req, res) => {
  const { fullName, email, password } = req.body;

  if (!fullName || !email || !password) {
    return res.status(400).json({ message: "All fields required" });
  }

  try {
    const existingUser = await User.findOne({ email });
    if (existingUser)
      return res.status(400).json({ message: "Email already registered" });

    const hashedPassword = await bcrypt.hash(password, 10);

    const user = await User.create({
      fullName,
      email,
      password: hashedPassword,
      role: "citizen",
      emailVerified: true,
      status: "Active",
    });

    return res.json({
      success: true,
      message: "User registered successfully",
      user: {
        id: user._id,
        name: user.fullName,
        fullName: user.fullName,
        email: user.email,
        role: user.role,
      },
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: "Server error" });
  }
});

// ====================== CREATE STAFF/ADMIN ======================
router.post("/create", async (req, res) => {
  const { fullName, name, email, password, role } = req.body;
  const userName = fullName || name;
  const normalizedRole = (role || "citizen").toLowerCase();

  if (!userName || !email || !password) {
    return res.status(400).json({ message: "Full name, email and password are required." });
  }

  try {
    const existingUser = await User.findOne({ email });
    if (existingUser)
      return res.status(400).json({ message: "User already exists" });

    const hashedPassword = await bcrypt.hash(password, 10);
    const isStaffOrAdmin = normalizedRole === "staff" || normalizedRole === "admin";

    const user = await User.create({
      fullName: userName,
      email,
      password: hashedPassword,
      role: normalizedRole,
      status: "Active",
      emailVerified: isStaffOrAdmin,
    });

    const token = jwt.sign(
      { _id: user._id, role: user.role, email: user.email },
      process.env.JWT_SECRET || "secret",
      { expiresIn: "7d" }
    );

    try {
      await SystemLog.create({
        type: normalizedRole === "staff" ? "staff" : normalizedRole === "admin" ? "security" : "user",
        message: `${normalizedRole.charAt(0).toUpperCase() + normalizedRole.slice(1)} ${userName} created`,
      });
    } catch (logError) {
      console.error("Error creating system log for new user:", logError);
    }

    return res.status(201).json({
      message: `${normalizedRole} account created successfully`,
      user,
      token,
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: "Server error" });
  }
});

// ====================== LOGIN ======================
router.post("/login", async (req, res) => {
  const { email, password } = req.body;

  try {
    const user = await User.findOne({ email });
    if (!user) return res.status(400).json({ message: "Invalid credentials" });

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) return res.status(400).json({ message: "Invalid credentials" });

    const token = jwt.sign(
      { _id: user._id, role: user.role, email: user.email },
      process.env.JWT_SECRET || "secret",
      { expiresIn: "1d" }
    );

    try {
      const logType = user.role === "admin" ? "security" : user.role === "staff" ? "staff" : "user";
      const userName = user.fullName || user.name || user.email || "Unknown user";
      await SystemLog.create({
        type: logType,
        message: `${userName} logged in`,
      });
    } catch (logError) {
      console.error("Error creating system log for login:", logError);
    }

    res.json({
      token,
      role: user.role,
      userId: user._id, // convenience
      user: {
        _id: user._id,
        id: user._id,
        name: user.fullName,       // 🔥 FIX
        fullName: user.fullName,   // keep original
        email: user.email,
        role: user.role,
      },
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
});

// ====================== GET CURRENT USER ======================
router.get("/me", protect, async (req, res) => {
  try {
    const userId = req.user._id || req.user.id;

    const user = await User.findById(userId).select(
      "-password -resetToken -resetTokenExpiry"
    );

    if (!user) return res.status(404).json({ message: "User not found" });

    res.json({
      _id: user._id,
      name: user.fullName,      // 🔥 FIX
      fullName: user.fullName,
      email: user.email,
      role: user.role,
      emailVerified: user.emailVerified,
      createdAt: user.createdAt,
    });
  } catch (err) {
    console.error("Get current user error:", err);
    res.status(500).json({ message: "Server error" });
  }
});

// ====================== FORGOT PASSWORD FLOW ======================

// In-memory OTP store
const forgotOtpStore = {};

// Send OTP
router.post("/forgot-password", async (req, res) => {
  const { email } = req.body;
  if (!email) return res.status(400).json({ message: "Email is required" });

  try {
    const user = await User.findOne({ email });
    if (!user) return res.status(404).json({ message: "User not found" });

    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    forgotOtpStore[email] = {
      otp,
      expires: Date.now() + 15 * 60 * 1000,
    };

    console.log(`[Forgot OTP] ${email}: ${otp}`);

    res.json({ message: "OTP sent to your email." });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
});

// Verify OTP
router.post("/verify-forgot-otp", (req, res) => {
  const { email, otp } = req.body;
  const record = forgotOtpStore[email];

  if (!record) return res.status(400).json({ message: "No OTP found." });
  if (Date.now() > record.expires) return res.status(400).json({ message: "OTP expired." });
  if (record.otp !== otp) return res.status(400).json({ message: "Invalid OTP." });

  delete forgotOtpStore[email];
  res.json({ message: "OTP verified successfully." });
});

// Reset password
router.post("/reset-password", async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password)
    return res.status(400).json({ message: "Email and password required." });

  try {
    const user = await User.findOne({ email });
    if (!user) return res.status(404).json({ message: "User not found." });

    const hashedPassword = await bcrypt.hash(password, 10);
    user.password = hashedPassword;
    await user.save();

    res.json({ message: "Password reset successfully." });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Failed to reset password." });
  }
});

module.exports = router;
