const express = require("express");
const mongoose = require("mongoose");
const Application = require("../models/Application");
const UploadedDocument = require("../models/UploadedDocument");
const authMiddleware = require("../middleware/authMiddleware");

const router = express.Router();

router.use(authMiddleware);

// ===================== NORMALIZE PAYLOAD =====================
const normalizeApplicationPayload = (body, userId, extra = {}) => {
  return {
    ...body,

    userId,
    citizenId: body.citizenId || userId,

    applicationType:
      body.applicationType ||
      body.type ||
      extra.applicationType ||
      "New Application",

    projectType: body.projectType || body.project || "",
    zoneType: body.zoneType || body.zone || "",

    businessName:
      body.businessName ||
      body.businessDetails?.businessName ||
      body.businessInfo?.businessName ||
      "",

    applicant: {
      firstName: body.applicant?.firstName || body.firstName || body.givenName || "",
      middleName: body.applicant?.middleName || body.middleName || "",
      lastName: body.applicant?.lastName || body.lastName || body.surname || "",
      suffix: body.applicant?.suffix || body.applicant?.suffixName || body.suffix || "",
      gender: body.applicant?.gender || body.gender || "",
      civilStatus: body.applicant?.civilStatus || body.civilStatus || "",
      nationality: body.applicant?.nationality || body.nationality || "",
      contactNumber:
        body.applicant?.contactNumber ||
        body.contactNumber ||
        body.phone ||
        body.mobileNumber ||
        "",
      email: body.applicant?.email || body.email || "",
    },

    address: {
      province: body.address?.province || body.province || "",
      city: body.address?.city || body.city || "",
      barangay: body.address?.barangay || body.barangay || "",
      subdivision: body.address?.subdivision || body.subdivision || "",
      street: body.address?.street || body.street || "",
      building: body.address?.building || body.building || "",
      houseNo:
        body.address?.houseNo ||
        body.address?.houseNumber ||
        body.houseNo ||
        body.houseNumber ||
        "",
      landmark: body.address?.landmark || body.landmark || "",
    },

    businessDetails: {
      businessName:
        body.businessDetails?.businessName ||
        body.businessName ||
        body.businessInfo?.businessName ||
        "",
      lineOfBusiness:
        body.businessDetails?.lineOfBusiness ||
        body.lineOfBusiness ||
        body.businessLine ||
        "",
      businessArea:
        body.businessDetails?.businessArea ||
        body.businessArea ||
        body.area ||
        "",
      malePersonnel: body.businessDetails?.malePersonnel || body.malePersonnel || 0,
      femalePersonnel:
        body.businessDetails?.femalePersonnel || body.femalePersonnel || 0,
      ...body.businessDetails,
    },

    businessInfo: {
      ...body.businessInfo,
    },

    documents: body.documents || body.uploadedDocuments || {},
    attachments: body.attachments || body.files || {},
    signature: body.signature || "",

    ...extra,
  };
};

// ===================== CREATE APPLICATION =====================
router.post("/", async (req, res) => {
  try {
    const userId = req.user._id || req.user.id;
    const payload = normalizeApplicationPayload(req.body, userId);

    const application = await Application.create(payload);

    const io = req.app.get("io");
    if (io) {
      io.emit("new-application", application);
    }

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

    const payload = normalizeApplicationPayload(req.body, userId, {
      applicationType: req.body.applicationType || "New Application",
    });

    const application = await Application.create(payload);

    const io = req.app.get("io");
    if (io) {
      io.emit("new-application", application);
    }

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

    const previous = await Application.findById(previousApplicationId).lean();

    if (!previous) {
      return res.status(404).json({
        success: false,
        message: "Previous application not found",
      });
    }

    const payload = normalizeApplicationPayload(req.body, userId, {
      applicant: req.body.applicant || previous.applicant,
      contact: req.body.contact || previous.contact,
      address: req.body.address || previous.address,
      businessInfo: req.body.businessInfo || previous.businessInfo,
      businessDetails: req.body.businessDetails || previous.businessDetails,
      businessName: req.body.businessName || previous.businessName,
      applicationType: "Renewal",
      previousApplicationId,
    });

    const renewal = await Application.create(payload);

    const io = req.app.get("io");
    if (io) {
      io.emit("new-application", renewal);
    }

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
    )
      .populate("userId", "fullName email role")
      .populate("citizenId", "fullName email role");

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
    const { status, documentStatuses } = req.body;

    if (!status) {
      return res.status(400).json({
        success: false,
        message: "Status is required.",
      });
    }

    const allowedStatuses = [
      "Pending",
      "Approved",
      "Rejected",
      "Completed",
      "Inspection",
      "For Payment",
      "Released",
    ];

    if (!allowedStatuses.includes(status)) {
      return res.status(400).json({
        success: false,
        message: "Invalid status value.",
      });
    }

    const documentDbStatus = status === "Completed" ? "Approved" : status;

    const updateFields = {
      status,
      updatedAt: new Date(),
    };

    if (documentStatuses && typeof documentStatuses === "object") {
      updateFields.documentStatuses = documentStatuses;
    }

    const application = await Application.findByIdAndUpdate(
      req.params.id,
      {
        $set: updateFields,
      },
      { new: true }
    )
      .populate("userId", "fullName email role")
      .populate("citizenId", "fullName email role");

    if (!application) {
      return res.status(404).json({
        success: false,
        message: "Application not found.",
      });
    }

    if (["Pending", "Approved", "Rejected", "Completed"].includes(status)) {
      await UploadedDocument.updateMany(
        { applicationId: application._id },
        {
          $set: {
            status: documentDbStatus,
          },
        }
      );
    }

    const io = req.app.get("io");

    if (io) {
      io.emit("application-status-updated", { application });
      io.emit("uploaded-document-status-updated", {
        applicationId: application._id,
        status: documentDbStatus,
      });
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
      query = {
        $or: [{ userId }, { citizenId: userId }],
      };
    }

    const applications = await Application.find(query)
      .populate("userId", "fullName email role")
      .populate("citizenId", "fullName email role")
      .sort({ createdAt: -1 })
      .lean();

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

    const applications = await Application.find({
      $or: [{ userId }, { citizenId: userId }],
    })
      .populate("userId", "fullName email role")
      .populate("citizenId", "fullName email role")
      .sort({ createdAt: -1 })
      .lean();

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

    const application = await Application.findById(req.params.id)
      .populate("userId", "fullName email role")
      .populate("citizenId", "fullName email role")
      .lean();

    if (!application) {
      return res.status(404).json({
        success: false,
        message: "Application not found",
      });
    }

    const ownerId = String(application.userId?._id || application.userId || "");
    const citizenId = String(application.citizenId?._id || application.citizenId || "");

    if (
      role !== "admin" &&
      role !== "staff" &&
      ownerId !== userId &&
      citizenId !== userId
    ) {
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