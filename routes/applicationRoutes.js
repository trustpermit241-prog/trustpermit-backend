const express = require("express");
const mongoose = require("mongoose");
const Application = require("../models/Application");
const authMiddleware = require("../middleware/authMiddleware");

const router = express.Router();

router.use(authMiddleware);

// ===================== CREATE APPLICATION =====================
router.post("/", async (req, res) => {
  try {
    const userId = req.user._id || req.user.id;

    const payload = {
      ...req.body,
      userId,
    };

    const application = await Application.create(payload);

    return res.status(201).json({
      success: true,
      message: "Application submitted successfully",
      application,
    });
  } catch (error) {
    console.error("Create application error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to submit application: " + error.message,
    });
  }
});

// ===================== CREATE APPLY PERMIT =====================
router.post("/apply", async (req, res) => {
  try {
    const userId = req.user._id || req.user.id;

    const payload = {
      ...req.body,
      applicationType: req.body.applicationType || "New Application",
      userId,
    };

    const application = await Application.create(payload);

    return res.status(201).json({
      success: true,
      message: "Apply permit submitted",
      application,
    });
  } catch (error) {
    console.error("Create apply permit error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to create apply permit: " + error.message,
    });
  }
});

// ===================== CREATE RENEWAL =====================
router.post("/renew", async (req, res) => {
  try {
    const userId = req.user._id || req.user.id;
    const { previousApplicationId } = req.body;

    if (!previousApplicationId) {
      return res.status(400).json({
        success: false,
        message: "previousApplicationId is required to create a renewal",
      });
    }

    const previous = await Application.findById(previousApplicationId);

    if (!previous) {
      return res.status(404).json({
        success: false,
        message: "Previous application not found",
      });
    }

    const payload = {
      ...req.body,
      applicant: req.body.applicant || previous.applicant,
      contact: req.body.contact || previous.contact,
      address: req.body.address || previous.address,
      businessInfo: req.body.businessInfo || previous.businessInfo,
      businessDetails: req.body.businessDetails || previous.businessDetails,
      businessName: req.body.businessName || previous.businessName,
      applicationType: "Renewal",
      previousApplicationId,
      userId,
    };

    const renewal = await Application.create(payload);

    return res.status(201).json({
      success: true,
      message: "Renewal application submitted",
      application: renewal,
      renewal,
    });
  } catch (error) {
    console.error("Create renewal error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to create renewal: " + error.message,
    });
  }
});

// ===================== UPDATE REQUIREMENTS =====================
router.patch("/:id/requirements", async (req, res) => {
  try {
    const requirements = req.body?.requirements || {};

    if (typeof requirements !== "object") {
      return res.status(400).json({
        success: false,
        message: "Requirements must be an object.",
      });
    }

    const application = await Application.findByIdAndUpdate(
      req.params.id,
      {
        $set: {
          requirements,
          updatedAt: new Date(),
        },
      },
      { new: true }
    );

    if (!application) {
      return res.status(404).json({
        success: false,
        message: "Application not found.",
      });
    }

    return res.status(200).json({
      success: true,
      message: "Requirements updated successfully",
      application,
    });
  } catch (error) {
    console.error("Update requirements error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to update requirements: " + error.message,
    });
  }
});

// ===================== UPDATE APPLICATION STATUS =====================
router.patch("/:id/status", async (req, res) => {
  try {
    const { status } = req.body;

    if (!status) {
      return res.status(400).json({
        success: false,
        message: "Status is required.",
      });
    }

    const application = await Application.findByIdAndUpdate(
      req.params.id,
      {
        $set: {
          status,
          updatedAt: new Date(),
        },
      },
      { new: true }
    );

    if (!application) {
      return res.status(404).json({
        success: false,
        message: "Application not found.",
      });
    }

    const io = req.app.get("io");
    if (io) {
      io.emit("application-status-updated", { application });
    }

    return res.status(200).json({
      success: true,
      message: "Application status updated successfully",
      application,
    });
  } catch (error) {
    console.error("Update application status error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to update application status: " + error.message,
    });
  }
});

// ===================== GET ALL APPLICATIONS =====================
router.get("/", async (req, res) => {
  try {
    const role = String(req.user.role || "").toLowerCase();
    const userId = req.user._id || req.user.id;

    let query = {};

    if (role === "citizen" || role === "user") {
      query = { userId };
    }

    const applications = await Application.find(query)
      .populate("userId", "fullName email role")
      .sort({ createdAt: -1 });

    return res.status(200).json({
      success: true,
      applications,
      count: applications.length,
    });
  } catch (error) {
    console.error("Fetch applications error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to fetch applications: " + error.message,
    });
  }
});

// ===================== GET MY APPLICATIONS =====================
router.get("/my", async (req, res) => {
  try {
    const userId = req.user._id || req.user.id;

    const applications = await Application.find({ userId })
      .populate("userId", "fullName email role")
      .sort({ createdAt: -1 });

    return res.status(200).json({
      success: true,
      applications,
      count: applications.length,
    });
  } catch (error) {
    console.error("Fetch my applications error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to fetch my applications: " + error.message,
    });
  }
});

// ===================== GET SINGLE APPLICATION =====================
router.get("/:id", async (req, res) => {
  try {
    const role = String(req.user.role || "").toLowerCase();
    const userId = String(req.user._id || req.user.id);

    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid application ID.",
      });
    }

    const application = await Application.findById(req.params.id).populate(
      "userId",
      "fullName email role"
    );

    if (!application) {
      return res.status(404).json({
        success: false,
        message: "Application not found",
      });
    }

    const ownerId = String(application.userId?._id || application.userId || "");

    if (role !== "admin" && role !== "staff" && ownerId !== userId) {
      return res.status(403).json({
        success: false,
        message: "You don't have permission to access this application",
      });
    }

    return res.status(200).json({
      success: true,
      application,
    });
  } catch (error) {
    console.error("Fetch single application error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to fetch application: " + error.message,
    });
  }
});

module.exports = router;