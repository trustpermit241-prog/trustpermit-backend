const express = require("express");
const multer = require("multer");
const path = require("path");
const fs = require("fs");

const UploadedDocument = require("../models/UploadedDocument");
const Application = require("../models/Application");
const authMiddleware = require("../middleware/authMiddleware");

const router = express.Router();

const uploadDir = path.join(__dirname, "../uploads/documents");

if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadDir);
  },

  filename: (req, file, cb) => {
    const safeName = file.originalname.replace(/\s+/g, "-");
    cb(null, `${Date.now()}-${safeName}`);
  },
});

const upload = multer({
  storage,

  limits: {
    fileSize: 10 * 1024 * 1024,
  },
});

// ===================== UPLOAD DOCUMENTS =====================
router.post(
  "/",
  authMiddleware,
  upload.array("documents"),
  async (req, res) => {
    try {
      const { applicationId } = req.body;

      if (!applicationId) {
        return res.status(400).json({
          message: "Application ID is required",
        });
      }

      if (!req.files || req.files.length === 0) {
        return res.status(400).json({
          message: "No documents uploaded",
        });
      }

      const documentNames = Array.isArray(req.body.documentNames)
        ? req.body.documentNames
        : [req.body.documentNames];

      const documents = req.files.map((file, index) => ({
        applicationId,
        documentName: documentNames[index] || file.originalname,
        originalName: file.originalname,
        fileName: file.filename,
        filePath: `/uploads/documents/${file.filename}`,
        mimeType: file.mimetype,
        size: file.size,
        uploadedBy: req.user?._id || req.user?.id,
        status: "Pending",
        uploadedAt: new Date(),
      }));

      const savedDocuments = await UploadedDocument.insertMany(documents);

      const application = await Application.findByIdAndUpdate(
        applicationId,
        {
          $set: {
            documentsUploaded: true,
          },
        },
        { new: true }
      );

      if (!application) {
        return res.status(404).json({
          message: "Application not found",
        });
      }

      return res.status(200).json({
        message: "Documents uploaded successfully",
        documents: savedDocuments,
        application,
      });
    } catch (error) {
      console.error("Upload documents error:", error);

      return res.status(500).json({
        message: "Failed to upload documents",
        error: error.message,
      });
    }
  }
);

// ===================== FETCH DOCUMENTS BY APPLICATION ID =====================
router.get("/:applicationId", authMiddleware, async (req, res) => {
  try {
    const { applicationId } = req.params;

    const documents = await UploadedDocument.find({
      applicationId,
    }).sort({ createdAt: -1 });

    return res.status(200).json(documents);
  } catch (error) {
    console.error("Fetch uploaded documents error:", error);

    return res.status(500).json({
      message: "Failed to fetch uploaded documents",
      error: error.message,
    });
  }
});

module.exports = router;