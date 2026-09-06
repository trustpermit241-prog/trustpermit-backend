const mongoose = require("mongoose");

const notificationSchema = new mongoose.Schema(
  {
    recipientId: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
    audienceRole: { type: String, enum: ["citizen", "staff", "admin"], required: true },
    sourceKey: { type: String, required: true },
    type: { type: String, required: true },
    title: { type: String, required: true },
    message: { type: String, required: true },
    icon: { type: String, default: "bell" },
    link: { type: String, default: "" },
    occurredAt: { type: Date, required: true },
    readAt: { type: Date, default: null },
    deletedAt: { type: Date, default: null },
  },
  { timestamps: true }
);

notificationSchema.index({ audienceRole: 1, recipientId: 1, sourceKey: 1 }, { unique: true });

module.exports = mongoose.model("Notification", notificationSchema);