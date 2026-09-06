const mongoose = require("mongoose");

const AuditTrailSchema = new mongoose.Schema(
  {
    action: { type: String, required: true },
    resource: { type: String, required: true },
    description: { type: String, required: true },
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    userName: { type: String, default: "Unauthenticated request" },
    userEmail: { type: String, default: "" },
    userRole: { type: String, default: "" },
    method: { type: String, required: true },
    path: { type: String, required: true },
    statusCode: { type: Number, required: true },
    success: { type: Boolean, required: true },
    ipAddress: { type: String, default: "" },
    meta: { type: mongoose.Schema.Types.Mixed, default: {} },
  },
  {
    timestamps: true,
    versionKey: false,
  }
);

AuditTrailSchema.index({ createdAt: -1 });
AuditTrailSchema.index({ resource: 1, createdAt: -1 });

module.exports = mongoose.model("AuditTrail", AuditTrailSchema);