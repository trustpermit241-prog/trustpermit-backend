const mongoose = require("mongoose");

const uploadedDocumentSchema = new mongoose.Schema(
  {
    applicationId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Application",
      required: true,
    },

    documentName: {
      type: String,
      required: true,
    },

    originalName: String,
    fileName: String,
    filePath: String,
    mimeType: String,
    size: Number,

    uploadedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },

    status: {
      type: String,
      enum: ["Pending", "Approved", "Rejected"],
      default: "Pending",
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model("UploadedDocument", uploadedDocumentSchema);