const mongoose = require("mongoose");

const paymentSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: false,
    },

    name: {
      type: String,
      required: true,
      trim: true,
    },

    email: {
      type: String,
      required: true,
      trim: true,
    },

    amount: {
      type: Number,
      required: true,
    },

    paymentMethod: {
      type: String,
      required: true,
      lowercase: true,
      enum: ["card", "gcash"],
    },

    status: {
      type: String,
      enum: ["pending", "paid", "failed"],
      default: "paid",
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Payment", paymentSchema);