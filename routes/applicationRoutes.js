const express = require("express");
const router = express.Router();

const {
  Connection,
  Keypair,
  PublicKey,
  Transaction,
  TransactionInstruction,
  sendAndConfirmTransaction,
} = require("@solana/web3.js");

const Application = require("../models/Application");
const BlockchainRecord = require("../models/BlockchainRecord");

const protect = require("../middleware/authMiddleware");
const upload = require("../middleware/uploadMiddleware");

const hashPermit = require("../utils/hashPermit");

const MEMO_PROGRAM_ID = new PublicKey(
  "MemoSq4gqABAXKb96qnH8TysNcWxMyWCqXgDLGmfcHr"
);

// =====================================================
// Save permit hash to Solana Devnet
// =====================================================
const saveHashToBlockchain = async (hash) => {
  if (!process.env.SOLANA_SECRET_KEY) {
    throw new Error("SOLANA_SECRET_KEY is missing in .env");
  }

  const secretKey = Uint8Array.from(JSON.parse(process.env.SOLANA_SECRET_KEY));

  const payer = Keypair.fromSecretKey(secretKey);

  const connection = new Connection(
    process.env.SOLANA_RPC_URL || "https://api.devnet.solana.com",
    "confirmed"
  );

  const memoText = `TrustPermit:${hash}`;

  const instruction = new TransactionInstruction({
    keys: [],
    programId: MEMO_PROGRAM_ID,
    data: Buffer.from(memoText, "utf8"),
  });

  const transaction = new Transaction().add(instruction);

  const signature = await sendAndConfirmTransaction(connection, transaction, [
    payer,
  ]);

  console.log("✅ Solana transaction:", signature);

  return signature;
};

// =====================================================
// Get all applications for staff/admin
// URL: GET /api/applications
// =====================================================
router.get("/", protect, async (req, res) => {
  try {
    const role = req.user.role;

    if (role !== "staff" && role !== "admin") {
      return res.status(403).json({ message: "Access denied" });
    }

    const applications = await Application.find()
      .populate({ path: "citizenId", select: "fullName email" })
      .populate({ path: "assignedStaff", select: "fullName email" })
      .sort({ createdAt: -1 });

    res.json(applications);
  } catch (err) {
    console.error("Fetch applications error:", err);
    res.status(500).json({
      message: "Failed to fetch applications",
      error: err.message,
    });
  }
});

// =====================================================
// Get latest application for logged-in citizen
// =====================================================
router.get("/my-latest", protect, async (req, res) => {
  try {
    const userId = req.user._id || req.user.id;

    const latestApp = await Application.findOne({ citizenId: userId }).sort({
      createdAt: -1,
    });

    if (!latestApp) {
      return res.status(404).json({ message: "No applications found" });
    }

    res.json({
      status: latestApp.status,
      application: latestApp,
    });
  } catch (err) {
    console.error("Fetch my latest application error:", err);
    res.status(500).json({
      message: "Failed to fetch your latest application",
      error: err.message,
    });
  }
});

// =====================================================
// Get applications for logged-in citizen
// =====================================================
router.get("/my", protect, async (req, res) => {
  try {
    const userId = req.user._id || req.user.id;

    const applications = await Application.find({ citizenId: userId }).sort({
      createdAt: -1,
    });

    res.json(applications);
  } catch (err) {
    console.error("Fetch my applications error:", err);
    res.status(500).json({
      message: "Failed to fetch your applications",
      error: err.message,
    });
  }
});

// =====================================================
// Create new application
// =====================================================
router.post("/", protect, async (req, res) => {
  try {
    const userId = req.user._id || req.user.id;

    const {
      businessName,
      applicationType,
      projectType,
      zoneType,
      firstName,
      middleName,
      lastName,
      suffixName,
      gender,
      civilStatus,
      nationality,
      contactNumber,
      email,
      province,
      city,
      barangay,
      subdivision,
      street,
      building,
      houseNo,
      block,
      lot,
      landmark,
      businessArea,
      malePersonnel,
      femalePersonnel,
      ownershipType,
      lineOfBusiness,
      documents,
      signature,
    } = req.body;

    const application = await Application.create({
      citizenId: userId,
      businessName,
      applicationType,
      projectType,
      zoneType,
      applicant: {
        firstName,
        middleName,
        lastName,
        suffixName,
        gender,
        civilStatus,
        nationality,
        contactNumber,
        email,
      },
      address: {
        province,
        city,
        barangay,
        subdivision,
        street,
        building,
        houseNo,
        block,
        lot,
        landmark,
      },
      businessDetails: {
        businessArea,
        malePersonnel,
        femalePersonnel,
        ownershipType,
        lineOfBusiness,
      },
      documents: documents || {},
      signature,
      documentStatuses: {},
      status: "Pending",
    });

    const io = req.app.get("io");

    if (io) {
      io.emit("new-application", application);
    }

    res.status(201).json({
      message: "Application created",
      application,
    });
  } catch (err) {
    console.error("Create application error:", err);
    res.status(500).json({
      message: "Failed to create application",
      error: err.message,
    });
  }
});

// =====================================================
// Get single application by ID
// =====================================================
router.get("/:id", protect, async (req, res) => {
  try {
    const role = req.user.role;
    const userId = req.user._id || req.user.id;

    const application = await Application.findById(req.params.id)
      .populate({ path: "citizenId", select: "fullName email" })
      .populate({ path: "assignedStaff", select: "fullName email" });

    if (!application) {
      return res.status(404).json({
        message: "Application not found",
      });
    }

    const ownerId = application.citizenId?._id || application.citizenId;

    if (
      role !== "staff" &&
      role !== "admin" &&
      ownerId.toString() !== userId.toString()
    ) {
      return res.status(403).json({ message: "Access denied" });
    }

    res.json(application);
  } catch (err) {
    console.error("Fetch single application error:", err);
    res.status(500).json({
      message: "Failed to fetch application",
      error: err.message,
    });
  }
});

// =====================================================
// Update application status
// =====================================================
router.patch("/:id/status", protect, async (req, res) => {
  try {
    const role = req.user.role;

    if (role !== "staff" && role !== "admin") {
      return res.status(403).json({ message: "Access denied" });
    }

    const { id } = req.params;
    const { status, staffNotes, documentStatuses } = req.body;

    if (!["Pending", "Approved", "Rejected"].includes(status)) {
      return res.status(400).json({
        message: "Invalid status",
      });
    }

    const updateData = {
      status,
      assignedStaff: req.user._id || req.user.id,
      staffNotes,
    };

    if (documentStatuses) {
      updateData.documentStatuses = documentStatuses;
    }

    const application = await Application.findByIdAndUpdate(id, updateData, {
      new: true,
    });

    if (!application) {
      return res.status(404).json({
        message: "Application not found",
      });
    }

    let blockchainRecord = null;

    if (status === "Approved") {
      const existingRecord = await BlockchainRecord.findOne({
        permitId: application._id,
      });

      if (existingRecord) {
        blockchainRecord = existingRecord;
      } else {
        const hash = hashPermit({
          permitId: application._id,
          businessName: application.businessName,
          applicationType: application.applicationType,
          applicant: application.applicant,
          businessDetails: application.businessDetails,
          status: application.status,
          approvedAt: new Date(),
        });

        const transactionSignature = await saveHashToBlockchain(hash);

        blockchainRecord = await BlockchainRecord.create({
          permitId: application._id,
          hash,
          transactionSignature,
        });
      }
    }

    const io = req.app.get("io");

    if (io && application) {
      io.emit("application-status-updated", {
        applicationId: application._id,
        citizenId: application.citizenId,
        status: application.status,
        application,
        blockchainRecord,
      });
    }

    res.json({
      application,
      blockchainRecord,
    });
  } catch (err) {
    console.error("Update application status error:", err);
    res.status(500).json({
      message: "Failed to update status",
      error: err.message,
    });
  }
});

// =====================================================
// Upload application documents
// =====================================================
router.post("/upload-documents", protect, upload.any(), async (req, res) => {
  try {
    const { applicationId } = req.body;

    if (!applicationId) {
      return res.status(400).json({
        message: "Application ID is required",
      });
    }

    const application = await Application.findById(applicationId);

    if (!application) {
      return res.status(404).json({
        message: "Application not found",
      });
    }

    const documents =
      application.documents instanceof Map
        ? Object.fromEntries(application.documents)
        : application.documents || {};

    const documentStatuses =
      application.documentStatuses instanceof Map
        ? Object.fromEntries(application.documentStatuses)
        : application.documentStatuses || {};

    (req.files || []).forEach((file) => {
      documents[file.fieldname] = file.filename;
      documentStatuses[file.fieldname] = "Pending";
    });

    application.documents = documents;
    application.documentStatuses = documentStatuses;
    application.status = "Pending";

    await application.save();

    res.json({
      message: "Documents uploaded, application pending review",
      documents,
      documentStatuses,
    });
  } catch (err) {
    console.error("Upload documents error:", err);
    res.status(500).json({
      message: "Failed to upload documents",
      error: err.message,
    });
  }
});

module.exports = router;