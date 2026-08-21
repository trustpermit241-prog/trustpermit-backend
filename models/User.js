const mongoose = require("mongoose");

const userSchema = new mongoose.Schema(
  {
    fullName: {
      type: String,
      required: true,
      trim: true,
    },

    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
    },

    profileImage: {
      type: String,
      default: "",
    },

    passwordHash: {
      type: String,
      required: true,
    },

    salt: {
      type: String,
      required: true,
    },

    role: {
      type: String,
      enum: ["admin", "staff", "citizen"],
      default: "citizen",
    },

    status: {
      type: String,
      default: "Active",
    },

    isVerified: {
      type: Boolean,
      default: false,
    },

    apiToken: {
      type: String,
      unique: true,
      sparse: true,
    },
  },
  {
    timestamps: true,
  }
);

module.exports = mongoose.model("User", userSchema);