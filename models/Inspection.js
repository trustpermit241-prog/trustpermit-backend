const mongoose = require("mongoose");

const inspectionSchema = new mongoose.Schema(
  {
    citizenId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true
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
    }
  },
  { timestamps: true }
);

module.exports = mongoose.models.Inspection
  || mongoose.model("Inspection", inspectionSchema, "inspection");
