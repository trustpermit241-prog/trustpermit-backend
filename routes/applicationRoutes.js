const express = require("express");
const router = express.Router();

const Application = require("../models/Application");
const protect = require("../middleware/authMiddleware");
const upload = require("../middleware/uploadMiddleware");

// GET /api/applications
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
    res.status(500).json({
      message: "Failed to fetch applications",
      error: err.message,
    });
  }
});

// GET /api/applications/my-latest
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
    res.status(500).json({
      message: "Failed to fetch your latest application",
      error: err.message,
    });
  }
});

// GET /api/applications/my
router.get("/my", protect, async (req, res) => {
  try {
    const userId = req.user._id || req.user.id;

    const applications = await Application.find({ citizenId: userId }).sort({
      createdAt: -1,
    });

    res.json(applications);
  } catch (err) {
    res.status(500).json({
      message: "Failed to fetch your applications",
      error: err.message,
    });
  }
});

// POST /api/applications
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
    res.status(500).json({
      message: "Failed to create application",
      error: err.message,
    });
  }
});

// GET /api/applications/:id
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
    res.status(500).json({
      message: "Failed to fetch application",
      error: err.message,
    });
  }
});

// PATCH /api/applications/:id/status
router.patch("/:id/status", protect, async (req, res) => {
  try {
    const role = req.user.role;

    if (role !== "staff" && role !== "admin") {
      return res.status(403).json({ message: "Access denied" });
    }

    const { id } = req.params;
    const { status, staffNotes, documentStatuses } = req.body;

    const validStatuses = ["Pending", "Approved", "Rejected"];

    if (!validStatuses.includes(status)) {
      return res.status(400).json({
        message: "Invalid status",
      });
    }

    const updateData = {
      status,
      assignedStaff: req.user._id || req.user.id,
      staffNotes: staffNotes || "",
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

    const io = req.app.get("io");

    if (io) {
      io.emit("application-status-updated", {
        applicationId: application._id,
        citizenId: application.citizenId,
        status: application.status,
        application,
      });
    }

    res.json({
      message: "Application status updated",
      application,
    });
  } catch (err) {
    res.status(500).json({
      message: "Failed to update status",
      error: err.message,
    });
  }
});

// POST /api/applications/upload-documents
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
    res.status(500).json({
      message: "Failed to upload documents",
      error: err.message,
    });
  }
});

module.exports = router;