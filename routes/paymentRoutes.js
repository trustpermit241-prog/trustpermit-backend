const express = require("express");
const Payment = require("../models/Payment");
const Application = require("../models/Application");

const router = express.Router();

// Create a new payment record
router.post("/", async (req, res) => {
  try {
    const {
      applicationId,
      userId,
      name,
      email,
      amount,
      method,
      paymentMethod,
      cardLast4 = "",
    } = req.body;

    console.log("Payment request body:", req.body);

    if (!name || !email || amount === undefined || amount === null || amount === "") {
      return res.status(400).json({
        success: false,
        message: "Missing required payment fields",
        payload: req.body,
      });
    }

    const parsedAmount = Number(amount);

    if (Number.isNaN(parsedAmount) || parsedAmount <= 0) {
      return res.status(400).json({
        success: false,
        message: "Invalid payment amount",
        payload: req.body,
      });
    }

    const payment = await Payment.create({
      applicationId: applicationId || null,
      userId: userId || null,
      name,
      email,
      amount: parsedAmount,
      paymentMethod: paymentMethod || method || "unknown",
      method: paymentMethod || method || "unknown",
      cardLast4,
      status: "paid",
      permitReleased: false,
    });

    res.status(201).json({
      success: true,
      message: "Payment recorded",
      payment,
    });
  } catch (error) {
    console.error("Create payment error:", error);
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
});

// List payments
router.get("/", async (req, res) => {
  try {
    const payments = await Payment.find()
      .populate("applicationId")
      .populate("userId", "fullName email role")
      .sort({ createdAt: -1 });

    res.json({
      success: true,
      payments,
    });
  } catch (error) {
    console.error("Fetch payments error:", error);
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
});

// Approve payment and release permit
router.put("/:id/approve-release", async (req, res) => {
  try {
    const payment = await Payment.findById(req.params.id);

    if (!payment) {
      return res.status(404).json({
        success: false,
        message: "Payment not found",
      });
    }

    payment.status = "approved";
    payment.permitReleased = true;
    payment.permitReleasedAt = new Date();

    let application = null;

    if (payment.applicationId) {
      application = await Application.findByIdAndUpdate(
        payment.applicationId,
        {
          $set: {
            status: "Released",
            paymentStatus: "approved",
            permitReleased: true,
            permitReleasedAt: new Date(),
          },
        },
        { new: true }
      );
    }

    const verificationUrl = payment.applicationId
      ? `https://trustpermit-webclient.vercel.app/verify/${payment.applicationId}`
      : "";

    payment.verificationUrl = verificationUrl;

    await payment.save();

    const io = req.app.get("io");
    if (io) {
      io.emit("payment-updated", {
        payment,
        application,
      });

      io.emit("application-status-updated", {
        application,
      });
    }

    return res.status(200).json({
      success: true,
      message: "Payment approved and permit released",
      payment,
      application,
    });
  } catch (error) {
    console.error("Approve release payment error:", error);

    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
});

// Get single payment
router.get("/:id", async (req, res) => {
  try {
    const payment = await Payment.findById(req.params.id)
      .populate("applicationId")
      .populate("userId", "fullName email role");

    if (!payment) {
      return res.status(404).json({
        success: false,
        message: "Not found",
      });
    }

    res.json({
      success: true,
      payment,
    });
  } catch (error) {
    console.error("Fetch single payment error:", error);
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
});

module.exports = router;