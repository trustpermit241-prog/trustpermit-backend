const express = require("express");
const multer = require("multer");
const mongoose = require("mongoose");
const cloudinary = require("cloudinary").v2;
const streamifier = require("streamifier");

const UploadedDocument = require("../models/UploadedDocument");
const Application = require("../models/Application");
const authMiddleware = require("../middleware/authMiddleware");

const router = express.Router();

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 10 * 1024 * 1024,
  },
});

const uploadToCloudinary = (file) => new Promise((resolve, reject) => {
  const stream = cloudinary.uploader.upload_stream(
    {
      folder: "trustpermit/documents",
      resource_type: "auto",
    },
    (error, result) => {
      if (error) reject(error);
      else resolve(result);
    }
  );

  streamifier.createReadStream(file.buffer).pipe(stream);
});

// ===================== UPLOAD DOCUMENTS =====================
router.post("/", authMiddleware, upload.array("documents"), async (req, res) => {
  try {
    const { applicationId } = req.body;

    if (!applicationId) {
      return res.status(400).json({
        message: "Application ID is required",
      });
    }

    if (!mongoose.Types.ObjectId.isValid(applicationId)) {
      return res.status(400).json({
        message: "Invalid application ID",
      });
    }

    if (!req.files || req.files.length === 0) {
      return res.status(400).json({
        message: "No documents uploaded",
      });
    }

    const application = await Application.findById(applicationId);

    if (!application) {
      return res.status(404).json({
        message: "Application not found",
      });
    }

    const documentNames = Array.isArray(req.body.documentNames)
      ? req.body.documentNames
      : [req.body.documentNames];

    if (!process.env.CLOUDINARY_CLOUD_NAME || !process.env.CLOUDINARY_API_KEY || !process.env.CLOUDINARY_API_SECRET) {
      return res.status(503).json({
        message: "Cloudinary storage is not configured on the server",
      });
    }

    const cloudinaryFiles = await Promise.all(req.files.map(uploadToCloudinary));
    const documents = req.files.map((file, index) => {
      const cloudinaryFile = cloudinaryFiles[index];

      return {
        applicationId: application._id,
        documentName: documentNames[index] || file.originalname,
        originalName: file.originalname,
        fileName: cloudinaryFile.public_id,
        filePath: cloudinaryFile.secure_url,
        mimeType: file.mimetype,
        size: file.size,
        uploadedBy: req.user?._id || req.user?.id,
        status: "Pending",
      };
    });

    const savedDocuments = await UploadedDocument.insertMany(documents);

    const updatedApplication = await Application.findByIdAndUpdate(
      applicationId,
      {
        $set: {
          documentsUploaded: true,
          status: "Pending",
        },
      },
      { new: true }
    );

    return res.status(200).json({
      message: "Documents uploaded successfully",
      documents: savedDocuments,
      application: updatedApplication,
    });
  } catch (error) {
    console.error("Upload documents error:", error);

    return res.status(500).json({
      message: "Failed to upload documents",
      error: error.message,
    });
  }
});

// ===================== FETCH ALL UPLOADED DOCUMENTS =====================
router.get("/", authMiddleware, async (req, res) => {
  try {
    const documents = await UploadedDocument.find({})
      .populate("applicationId")
      .populate("uploadedBy", "fullName email role")
      .sort({ createdAt: -1 });

    return res.status(200).json(documents);
  } catch (error) {
    console.error("Fetch all uploaded documents error:", error);

    return res.status(500).json({
      message: "Failed to fetch uploaded documents",
      error: error.message,
    });
  }
});

// ===================== FETCH DOCUMENTS BY APPLICATION ID =====================
router.get("/:applicationId", authMiddleware, async (req, res) => {
  try {
    const { applicationId } = req.params;

    if (!mongoose.Types.ObjectId.isValid(applicationId)) {
      return res.status(400).json({
        message: "Invalid application ID",
      });
    }

    const documents = await UploadedDocument.find({
      applicationId: new mongoose.Types.ObjectId(applicationId),
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