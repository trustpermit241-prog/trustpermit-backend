const mongoose = require("mongoose");

const blockchainSchema = new mongoose.Schema(
  {
    permitId: {
      type: mongoose.Schema.Types.Mixed,
      ref: "Application",
      required: true,
      index: true,
    },
    paymentId: {
      type: mongoose.Schema.Types.Mixed,
      ref: "Payment",
      default: null,
    },
    hash: {
      type: String,
      required: true,
    },
    transactionSignature: {
      type: String,
      required: true,
    },
    verificationUrl: {
      type: String,
      default: "",
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model("BlockchainRecord", blockchainSchema);