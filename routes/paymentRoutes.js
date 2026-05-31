const express = require("express");
const mongoose = require("mongoose");
const crypto = require("crypto");

const Payment = require("../models/Payment");
const Application = require("../models/Application");
const BlockchainRecord = require("../models/BlockchainRecord");
const saveHashToBlockchain = require("../services/solanaService");

const router = express.Router();

// ===================== CREATE PAYMENT =====================
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

    const selectedMethod = paymentMethod || method || "";

    const payment = await Payment.create({
      applicationId:
        applicationId && mongoose.Types.ObjectId.isValid(applicationId)
          ? applicationId
          : null,
      userId:
        userId && mongoose.Types.ObjectId.isValid(userId)
          ? userId
          : null,
      name,
      email,
      amount: parsedAmount,
      paymentMethod: selectedMethod,
      method: selectedMethod,
      cardLast4,
      status: "paid",
      permitReleased: false,
    });

    return res.status(201).json({
      success: true,
      message: "Payment recorded",
      payment,
    });
  } catch (error) {
    console.error("Create payment error:", error);
    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
});

// ===================== LIST PAYMENTS =====================
router.get("/", async (req, res) => {
  try {
    const payments = await Payment.find()
      .populate("applicationId")
      .populate("userId", "fullName email role")
      .sort({ createdAt: -1 });

    return res.json({
      success: true,
      payments,
    });
  } catch (error) {
    console.error("Fetch payments error:", error);
    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
});

// ===================== APPROVE PAYMENT + RELEASE PERMIT =====================
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
    let blockchainRecord = null;
    let solanaError = null;

    const hasApplicationId =
      payment.applicationId && mongoose.Types.ObjectId.isValid(payment.applicationId);

    if (hasApplicationId) {
      application = await Application.findByIdAndUpdate(
        payment.applicationId,
        {
          $set: {
            status: "Released",
          },
        },
        { new: true }
      );

      const verificationUrl = `https://trustpermit-webclient.vercel.app/verify/${payment.applicationId}`;
      payment.verificationUrl = verificationUrl;

      const existingRecord = await BlockchainRecord.findOne({
        permitId: payment.applicationId,
        paymentId: payment._id,
      });

      if (existingRecord) {
        blockchainRecord = existingRecord;

        payment.blockchainRecord = {
          hash: existingRecord.hash,
          transactionSignature: existingRecord.transactionSignature,
          createdAt: existingRecord.createdAt || new Date(),
        };
      } else {
        const hash = crypto
          .createHash("sha256")
          .update(`${payment._id}-${payment.applicationId}-${Date.now()}`)
          .digest("hex");

        let transactionSignature = "";

        try {
          transactionSignature = await saveHashToBlockchain(hash);
        } catch (err) {
          solanaError = err.message;
          console.error("Solana transaction failed:", err);
        }

        if (transactionSignature && transactionSignature !== "BLOCKCHAIN_DISABLED" && transactionSignature !== "BLOCKCHAIN_ERROR") {
          blockchainRecord = await BlockchainRecord.create({
            permitId: payment.applicationId,
            paymentId: payment._id,
            hash,
            transactionSignature,
            verificationUrl,
          });

          payment.blockchainRecord = {
            hash,
            transactionSignature,
            createdAt: new Date(),
          };
        } else {
          solanaError = transactionSignature || solanaError || "Solana transaction failed.";
        }
      }
    } else {
      payment.verificationUrl = "";
    }

    await payment.save();

    const io = req.app.get("io");

    if (io) {
      io.emit("payment-updated", {
        payment,
        application,
        blockchainRecord,
      });

      if (application) {
        io.emit("application-status-updated", {
          application,
        });
      }
    }

    return res.status(200).json({
      success: true,
      message: blockchainRecord
        ? "Payment approved, permit released, and Solana proof saved"
        : "Payment approved and permit released. Solana proof was not created.",
      payment,
      application,
      blockchainRecord,
      solanaError,
    });
  } catch (error) {
    console.error("Approve release payment error:", error);
    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
});

// ===================== GET SINGLE PAYMENT =====================
router.get("/:id", async (req, res) => {
  try {
    const payment = await Payment.findById(req.params.id)
      .populate("applicationId")
      .populate("userId", "fullName email role");

    if (!payment) {
      return res.status(404).json({
        success: false,
        message: "Payment not found",
      });
    }

    return res.json({
      success: true,
      payment,
    });
  } catch (error) {
    console.error("Fetch single payment error:", error);
    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
});

module.exports = router;