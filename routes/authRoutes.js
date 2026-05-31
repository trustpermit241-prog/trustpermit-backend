const express = require('express');
const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const SystemLog = require('../models/SystemLog');

const router = express.Router();

const JWT_SECRET = process.env.JWT_SECRET || 'trustpermit_secret_key';

function hashPassword(password, salt) {
  return crypto.pbkdf2Sync(password, salt, 100000, 64, 'sha512').toString('hex');
}

function generateApiToken() {
  return crypto.randomBytes(32).toString('hex');
}

function generateJwtToken(user) {
  return jwt.sign(
    {
      id: user._id,
      _id: user._id,
      role: user.role,
      email: user.email,
    },
    JWT_SECRET,
    { expiresIn: '7d' }
  );
}

// ====================== REGISTER ======================
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
      role: 'citizen',
      status: 'Active',
      emailVerified: true,
      isVerified: true,
    });

    const token = generateJwtToken(user);

    return res.status(201).json({
      success: true,
      message: 'User registered successfully.',
      user: {
        id: user._id,
        _id: user._id,
        fullName: user.fullName,
        email: user.email,
        role: user.role,
      },
      token,
    });
  } catch (error) {
    console.error('REGISTER ERROR:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to register user.',
      error: error.message,
    });
  }
});

// ====================== CREATE STAFF/ADMIN ======================
router.post('/create', async (req, res) => {
  try {
    const { fullName, name, email, password, role } = req.body;
    const userName = fullName || name;
    const normalizedRole = String(role || 'citizen').toLowerCase().trim();
    const normalizedEmail = String(email || '').toLowerCase().trim();

    if (!userName || !normalizedEmail || !password) {
      return res.status(400).json({
        success: false,
        message: 'Full name, email, and password are required.',
      });
    }

    const existingUser = await User.findOne({ email: normalizedEmail });
    if (existingUser) {
      return res.status(400).json({
        success: false,
        message: 'User already exists',
      });
    }

    const salt = crypto.randomBytes(16).toString('hex');
    const passwordHash = hashPassword(password, salt);
    const apiToken = generateApiToken();

    const user = await User.create({
      fullName: userName.trim(),
      email: normalizedEmail,
      salt,
      passwordHash,
      apiToken,
      role: normalizedRole,
      status: 'Active',
      emailVerified: normalizedRole === 'staff' || normalizedRole === 'admin',
      isVerified: normalizedRole === 'staff' || normalizedRole === 'admin',
    });

    const token = generateJwtToken(user);

    return res.status(201).json({
      success: true,
      message: `${normalizedRole} account created successfully`,
      user: {
        id: user._id,
        _id: user._id,
        fullName: user.fullName,
        email: user.email,
        role: user.role,
      },
      token,
    });
  } catch (error) {
    console.error('CREATE USER ERROR:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to create user.',
      error: error.message,
    });
  }
});

// ====================== LOGIN ======================
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

    const user = await User.findOne({
      email: { $regex: new RegExp(`^${normalizedEmail}$`, 'i') },
    });

    if (!user) {
      return res.status(401).json({
        success: false,
        message: 'Invalid login credentials.',
      });
    }

    let passwordMatch = false;

    if (user.salt && user.passwordHash) {
      const inputHash = hashPassword(password, user.salt);
      passwordMatch = inputHash === user.passwordHash;
    }

    if (!passwordMatch && user.password) {
      passwordMatch = bcrypt.compareSync(password, user.password);
    }

    if (!passwordMatch && user.passwordHash && user.passwordHash.startsWith('$2')) {
      passwordMatch = bcrypt.compareSync(password, user.passwordHash);
    }

    if (!passwordMatch) {
      return res.status(401).json({
        success: false,
        message: 'Invalid login credentials.',
      });
    }

    if (!user.apiToken) {
      user.apiToken = generateApiToken();
      await user.save();
    }

    const token = generateJwtToken(user);

    await SystemLog.create({
      type: 'user',
      message: `${user.fullName || user.email} logged in`,
      meta: {
        userId: user._id,
        email: user.email,
        role: user.role,
      },
    });

    return res.status(200).json({
      success: true,
      message: 'Login successful.',
      user: {
        id: user._id,
        _id: user._id,
        fullName: user.fullName,
        email: user.email,
        role: user.role,
      },
      token,
    });
  } catch (error) {
    console.error('LOGIN ERROR:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to authenticate user.',
      error: error.message,
    });
  }
});

module.exports = router;