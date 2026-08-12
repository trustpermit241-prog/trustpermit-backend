const express = require("express");
const router = express.Router();

// Temporary in-memory OTP store
const otpStore = {};

// ================= SEND OTP =================
router.post("/send-otp", async (req, res) => {
  const { email, otp } = req.body;

  if (!email || !otp) {
    return res.status(400).json({
      success: false,
      message: "Email and OTP required",
    });
  }

  otpStore[email] = {
    otp,
    expires: Date.now() + 15 * 60 * 1000,
  };

  console.log(`[OTP STORE] Saved OTP for ${email}`);

  return res.json({
    success: true,
    message: "OTP stored successfully",
  });
});

// ================= VERIFY OTP =================
router.post("/verify-otp", async (req, res) => {
  const { email, otp } = req.body;

  if (!email || !otp) {
    return res.status(400).json({
      success: false,
      message: "Email and OTP required",
    });
  }

  const record = otpStore[email];

  if (!record) {
    return res.status(400).json({
      success: false,
      message: "No OTP found",
    });
  }

  if (Date.now() > record.expires) {
    delete otpStore[email];

    return res.status(400).json({
      success: false,
      message: "OTP expired",
    });
  }

  if (record.otp !== otp) {
    return res.status(400).json({
      success: false,
      message: "Invalid OTP",
    });
  }

  delete otpStore[email];

  return res.json({
    success: true,
    message: "OTP verified successfully",
  });
});

module.exports = router;