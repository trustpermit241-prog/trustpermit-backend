const mongoose = require("mongoose");

const paymentSchema = new mongoose.Schema(
  {
    // Connected application
    applicationId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Application",
      required: true,
    },

    // User who paid
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: false,
    },

    // Payer name
    name: {
      type: String,
      required: true,
      trim: true,
    },

    // Payer email
    email: {
      type: String,
      required: true,
      trim: true,
    },

    // Payment amount
    amount: {
      type: Number,
      required: true,
    },

    // Payment method
    paymentMethod: {
      type: String,
      required: true,
      lowercase: true,
      enum: ["card", "gcash"],
    },

    // Payment status
    status: {
      type: String,
      enum: ["pending", "paid", "approved", "failed"],
      default: "paid",
    },

    // Permit released status
    permitReleased: {
      type: Boolean,
      default: false,
    },

    // Permit released date
    permitReleasedAt: {
      type: Date,
      default: null,
    },

    // QR verification link
    verificationUrl: {
      type: String,
      default: "",
    },

    // Solana blockchain proof
    blockchainRecord: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "BlockchainRecord",
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

module.exports = mongoose.model("Payment", paymentSchema);