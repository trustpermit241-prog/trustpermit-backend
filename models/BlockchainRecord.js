const mongoose = require("mongoose");

const blockchainSchema = new mongoose.Schema({
  permitId: String,
  hash: String,
  transactionSignature: String,
  createdAt: {
    type: Date,
    default: Date.now,
  },
});

module.exports = mongoose.model(
  "BlockchainRecord",
  blockchainSchema
);