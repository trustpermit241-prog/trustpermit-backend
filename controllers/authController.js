const bcrypt = require("bcrypt");
const User = require("../models/User");

// In-memory OTP store for forgot password
const forgotOtpStore = {};

// ================== FORGOT PASSWORD ==================
exports.forgotPassword = async (req, res) => {
  const { email } = req.body;
  if (!email) return res.status(400).json({ message: "Email is required." });

  const user = await User.findOne({ email });
  if (!user) return res.status(404).json({ message: "User not found." });

  // Generate OTP
  const otp = Math.floor(100000 + Math.random() * 900000).toString();
  forgotOtpStore[email] = {
    otp,
    expires: Date.now() + 15 * 60 * 1000, // 15 minutes
  };

  console.log(`[Forgot OTP] Code for ${email}: ${otp}`); // for testing
  res.json({ message: "OTP sent to your email." });
};

// ================== VERIFY FORGOT PASSWORD OTP ==================
exports.verifyForgotOtp = (req, res) => {
  const { email, otp } = req.body;
  const record = forgotOtpStore[email];

  if (!record) return res.status(400).json({ message: "No OTP found." });
  if (Date.now() > record.expires) return res.status(400).json({ message: "OTP expired." });
  if (record.otp !== otp) return res.status(400).json({ message: "Invalid OTP." });

  delete forgotOtpStore[email]; // OTP used
  res.json({ message: "OTP verified successfully." });
};

// ================== RESET PASSWORD ==================
exports.resetPassword = async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) return res.status(400).json({ message: "Email and password are required." });

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
};
