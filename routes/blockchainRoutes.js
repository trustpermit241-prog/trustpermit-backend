const express = require("express");
const router = express.Router();

const BlockchainRecord = require("../models/BlockchainRecord");
const Application = require("../models/Application");

const {
  testBlockchain,
} = require("../controllers/blockchainController");

// Test blockchain route
router.get("/test", testBlockchain);

// Verify permit by application/permit ID
router.get("/verify/:permitId", async (req, res) => {
  try {
    const { permitId } = req.params;

    // Validate permitId format
    if (!permitId || permitId.length === 0) {
      return res.status(400).json({
        success: false,
        message: "Invalid permit ID",
      });
    }

    const application = await Application.findById(permitId);

    if (!application) {
      return res.status(404).json({
        success: false,
        message: "Permit/Application not found",
      });
    }

    const blockchainRecord = await BlockchainRecord.findOne({
      permitId,
    });

    // Return success even if blockchain record is missing, but log it
    if (!blockchainRecord) {
      console.warn(`No blockchain record found for permit ${permitId}. Application status: ${application.status}`);
      
      // Still return success with the application data for display
      return res.json({
        success: true,
        message: "Permit found (blockchain record pending)",
        application,
        blockchainRecord: null,
      });
    }

    res.json({
      success: true,
      message: "Permit is blockchain verified",
      application,
      blockchainRecord,
    });
  } catch (error) {
    console.error("Verify permit error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to verify permit",
      error: error.message,
    });
  }
});

// Redirect helper for QR codes: prefer frontend verify UI if FRONTEND_URL is configured,
// otherwise fall back to the backend verify API which returns JSON.
router.get("/redirect/:permitId", async (req, res) => {
  try {
    const { permitId } = req.params;

    const frontendUrl = process.env.FRONTEND_URL;

    if (frontendUrl) {
      const target = `${frontendUrl.replace(/\/$/, "")}/verify/${permitId}`;
      return res.redirect(302, target);
    }

    // No frontend configured — redirect to backend verify API
    const hostBase = `${req.protocol}://${req.get("host")}`;
    return res.redirect(302, `${hostBase}/api/blockchain/verify/${permitId}`);
  } catch (error) {
    console.error("Redirect verify error:", error);
    return res.status(500).json({ success: false, message: "Failed to redirect for verification." });
  }
});

module.exports = router;