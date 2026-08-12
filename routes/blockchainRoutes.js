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

    if (!blockchainRecord) {
      return res.status(404).json({
        success: false,
        message: "No blockchain record found for this permit",
        application,
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