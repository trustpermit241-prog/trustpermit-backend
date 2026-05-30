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

    if (!fullName || !email || !password) {
      return res.status(400).json({
        success: false,
        message: 'Name, email, and password are required.',
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
  }
});

router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({
        success: false,
        message: 'Email and password are required.',
      });
    }

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
      message: 'Failed to authenticate user.',
      error: error.message,
    });
  }
});

module.exports = router;
