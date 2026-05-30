const express = require("express");
const mongoose = require("mongoose");
const Application = require("../models/Application");
const User = require("../models/User");

const router = express.Router();

async function authorize(req, res, next) {
  try {
    const header = req.headers.authorization || '';
    
    if (!header.startsWith('Bearer ')) {
      console.warn('⚠️  No Bearer token provided');
      return res.status(401).json({ 
        success: false, 
        message: 'Missing authorization token. Please login first.',
      });
    }

    const token = header.slice(7).trim();
    if (!token) {
      console.warn('⚠️  Empty token provided');
      return res.status(401).json({ 
        success: false, 
        message: 'Invalid authorization token.',
      });
    }

    if (mongoose.connection.readyState !== 1) {
      console.error('❌ Authorization blocked: MongoDB not connected.');
      return res.status(503).json({
        success: false,
        message: 'Database temporarily unavailable. Please try again later.',
      });
    }

    const user = await User.findOne({ apiToken: token });
    if (!user) {
      console.warn('⚠️  Token not found for:', token.substring(0, 10) + '...');
      return res.status(401).json({ 
        success: false, 
        message: 'Invalid token. Please login again.',
      });
    }

    req.user = user;
    next();
  } catch (error) {
    console.error('❌ Authorization error:', error.message);
    return res.status(500).json({
      success: false,
      message: 'Authentication error: ' + error.message,
    });
  }
}

router.use(authorize);

// Generic create endpoint (keeps backwards compatibility)
router.post("/", async (req, res) => {
  try {
    console.log('📝 Creating application for user:', req.user.email);
    console.log('📋 Payload:', JSON.stringify(req.body, null, 2));

    // Add user reference
    const payload = {
      ...req.body,
      userId: req.user._id,
    };

    const application = await Application.create(payload);

    console.log('✅ Application created:', application._id);
    res.status(201).json({
      success: true,
      message: "Application submitted successfully",
      application,
    });
  } catch (error) {
    console.error('❌ Error creating application:', error.message);
    console.error('❌ Error details:', error);
    
    res.status(500).json({
      success: false,
      message: "Failed to submit application: " + error.message,
      error: process.env.NODE_ENV === 'development' ? error.message : undefined,
    });
  }
});

// Create a new Apply permit application
router.post("/apply", async (req, res) => {
  try {
    console.log('📝 Creating Apply permit for user:', req.user.email);

    const payload = {
      ...req.body,
      applicationType: "Apply",
      userId: req.user._id,
    };

    // Basic validation
    if (!payload.applicant || !payload.contact) {
      console.warn('⚠️  Missing required fields:', { 
        hasApplicant: !!payload.applicant, 
        hasContact: !!payload.contact 
      });
      return res.status(400).json({
        success: false,
        message: "Missing applicant or contact information",
      });
    }

    const application = await Application.create(payload);

    console.log('✅ Apply permit created:', application._id);
    res.status(201).json({
      success: true,
      message: "Apply permit submitted",
      application,
    });
  } catch (error) {
    console.error('❌ Error creating Apply permit:', error.message);
    res.status(500).json({ 
      success: false, 
      message: "Failed to create apply permit: " + error.message,
      error: process.env.NODE_ENV === 'development' ? error.message : undefined,
    });
  }
});

// Create a renew permit application linked to an existing application
router.post("/renew", async (req, res) => {
  try {
    console.log('📝 Creating Renew permit for user:', req.user.email);

    const { previousApplicationId } = req.body;

    if (!previousApplicationId) {
      return res.status(400).json({
        success: false,
        message: "previousApplicationId is required to create a renewal",
      });
    }

    // find previous application
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

    const payload = {
      ...defaults,
      ...req.body,
      applicationType: "Renew",
      previousApplicationId,
      userId: req.user._id,
    };

    const renewal = await Application.create(payload);

    console.log('✅ Renewal application created:', renewal._id);
    res.status(201).json({
      success: true,
      message: "Renewal application submitted",
      renewal,
    });
  } catch (error) {
    console.error('❌ Error creating renewal:', error.message);
    res.status(500).json({ 
      success: false, 
      message: "Failed to create renewal: " + error.message,
      error: process.env.NODE_ENV === 'development' ? error.message : undefined,
    });
  }
});

// Update requirements/documents for a submitted application
router.patch("/:id/requirements", async (req, res) => {
  try {
    console.log('🔄 Updating requirements for application:', req.params.id);

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
      return res.status(404).json({ 
        success: false, 
        message: "Application not found." 
      });
    }

    console.log('✅ Requirements updated for:', req.params.id);
    res.status(200).json({
      success: true,
      message: "Requirements updated successfully",
      application,
    });
  } catch (error) {
    console.error('❌ Error updating requirements:', error.message);
    res.status(500).json({ 
      success: false, 
      message: "Failed to update requirements: " + error.message,
      error: process.env.NODE_ENV === 'development' ? error.message : undefined,
    });
  }
});

// Get all applications for the logged-in user
router.get("/", async (req, res) => {
  try {
    console.log('📊 Fetching applications for user:', req.user.email);

    const applications = await Application.find({ userId: req.user._id }).sort({ 
      createdAt: -1 
    });

    console.log('✅ Found', applications.length, 'applications');
    res.json({ 
      success: true, 
      applications,
      count: applications.length,
    });
  } catch (error) {
    console.error('❌ Error fetching applications:', error.message);
    res.status(500).json({ 
      success: false, 
      message: "Failed to fetch applications: " + error.message,
      error: process.env.NODE_ENV === 'development' ? error.message : undefined,
    });
  }
});

// Get single application by id
router.get("/:id", async (req, res) => {
  try {
    console.log('🔍 Fetching application:', req.params.id);

    const application = await Application.findById(req.params.id);

    if (!application) {
      return res.status(404).json({ 
        success: false, 
        message: "Application not found" 
      });
    }

    // Check if user owns this application
    if (application.userId && application.userId.toString() !== req.user._id.toString()) {
      return res.status(403).json({
        success: false,
        message: "You don't have permission to access this application",
      });
    }

    console.log('✅ Application found:', req.params.id);
    res.json({ 
      success: true, 
      application 
    });
  } catch (error) {
    console.error('❌ Error fetching application:', error.message);
    res.status(500).json({ 
      success: false, 
      message: "Failed to fetch application: " + error.message,
      error: process.env.NODE_ENV === 'development' ? error.message : undefined,
    });
  }
});

module.exports = router;