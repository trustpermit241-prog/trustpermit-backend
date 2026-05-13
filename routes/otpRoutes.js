const express = require("express");
const router = express.Router();
const nodemailer = require("nodemailer");

// Temporary in-memory OTP store
const otpStore = {};

// ================= EMAIL TRANSPORTER =================
const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
});

// ================= SEND OTP =================
router.post("/send-otp", async (req, res) => {
  const { email, otp } = req.body;

  if (!email || !otp) {
    return res.status(400).json({
      success: false,
      message: "Email and OTP required",
    });
  }

  try {
    otpStore[email] = {
      otp,
      expires: Date.now() + 15 * 60 * 1000,
    };

    await transporter.sendMail({
      from: `"TrustPermit" <${process.env.EMAIL_USER}>`,
      to: email,
      subject: "Your TrustPermit OTP Code",
      html: `
        <div style="font-family: Arial, sans-serif; padding: 20px;">
          <h2>TrustPermit Email Verification</h2>
          <p>Hello,</p>
          <p>Your OTP verification code is:</p>

          <h1 style="
            letter-spacing: 4px;
            background: #f1f5f9;
            padding: 12px 18px;
            display: inline-block;
            border-radius: 8px;
            color: #2563eb;
          ">
            ${otp}
          </h1>

          <p>This code will expire in 15 minutes.</p>
          <p>If you did not request this, please ignore this email.</p>
        </div>
      `,
    });

    console.log(`[OTP SENT] Code for ${email}: ${otp}`);

    return res.json({
      success: true,
      message: "OTP sent successfully",
    });
  } catch (error) {
    console.error("OTP email send error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to send OTP email",
      error: error.message,
    });
  }
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