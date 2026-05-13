const mongoose = require("mongoose");

const SystemLogSchema = new mongoose.Schema(
  {
    type: {
      type: String,
      enum: ["security", "user", "staff", "system"],
      default: "system",
    },
    message: { type: String, required: true },
    meta: { type: mongoose.Schema.Types.Mixed },
  },
  {
    timestamps: true,
    versionKey: false,
  }
);

module.exports = mongoose.model("SystemLog", SystemLogSchema);
