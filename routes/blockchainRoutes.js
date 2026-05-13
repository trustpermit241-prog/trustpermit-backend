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

module.exports = router;