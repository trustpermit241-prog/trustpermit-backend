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

    console.log("💰 Creating payment:", {
      applicationId,
      userId,
      name,
      email,
      amount,
      method,
      paymentMethod,
      isValidApplicationId: mongoose.Types.ObjectId.isValid(applicationId),
    });

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

    console.log("✅ Payment created:", {
      paymentId: payment._id,
      applicationId: payment.applicationId,
      permitReleased: payment.permitReleased,
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

    console.log("📋 Fetched payments:", payments.length);
    payments.forEach(p => {
      console.log("   ├─", {
        id: p._id,
        applicationId: p.applicationId?._id,
        permitReleased: p.permitReleased,
        status: p.status,
      });
    });

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

    console.log("💳 Approving payment:", {
      paymentId: payment._id,
      applicationId: payment.applicationId,
      isValidObjectId: mongoose.Types.ObjectId.isValid(payment.applicationId),
      applicationIdType: typeof payment.applicationId,
    });

    payment.status = "approved";
    payment.permitReleased = true;
    payment.permitReleasedAt = new Date();

    let application = null;
    let blockchainRecord = null;
    let solanaError = null;

    const hasApplicationId =
      payment.applicationId && mongoose.Types.ObjectId.isValid(payment.applicationId);

    if (hasApplicationId) {
      const expiryDate = new Date();
      expiryDate.setFullYear(expiryDate.getFullYear() + 1);

      application = await Application.findByIdAndUpdate(
        payment.applicationId,
        {
          $set: {
            status: "Released",
            expiryDate,
          },
        },
        { new: true }
      );

      // Build verification URL pointing to the frontend verify page
      // This allows users to scan the QR code and go directly to the permit verification page
      const frontendUrl = process.env.FRONTEND_URL || "https://trustpermit-webclient.vercel.app";
      const verificationUrl = `${frontendUrl.replace(/\/$/, "")}/verify/${payment.applicationId}`;
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

        // Always create blockchain record, even if Solana transaction fails
        // The record is essential for permit verification
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
          // Create a blockchain record even if Solana is disabled or failed
          // This ensures the permit can still be verified and displayed
          blockchainRecord = await BlockchainRecord.create({
            permitId: payment.applicationId,
            paymentId: payment._id,
            hash,
            transactionSignature: transactionSignature || "PENDING_BLOCKCHAIN", // Placeholder if Solana unavailable
            verificationUrl,
          });

          payment.blockchainRecord = {
            hash,
            transactionSignature: transactionSignature || "PENDING_BLOCKCHAIN",
            createdAt: new Date(),
          };

          solanaError = transactionSignature || solanaError || "Blockchain service unavailable, but record created locally.";
        }
      }
    } else {
      payment.verificationUrl = "";
    }

    await payment.save();

    // Fetch the payment with populated applicationId to ensure frontend gets the correct data
    const updatedPayment = await Payment.findById(payment._id)
      .populate("applicationId")
      .populate("userId", "fullName email role");

    console.log("✅ Payment approved with:", {
      paymentId: updatedPayment._id,
      applicationId: updatedPayment.applicationId?._id,
      permitReleased: updatedPayment.permitReleased,
      blockchainHash: blockchainRecord?.hash?.substring(0, 16),
    });

    const io = req.app.get("io");

    if (io) {
      io.emit("payment-updated", {
        payment: updatedPayment,
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
      payment: updatedPayment,
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

// ===================== RETRY BLOCKCHAIN FOR PAYMENT =====================
router.post("/:id/retry-blockchain", async (req, res) => {
  try {
    const payment = await Payment.findById(req.params.id);

    if (!payment) {
      return res.status(404).json({ success: false, message: "Payment not found" });
    }

    if (!payment.applicationId) {
      return res.status(400).json({ success: false, message: "Payment has no applicationId to anchor blockchain record." });
    }

    // create a new hash and attempt to save to blockchain
    const hash = crypto.createHash("sha256").update(`${payment._id}-${payment.applicationId}-${Date.now()}`).digest("hex");

    console.log("Retrying blockchain for payment", payment._id, "hash", hash);

    let transactionSignature = "";
    try {
      transactionSignature = await saveHashToBlockchain(hash);
    } catch (err) {
      console.error("Retry blockchain error:", err);
      return res.status(500).json({ success: false, message: "Blockchain retry failed.", error: err.message });
    }

    if (!transactionSignature || transactionSignature === "BLOCKCHAIN_DISABLED" || transactionSignature === "BLOCKCHAIN_ERROR") {
      return res.status(500).json({ success: false, message: "Blockchain transaction did not complete.", transactionSignature });
    }

    const verificationUrl = payment.verificationUrl || `${req.protocol}://${req.get("host")}/api/blockchain/redirect/${payment.applicationId}`;

    const blockchainRecord = await BlockchainRecord.create({
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

    await payment.save();

    const io = req.app.get("io");
    if (io) io.emit("payment-updated", { payment, blockchainRecord });

    return res.json({ success: true, message: "Blockchain record created", blockchainRecord, payment });
  } catch (error) {
    console.error("Retry blockchain exception:", error);
    return res.status(500).json({ success: false, message: "Failed to retry blockchain", error: error.message });
  }
});

module.exports = router;