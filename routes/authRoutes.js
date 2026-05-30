const express = require('express');
const crypto = require('crypto');
const User = require('../models/User');

const router = express.Router();

function hashPassword(password, salt) {
  return crypto
    .pbkdf2Sync(password, salt, 100000, 64, 'sha512')
    .toString('hex');
}

function generateApiToken() {
  return crypto.randomBytes(32).toString('hex');
}

router.post('/register', async (req, res) => {
  try {
    const { fullName, email, password } = req.body;

<<<<<<< HEAD
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
    console.error("Register error:", err);
    return res.status(500).json({ message: "Server error" });
  }
});

// ====================== CREATE STAFF/ADMIN ======================
router.post("/create", async (req, res) => {
  const { fullName, name, email, password, role } = req.body;
  const userName = fullName || name;
  const normalizedRole = (role || "citizen").toLowerCase();

  if (!userName || !email || !password) {
    return res
      .status(400)
      .json({ message: "Full name, email and password are required." });
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
      const logType =
        normalizedRole === "staff"
          ? "staff"
          : normalizedRole === "admin"
          ? "security"
          : "user";
      await SystemLog.create({
        type: logType,
        message: `${normalizedRole.charAt(0).toUpperCase() + normalizedRole.slice(1)} ${userName} created`,
=======
    if (!fullName || !email || !password) {
      return res.status(400).json({
        success: false,
        message: 'Name, email, and password are required.',
>>>>>>> 7d686e5afb69f5ebe8b0b58cae1f9ecde2078447
      });
    }

    const normalizedEmail = String(email).toLowerCase().trim();
    const existing = await User.findOne({ email: normalizedEmail });
    if (existing) {
      return res.status(409).json({
        success: false,
        message: 'Email already registered.',
      });
    }

    const salt = crypto.randomBytes(16).toString('hex');
    const passwordHash = hashPassword(password, salt);

    const apiToken = generateApiToken();
    const user = await User.create({
      fullName: fullName.trim(),
      email: normalizedEmail,
      salt,
      passwordHash,
      apiToken,
    });

    return res.status(201).json({
      success: true,
      message: 'User registered successfully.',
      user: {
        id: user._id,
        fullName: user.fullName,
        email: user.email,
      },
      token: apiToken,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: 'Failed to register user.',
      error: error.message,
    });
<<<<<<< HEAD
  } catch (err) {
    console.error("Create user error:", err);
    return res.status(500).json({ message: "Server error" });
  }
});

// ====================== LOGIN ======================
router.post("/login", async (req, res) => {
  const { email, password } = req.body;

  console.log("Login attempt:", req.body);

  try {
    // Always include password for comparison
    const user = await User.findOne({ email }).select("+password");
    console.log("User found:", user);

    if (!user) return res.status(400).json({ message: "Invalid credentials" });

    const isMatch = await bcrypt.compare(password, user.password);
    console.log("Password match:", isMatch);

    if (!isMatch) return res.status(400).json({ message: "Invalid credentials" });

    const token = jwt.sign(
      { _id: user._id, role: user.role, email: user.email },
      process.env.JWT_SECRET || "secret",
      { expiresIn: "1d" }
    );

    try {
      const logType =
        user.role === "admin" ? "security" : user.role === "staff" ? "staff" : "user";
      const userName = user.fullName || user.name || user.email || "Unknown user";
      await SystemLog.create({
        type: logType,
        message: `${userName} logged in`,
=======
  }
});

router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({
        success: false,
        message: 'Email and password are required.',
>>>>>>> 7d686e5afb69f5ebe8b0b58cae1f9ecde2078447
      });
    }

<<<<<<< HEAD
    res.json({
      token,
      role: user.role,
      userId: user._id,
=======
    const normalizedEmail = String(email).toLowerCase().trim();
    const user = await User.findOne({ email: normalizedEmail });
    if (!user) {
      return res.status(401).json({
        success: false,
        message: 'Invalid login credentials.',
      });
    }

    const passwordHash = hashPassword(password, user.salt);
    if (passwordHash !== user.passwordHash) {
      return res.status(401).json({
        success: false,
        message: 'Invalid login credentials.',
      });
    }

    const apiToken = user.apiToken || generateApiToken();
    if (!user.apiToken) {
      user.apiToken = apiToken;
      await user.save();
    }

    return res.status(200).json({
      success: true,
      message: 'Login successful.',
>>>>>>> 7d686e5afb69f5ebe8b0b58cae1f9ecde2078447
      user: {
        id: user._id,
<<<<<<< HEAD
        name: user.fullName,
=======
>>>>>>> 7d686e5afb69f5ebe8b0b58cae1f9ecde2078447
        fullName: user.fullName,
        email: user.email,
      },
      token: apiToken,
    });
<<<<<<< HEAD
  } catch (err) {
    console.error("Login route error:", err);
    res.status(500).json({ message: "Server error" });
  }
});

// ====================== GET CURRENT USER ======================
router.get("/me", protect, async (req, res) => {
  try {
    const userId = req.user._id || req.user.id;

    const user = await User.findById(userId).select("-password -resetToken -resetTokenExpiry");

    if (!user) return res.status(404).json({ message: "User not found" });

    res.json({
      _id: user._id,
      name: user.fullName,
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

// ====================== FORGOT PASSWORD ======================
const forgotOtpStore = {};

router.post("/forgot-password", async (req, res) => {
  const { email } = req.body;
  if (!email) return res.status(400).json({ message: "Email is required" });

  try {
    const user = await User.findOne({ email });
    if (!user) return res.status(404).json({ message: "User not found" });

    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    forgotOtpStore[email] = { otp, expires: Date.now() + 15 * 60 * 1000 };

    console.log(`[Forgot OTP] ${email}: ${otp}`);

    res.json({ message: "OTP sent to your email." });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
});

router.post("/verify-forgot-otp", (req, res) => {
  const { email, otp } = req.body;
  const record = forgotOtpStore[email];

  if (!record) return res.status(400).json({ message: "No OTP found." });
  if (Date.now() > record.expires) return res.status(400).json({ message: "OTP expired." });
  if (record.otp !== otp) return res.status(400).json({ message: "Invalid OTP." });

  delete forgotOtpStore[email];
  res.json({ message: "OTP verified successfully." });
});

router.post("/reset-password", async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) return res.status(400).json({ message: "Email and password required" });

  try {
    const user = await User.findOne({ email }).select("+password"); // include password if hidden
    if (!user) return res.status(404).json({ message: "User not found" });

    user.password = await bcrypt.hash(password, 10);
    await user.save();

    res.json({ message: "Password reset successfully." });
  } catch (err) {
    console.error("Reset password error:", err);
    res.status(500).json({ message: "Failed to reset password." });
=======
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: 'Failed to authenticate user.',
      error: error.message,
    });
>>>>>>> 7d686e5afb69f5ebe8b0b58cae1f9ecde2078447
  }
});

module.exports = router;