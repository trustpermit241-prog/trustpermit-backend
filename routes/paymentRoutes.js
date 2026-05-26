const express = require("express");
const mongoose = require("mongoose");
const router = express.Router();

const Payment = require("../models/Payment");
const Application = require("../models/Application");
const BlockchainRecord = require("../models/BlockchainRecord");
const hashPermit = require("../utils/hashPermit");

const {
  Connection,
  Keypair,
  PublicKey,
  Transaction,
  TransactionInstruction,
  sendAndConfirmTransaction,
} = require("@solana/web3.js");

const MEMO_PROGRAM_ID = new PublicKey(
  "MemoSq4gqABAXKb96qnH8TysNcWxMyWCqXgDLGmfcHr"
);

const saveHashToBlockchain = async (hash) => {
  if (!process.env.SOLANA_SECRET_KEY) {
    throw new Error("SOLANA_SECRET_KEY is missing in .env");
  }

  const secretKey = Uint8Array.from(JSON.parse(process.env.SOLANA_SECRET_KEY));
  const payer = Keypair.fromSecretKey(secretKey);

  const connection = new Connection(
    process.env.SOLANA_RPC_URL || "https://api.devnet.solana.com",
    "confirmed"
  );

  const instruction = new TransactionInstruction({
    keys: [],
    programId: MEMO_PROGRAM_ID,
    data: Buffer.from(`TrustPermit:${hash}`, "utf8"),
  });

  const transaction = new Transaction().add(instruction);

  return await sendAndConfirmTransaction(connection, transaction, [payer]);
};

// CREATE PAYMENT
router.post("/", async (req, res) => {
  try {
    let {
      applicationId,
      userId,
      name,
      email,
      amount,
      paymentMethod,
    } = req.body;

    if (!applicationId || !name || !email || !amount || !paymentMethod) {
      return res.status(400).json({
        success: false,
        message: "Please complete all payment fields including applicationId.",
      });
    }

    if (!mongoose.Types.ObjectId.isValid(applicationId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid application ID.",
      });
    }

    const application = await Application.findById(applicationId);

    if (!application) {
      return res.status(404).json({
        success: false,
        message: "Application not found.",
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
      applicationId,
      name,
      email,
      amount: Number(amount),
      paymentMethod,
      status: "paid",
      permitReleased: false,
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
      .populate("userId", "name email fullName")
      .populate("applicationId")
      .populate("blockchainRecord")
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

// APPROVE PAYMENT + RELEASE PERMIT + SOLANA BLOCKCHAIN
router.put("/:id/approve-release", async (req, res) => {
  try {
    const payment = await Payment.findById(req.params.id).populate(
      "applicationId"
    );

    if (!payment) {
      return res.status(404).json({
        success: false,
        message: "Payment not found.",
      });
    }

    if (payment.permitReleased) {
      const existingPayment = await Payment.findById(payment._id)
        .populate("userId", "name email fullName")
        .populate("applicationId")
        .populate("blockchainRecord");

      return res.json({
        success: true,
        message: "Permit already released.",
        payment: existingPayment,
      });
    }

    const application = payment.applicationId;

    if (!application) {
      return res.status(404).json({
        success: false,
        message: "Connected application not found.",
      });
    }

    const frontendUrl =
      process.env.FRONTEND_URL || "https://trustpermit-frontend.onrender.com";

    const verificationUrl = `${frontendUrl}/verify/${application._id}`;

    const hash = hashPermit({
      permitId: application._id,
      paymentId: payment._id,
      businessName: application.businessName,
      applicationType: application.applicationType,
      applicant: application.applicant,
      businessDetails: application.businessDetails,
      amount: payment.amount,
      paymentMethod: payment.paymentMethod,
      verificationUrl,
      releasedAt: new Date(),
    });

    const transactionSignature = await saveHashToBlockchain(hash);

    const blockchainRecord = await BlockchainRecord.create({
      permitId: application._id,
      paymentId: payment._id,
      hash,
      transactionSignature,
      verificationUrl,
    });

    await Application.findByIdAndUpdate(
      application._id,
      {
        status: "Approved",
      },
      { new: true }
    );

    payment.status = "approved";
    payment.permitReleased = true;
    payment.permitReleasedAt = new Date();
    payment.verificationUrl = verificationUrl;
    payment.blockchainRecord = blockchainRecord._id;

    await payment.save();

    const updatedPayment = await Payment.findById(payment._id)
      .populate("userId", "name email fullName")
      .populate("applicationId")
      .populate("blockchainRecord");

    const io = req.app.get("io");

    if (io) {
      io.emit("payment-approved-permit-released", {
        payment: updatedPayment,
        applicationId: application._id,
        blockchainRecord,
      });

      io.emit("application-status-updated", {
        applicationId: application._id,
        status: "Approved",
      });
    }

    res.json({
      success: true,
      message: "Payment approved, permit released, QR ready, and Solana proof created.",
      payment: updatedPayment,
      blockchainRecord,
      qrValue: verificationUrl,
    });
  } catch (error) {
    console.error("Approve release error:", error);

    res.status(500).json({
      success: false,
      message: error.message || "Failed to approve payment and release permit.",
    });
  }
});

module.exports = router;