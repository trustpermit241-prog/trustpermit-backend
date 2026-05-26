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

  const secretKey = Uint8Array.from(
    JSON.parse(process.env.SOLANA_SECRET_KEY)
  );

  const payer = Keypair.fromSecretKey(secretKey);

  const connection = new Connection(
    process.env.SOLANA_RPC_URL ||
      "https://api.devnet.solana.com",
    "confirmed"
  );

  const instruction = new TransactionInstruction({
    keys: [],
    programId: MEMO_PROGRAM_ID,
    data: Buffer.from(`TrustPermit:${hash}`, "utf8"),
  });

  const transaction = new Transaction().add(
    instruction
  );

  return await sendAndConfirmTransaction(
    connection,
    transaction,
    [payer]
  );
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

    // FIXED VALIDATION
    if (
      !name ||
      !email ||
      !amount ||
      !paymentMethod
    ) {
      return res.status(400).json({
        success: false,
        message:
          "Please complete all payment fields.",
      });
    }

    paymentMethod = String(
      paymentMethod
    ).toLowerCase();

    if (
      !["card", "gcash"].includes(
        paymentMethod
      )
    ) {
      return res.status(400).json({
        success: false,
        message: "Invalid payment method.",
      });
    }

    const paymentData = {
      applicationId:
        applicationId || null,
      name,
      email,
      amount: Number(amount),
      paymentMethod,
      status: "paid",
      permitReleased: false,
    };

    if (
      userId &&
      mongoose.Types.ObjectId.isValid(
        userId
      )
    ) {
      paymentData.userId = userId;
    }

    const payment = await Payment.create(
      paymentData
    );

    res.status(201).json({
      success: true,
      message:
        "Payment saved successfully.",
      payment,
    });
  } catch (error) {
    console.error(
      "Payment error:",
      error
    );

    res.status(500).json({
      success: false,
      message:
        error.message ||
        "Server error while saving payment.",
    });
  }
});

// GET ALL PAYMENTS
router.get("/", async (req, res) => {
  try {
    const payments = await Payment.find()
      .populate(
        "userId",
        "name email fullName"
      )
      .populate("applicationId")
      .populate("blockchainRecord")
      .sort({ createdAt: -1 });

    res.json({
      success: true,
      payments,
    });
  } catch (error) {
    console.error(
      "Fetch payments error:",
      error
    );

    res.status(500).json({
      success: false,
      message:
        "Failed to fetch payments.",
    });
  }
});

// APPROVE PAYMENT + RELEASE PERMIT
router.put(
  "/:id/approve-release",
  async (req, res) => {
    try {
      const payment =
        await Payment.findById(
          req.params.id
        ).populate("applicationId");

      if (!payment) {
        return res.status(404).json({
          success: false,
          message: "Payment not found.",
        });
      }

      payment.status = "approved";
      payment.permitReleased = true;
      payment.permitReleasedAt =
        new Date();

      await payment.save();

      res.json({
        success: true,
        message:
          "Payment approved and permit released.",
        payment,
      });
    } catch (error) {
      console.error(
        "Approve release error:",
        error
      );

      res.status(500).json({
        success: false,
        message:
          error.message ||
          "Failed to approve payment.",
      });
    }
  }
);

module.exports = router;