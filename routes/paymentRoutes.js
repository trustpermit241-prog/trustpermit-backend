const express = require("express");
const router = express.Router();
const Payment = require("../models/Payment");

// CREATE PAYMENT
router.post("/", async (req, res) => {
  try {
    const { userId, name, email, amount, paymentMethod } = req.body;

    if (!name || !email || !amount || !paymentMethod) {
      return res.status(400).json({
        success: false,
        message: "Please complete all payment fields.",
      });
    }

    const referenceNumber = "PAY-" + Date.now();

    const payment = await Payment.create({
      userId: userId || null,
      name,
      email,
      amount,
      paymentMethod,
      referenceNumber,
      status: "paid",
    });

    res.status(201).json({
      success: true,
      message: "Payment saved successfully.",
      payment,
    });
  } catch (error) {
    console.error("Payment error:", error);
    res.status(500).json({
      success: false,
      message: "Server error while saving payment.",
    });
  }
});

// GET ALL PAYMENTS
router.get("/", async (req, res) => {
  try {
    const payments = await Payment.find()
      .populate("userId", "name email")
      .sort({ createdAt: -1 });

    res.json({
      success: true,
      payments,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Failed to fetch payments.",
    });
  }
});

module.exports = router;