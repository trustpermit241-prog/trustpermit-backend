const mongoose = require("mongoose");

const paymentSchema = new mongoose.Schema(
  {
    applicationId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Application",
      default: null,
    },

    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },

    name: {
      type: String,
      default: "",
    },

    email: {
      type: String,
      default: "",
    },

    amount: {
      type: Number,
      default: 0,
    },

    // Save whatever the user selected: gcash or card
    paymentMethod: {
      type: String,
      default: "",
    },

    // Keep this for old records / old frontend compatibility
    method: {
      type: String,
      default: "",
    },

    cardLast4: {
      type: String,
      default: "",
    },

    status: {
      type: String,
      default: "paid",
    },

    permitReleased: {
      type: Boolean,
      default: false,
    },

    permitReleasedAt: {
      type: Date,
      default: null,
    },

    verificationUrl: {
      type: String,
      default: "",
    },

    blockchainRecord: {
      hash: String,
      transactionSignature: String,
      createdAt: Date,
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Payment", paymentSchema, "payments");