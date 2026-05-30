const express = require("express");
const Application = require("../models/Application");
const User = require("../models/User");

const router = express.Router();

async function authorize(req, res, next) {
  const header = req.headers.authorization || '';
  if (!header.startsWith('Bearer ')) {
    return res.status(401).json({ success: false, message: 'No token' });
  }

  const token = header.slice(7).trim();
  if (!token) {
    return res.status(401).json({ success: false, message: 'No token' });
  }

  const user = await User.findOne({ apiToken: token });
  if (!user) {
    return res.status(401).json({ success: false, message: 'Invalid token' });
  }

  req.user = user;
  next();
}

router.use(authorize);

// Generic create endpoint (keeps backwards compatibility)
router.post("/", async (req, res) => {
  try {
    const application = await Application.create(req.body);

    res.status(201).json({
      success: true,
      message: "Application submitted successfully",
      application,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Failed to submit application",
      error: error.message,
    });
  }
});

// Create a new Apply permit application
router.post("/apply", async (req, res) => {
  try {
    const payload = Object.assign({}, req.body, { applicationType: "Apply" });

    // Basic validation
    if (!payload.applicant || !payload.contact) {
      return res.status(400).json({
        success: false,
        message: "Missing applicant or contact information",
      });
    }

    const application = await Application.create(payload);

    res.status(201).json({
      success: true,
      message: "Apply permit submitted",
      application,
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// Create a renew permit application linked to an existing application
router.post("/renew", async (req, res) => {
  try {
    const { previousApplicationId } = req.body;

    if (!previousApplicationId) {
      return res.status(400).json({
        success: false,
        message: "previousApplicationId is required to create a renewal",
      });
    }

    // find previous application (optional)
    const previous = await Application.findById(previousApplicationId);

    if (!previous) {
      return res.status(404).json({
        success: false,
        message: "Previous application not found",
      });
    }

    // Merge some fields from previous application as defaults for renewal
    const defaults = {
      applicant: previous.applicant,
      contact: previous.contact,
      address: previous.address,
      businessInfo: previous.businessInfo,
    };

    const payload = Object.assign({}, defaults, req.body, {
      applicationType: "Renew",
      previousApplicationId,
    });

    const renewal = await Application.create(payload);

    res.status(201).json({
      success: true,
      message: "Renewal application submitted",
      renewal,
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// Update requirements/documents for a submitted application
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
          requirements: {
            ...(req.body.requirements || {}),
          },
          updatedAt: new Date(),
        },
      },
      { new: true },
    );

    if (!application) {
      return res.status(404).json({ success: false, message: "Application not found." });
    }

    res.status(200).json({
      success: true,
      message: "Requirements updated successfully",
      application,
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// Get all applications
router.get("/", async (req, res) => {
  try {
    const applications = await Application.find().sort({ createdAt: -1 });

    res.json({ success: true, applications });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// Get single application by id
router.get("/:id", async (req, res) => {
  try {
    const application = await Application.findById(req.params.id);

    if (!application) {
      return res.status(404).json({ success: false, message: "Not found" });
    }

    res.json({ success: true, application });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

module.exports = router;