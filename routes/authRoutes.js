const express = require('express');
const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const SystemLog = require('../models/SystemLog');
const authMiddleware = require('../middleware/authMiddleware');
const { OAuth2Client } = require('google-auth-library');
const emailjs = require('@emailjs/nodejs');

const router = express.Router();

// Ensure JWT_SECRET is set with a fallback for development
const JWT_SECRET = process.env.JWT_SECRET || 'default-secret-key-change-in-production';

if (!process.env.JWT_SECRET && process.env.NODE_ENV === 'production') {
  console.warn('⚠️ WARNING: JWT_SECRET environment variable not set in production!');
}

function hashPassword(password, salt) {
  return crypto.pbkdf2Sync(password, salt, 100000, 64, 'sha512').toString('hex');
}

function generateApiToken() {
  return crypto.randomBytes(32).toString('hex');
}

function generateJwtToken(user) {
  if (!JWT_SECRET) {
    throw new Error('JWT_SECRET is not configured');
  }
  
  if (!user || !user._id) {
    throw new Error('User object is invalid for token generation');
  }

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

function createGoogleVerificationToken(payload, verificationCode) {
  return jwt.sign({
    purpose: 'google-verification',
    googleId: payload.sub,
    email: payload.email.toLowerCase().trim(),
    fullName: payload.name || payload.email.split('@')[0],
    profileImage: payload.picture || '',
    verificationCode,
  }, JWT_SECRET, { expiresIn: '10m' });
}

function createVerificationOptions(correctCode) {
  const options = new Set([correctCode]);
  while (options.size < 3) options.add(String(crypto.randomInt(100000, 1000000)));
  return Array.from(options).sort(() => Math.random() - 0.5);
}

async function sendGoogleConfirmationEmail({ email, fullName, setupToken }) {
  const serviceId = process.env.EMAILJS_SERVICE_ID;
  const templateId = process.env.EMAILJS_GOOGLE_CONFIRMATION_TEMPLATE_ID;
  const publicKey = process.env.EMAILJS_PUBLIC_KEY;
  const privateKey = process.env.EMAILJS_PRIVATE_KEY;

  if (!serviceId || !templateId || !publicKey || !privateKey) {
    console.warn('Google confirmation email is not configured.');
    return false;
  }

  await emailjs.send(serviceId, templateId, {
    to_email: email,
    to_name: fullName,
    activity_title: 'New sign-in activity',
    activity_message: 'Your account is trying to sign in on TrustPermit.',
    verification_code: setupToken.verificationCode,
  }, { publicKey, privateKey });
  return true;
}

// ====================== GOOGLE LOGIN ======================
router.post('/google', async (req, res) => {
  try {
    const { credential } = req.body;

    if (!credential || !process.env.GOOGLE_CLIENT_ID) {
      return res.status(400).json({
        success: false,
        message: !process.env.GOOGLE_CLIENT_ID
          ? 'Google login is not configured.'
          : 'Google credential is required.',
      });
    }

    const googleClient = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);
    const ticket = await googleClient.verifyIdToken({
      idToken: credential,
      audience: process.env.GOOGLE_CLIENT_ID,
    });
    const payload = ticket.getPayload();

    if (!payload?.sub || !payload.email || !payload.email_verified) {
      return res.status(401).json({
        success: false,
        message: 'Google account could not be verified.',
      });
    }

    const normalizedEmail = payload.email.toLowerCase().trim();
    const existingUser = await User.findOne({
      $or: [{ googleId: payload.sub }, { email: normalizedEmail }],
    });

    if (existingUser && existingUser.authProvider !== 'google') {
      return res.status(409).json({
        success: false,
        message: 'An account with this email already exists. Please use your password to log in.',
      });
    }

    if (existingUser && existingUser.authProvider === 'google') {
      if (!existingUser.apiToken) {
        existingUser.apiToken = generateApiToken();
        await existingUser.save();
      }

      const token = generateJwtToken(existingUser);
      await SystemLog.create({
        type: 'user',
        message: `${existingUser.fullName || existingUser.email} logged in with Google`,
        meta: { userId: existingUser._id, email: existingUser.email, role: existingUser.role },
      });

      return res.status(200).json({
        success: true,
        message: 'Google login successful.',
        user: {
          id: existingUser._id,
          _id: existingUser._id,
          fullName: existingUser.fullName,
          email: existingUser.email,
          role: existingUser.role,
        },
        token,
      });
    }

    const verificationCode = String(crypto.randomInt(100000, 1000000));
    const verificationToken = createGoogleVerificationToken(payload, verificationCode);
    const verificationOptions = createVerificationOptions(verificationCode);
    let emailSent = false;
    try {
      emailSent = await sendGoogleConfirmationEmail({
        email: normalizedEmail,
        fullName: payload.name || normalizedEmail.split('@')[0],
        setupToken: { verificationCode },
      });
    } catch (emailError) {
      console.error('GOOGLE CONFIRMATION EMAIL ERROR:', emailError.message);
    }

    return res.status(200).json({
      success: true,
      requiresPassword: true,
      emailSent,
      message: emailSent
        ? 'Sign-in activity email sent. Review the activity below.'
        : 'Google verified. Review the sign-in activity below.',
      setupToken: verificationToken,
      verificationOptions,
    });
  } catch (error) {
    console.error('GOOGLE LOGIN ERROR:', error.message);
    return res.status(401).json({
      success: false,
      message: 'Google login failed. Please try again.',
    });
  }
});

// ====================== VERIFY GOOGLE CODE ======================
router.post('/google/verify-code', async (req, res) => {
  try {
    const { verificationToken, verificationCode } = req.body;
    if (!verificationToken || !/^\d{6}$/.test(String(verificationCode || ''))) {
      return res.status(400).json({ success: false, message: 'Enter the 6-digit verification code.' });
    }

    const verification = jwt.verify(verificationToken, JWT_SECRET);
    if (verification.purpose !== 'google-verification' || verification.verificationCode !== String(verificationCode)) {
      return res.status(401).json({ success: false, message: 'Incorrect verification code.' });
    }

    const setupToken = jwt.sign({
      purpose: 'google-account-setup',
      googleId: verification.googleId,
      email: verification.email,
      fullName: verification.fullName,
      profileImage: verification.profileImage,
    }, JWT_SECRET, { expiresIn: '30m' });

    return res.json({ success: true, message: 'Code verified. Create a password to finish registration.', setupToken });
  } catch (error) {
    console.error('GOOGLE CODE ERROR:', error.message);
    return res.status(401).json({ success: false, message: 'The verification code is invalid or expired.' });
  }
});

// ====================== COMPLETE GOOGLE ACCOUNT ======================
router.post('/google/complete', async (req, res) => {
  try {
    const { setupToken, password } = req.body;
    if (!setupToken || !password || password.length < 8) {
      return res.status(400).json({ success: false, message: 'A valid setup token and password of at least 8 characters are required.' });
    }

    const setup = jwt.verify(setupToken, JWT_SECRET);
    if (setup.purpose !== 'google-account-setup') throw new Error('Invalid setup token purpose');

    const salt = crypto.randomBytes(16).toString('hex');
    let user = await User.findOne({ $or: [{ googleId: setup.googleId }, { email: setup.email }] });
    if (!user) {
      user = await User.create({
        fullName: setup.fullName,
        email: setup.email,
        profileImage: setup.profileImage,
        googleId: setup.googleId,
        authProvider: 'google',
        salt,
        passwordHash: hashPassword(password, salt),
        apiToken: generateApiToken(),
        role: 'citizen',
        status: 'Active',
        isVerified: true,
      });
    } else {
      user.fullName = setup.fullName || user.fullName;
      user.googleId = setup.googleId;
      user.authProvider = 'google';
      user.salt = salt;
      user.passwordHash = hashPassword(password, salt);
      user.isVerified = true;
      if (!user.apiToken) user.apiToken = generateApiToken();
      await user.save();
    }

    const token = generateJwtToken(user);
    await SystemLog.create({ type: 'user', message: `${user.fullName || user.email} registered with Google`, meta: { userId: user._id, email: user.email, role: user.role } });
    return res.status(201).json({ success: true, message: 'Account registered successfully.', user: { id: user._id, _id: user._id, fullName: user.fullName, email: user.email, role: user.role }, token });
  } catch (error) {
    console.error('COMPLETE GOOGLE ACCOUNT ERROR:', error.message);
    return res.status(400).json({ success: false, message: 'The Google setup link is invalid or expired.' });
  }
});

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
router.post('/create', authMiddleware, async (req, res) => {
  try {
    if (req.user.role !== 'admin') {
      return res.status(403).json({ success: false, message: 'Admin access required.' });
    }

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

// ====================== RESET PASSWORD ======================
router.post('/reset-password', authMiddleware, async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({
        success: false,
        message: 'Email and password are required.',
      });
    }

    const normalizedEmail = String(email).toLowerCase().trim();
    if (normalizedEmail !== String(req.user.email).toLowerCase()) {
      return res.status(403).json({
        success: false,
        message: 'You can only reset your own password.',
      });
    }

    const user = await User.findOne({ email: normalizedEmail });

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found.',
      });
    }

    const newSalt = crypto.randomBytes(16).toString('hex');
    const newPasswordHash = hashPassword(password, newSalt);

    user.passwordHash = newPasswordHash;
    user.salt = newSalt;
    delete user.password;
    await user.save();

    return res.json({
      success: true,
      message: 'Password reset successfully.',
    });
  } catch (error) {
    console.error('RESET PASSWORD ERROR:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to reset password.',
      error: error.message,
    });
  }
});

module.exports = router;