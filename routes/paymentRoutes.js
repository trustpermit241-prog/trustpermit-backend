const express = require("express");
const mongoose = require("mongoose");
const router = express.Router();
const Payment = require("../models/Payment");

// CREATE PAYMENT
router.post("/", async (req, res) => {
  try {
    let { userId, name, email, amount, paymentMethod } = req.body;

    if (!name || !email || !amount || !paymentMethod) {
      return res.status(400).json({
        success: false,
        message: "Please complete all payment fields.",
      });
    }

    paymentMethod = String(paymentMethod).toLowerCase();

    if (!["card", "gcash"].includes(paymentMethod)) {
      return res.status(400).json({
        success: false,
        message: "Invalid payment method.",
      });
    }

    const paymentData = {
      name,
      email,
      amount: Number(amount),
      paymentMethod,
      status: "paid",
    };

    if (userId && mongoose.Types.ObjectId.isValid(userId)) {
      paymentData.userId = userId;
    }

    const payment = await Payment.create(paymentData);

    res.status(201).json({
      success: true,
      message: "Payment saved successfully.",
      payment,
    });
  } catch (error) {
    console.error("Payment error:", error);
    res.status(500).json({
      success: false,
      message: error.message || "Server error while saving payment.",
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
    console.error("Fetch payments error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch payments.",
    });
  }
});

module.exports = router;