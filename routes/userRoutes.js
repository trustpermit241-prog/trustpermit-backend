const express = require("express");
const router = express.Router();
const crypto = require("crypto");
const jwt = require("jsonwebtoken");
const User = require("../models/User");

function hashPassword(password, salt) {
  return crypto.pbkdf2Sync(password, salt, 100000, 64, "sha512").toString("hex");
}

function generateApiToken() {
  return crypto.randomBytes(32).toString("hex");
}

// ================= GET ALL CITIZENS =================
router.get("/", async (req, res) => {
  try {
    const users = await User.find(
      { role: "citizen" },
      "-passwordHash -salt -apiToken"
    );

    res.json(users);
  } catch (err) {
    console.error("Error fetching users:", err);
    res.status(500).json({ message: "Server error" });
  }
});

// ================= CREATE ACCOUNT =================
router.post("/create", async (req, res) => {
  const { name, fullName, email, password, role } = req.body;

  try {
    if (!email || !password || (!name && !fullName)) {
      return res.status(400).json({
        success: false,
        message: "Name, email, and password are required.",
      });
    }

    const normalizedEmail = String(email).toLowerCase().trim();

    const existingUser = await User.findOne({ email: normalizedEmail });
    if (existingUser) {
      return res.status(400).json({
        success: false,
        message: "User already exists",
      });
    }

    const salt = crypto.randomBytes(16).toString("hex");
    const passwordHash = hashPassword(password, salt);

    const userRole = role || "citizen";
    const isStaffOrAdmin = userRole === "staff" || userRole === "admin";

    const newUser = new User({
      fullName: fullName || name,
      email: normalizedEmail,
      passwordHash,
      salt,
      role: userRole,
      status: "Active",
      isVerified: isStaffOrAdmin ? true : false,
    });

    await newUser.save();

    const token = generateApiToken();

    newUser.apiToken = token;
    await newUser.save();

    res.status(201).json({
      success: true,
      message: `${userRole} account created successfully`,
      user: {
        id: newUser._id,
        fullName: newUser.fullName,
        email: newUser.email,
        role: newUser.role,
      },
      token,
    });
  } catch (err) {
    console.error("CREATE USER ERROR:", err);
    res.status(500).json({
      success: false,
      message: "Server error",
      error: err.message,
    });
  }
});

// ================= LOGIN =================
router.post("/login", async (req, res) => {
  const { email, password } = req.body;

  try {
    if (!email || !password) {
      return res.status(400).json({
        success: false,
        message: "Email and password are required.",
      });
    }

    const normalizedEmail = String(email).toLowerCase().trim();

    const user = await User.findOne({ email: normalizedEmail });

    if (!user) {
      return res.status(401).json({
        success: false,
        message: "Invalid login credentials.",
      });
    }

    if (!user.salt || !user.passwordHash) {
      return res.status(401).json({
        success: false,
        message: "Invalid login credentials.",
      });
    }

    const inputHash = hashPassword(password, user.salt);
    const isMatch = inputHash === user.passwordHash;

    if (!isMatch) {
      return res.status(401).json({
        success: false,
        message: "Invalid login credentials.",
      });
    }

    if (!user.isVerified && user.role === "citizen") {
      return res.status(403).json({
        success: false,
        message: "Please verify your email first",
      });
    }

    const apiToken = user.apiToken || generateApiToken();

    if (!user.apiToken) {
      user.apiToken = apiToken;
      await user.save();
    }

    res.json({
      success: true,
      message: "Login successful",
      user: {
        id: user._id,
        fullName: user.fullName,
        email: user.email,
        role: user.role,
      },
      token: apiToken,
    });
  } catch (err) {
    console.error("LOGIN ERROR:", err);
    res.status(500).json({
      success: false,
      message: "Server error",
      error: err.message,
    });
  }
});

module.exports = router;