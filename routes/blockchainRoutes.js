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

    console.log("🔍 Verifying permit:", permitId);
    console.log("   ├─ Type:", typeof permitId);
    console.log("   ├─ Length:", permitId?.length);
    console.log("   └─ Is valid ObjectId:", require("mongoose").Types.ObjectId.isValid(permitId));

    // Validate permitId format
    if (!permitId || permitId.length === 0) {
      console.log("❌ Invalid permit ID provided");
      return res.status(400).json({
        success: false,
        message: "Invalid permit ID",
      });
    }

    const application = await Application.findById(permitId);

    console.log("   └─ Application found:", application ? "YES" : "NO", application?._id);

    if (!application) {
      console.log(`❌ Application not found for ID: ${permitId}`);
      return res.status(404).json({
        success: false,
        message: "Permit/Application not found",
      });
    }

    console.log(`✅ Application found:`, {
      id: application._id,
      status: application.status,
      businessName: application.businessName,
    });

    const blockchainRecord = await BlockchainRecord.findOne({
      permitId,
    });

    console.log("   └─ BlockchainRecord found:", blockchainRecord ? "YES" : "NO");

    // Return success if either application exists AND has been released
    if (!blockchainRecord) {
      console.warn(`⚠️  No blockchain record found for permit ${permitId}. Application status: ${application.status}`);
      
      // Check if permit was released (status should be "Released")
      const isReleased = application.status === "Released" || application.permitReleased === true;
      
      if (!isReleased) {
        console.log(`❌ Permit not released yet. Status: ${application.status}`);
        return res.status(400).json({
          success: false,
          message: "Permit not released yet",
          application: {
            status: application.status,
            businessName: application.businessName,
          },
        });
      }

      // Permit is released but blockchain record pending
      console.log(`✅ Permit released (blockchain record pending)`);
      return res.json({
        success: true,
        message: "Permit found and released (blockchain record pending)",
        application,
        blockchainRecord: null,
      });
    }

    console.log(`✅ Blockchain record found:`, {
      hash: blockchainRecord.hash?.substring(0, 16) + "...",
      tx: blockchainRecord.transactionSignature?.substring(0, 16) + "...",
    });

    res.json({
      success: true,
      message: "Permit is blockchain verified",
      application,
      blockchainRecord,
    });
  } catch (error) {
    console.error("❌ Verify permit error:", error);
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