const mongoose = require("mongoose");

const inspectionSchema = new mongoose.Schema(
  {
    citizenId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true
    },
    applicationId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Application",
      default: null
    },
    type: {
      type: String,
      required: true
    },
    date: {
      type: Date,
      required: true
    },
    status: {
      type: String,
      enum: ["Pending", "Approved", "Rejected"],
      default: "Pending"
    },
    remarks: {
      type: String,
      default: ""
    },
    scheduledBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User"
    },
    inspector: {
      type: String,
      default: ""
    },
    certificateUrl: {
      type: String,
      default: ""
    },
    certificateIssuedAt: {
      type: Date,
      default: null
    }
  },
  { timestamps: true }
);

module.exports = mongoose.models.Inspection
  || mongoose.model("Inspection", inspectionSchema, "inspection");
