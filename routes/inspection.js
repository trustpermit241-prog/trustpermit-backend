const express = require("express");
const router = express.Router();
const Inspection = require("../models/Inspection");
const User = require("../models/User");
const mongoose = require("mongoose");
const protect = require("../middleware/authMiddleware"); // JWT auth middleware

// ================= FRIENDLY GET FALLBACK =================
router.get("/schedule", (req, res) => {
  res.send("This endpoint is POST-only. Use POST to schedule an inspection.");
});

// ================= DEBUG: Get all inspections (no auth) =================
router.get("/debug/all", async (req, res) => {
  try {
    const inspections = await Inspection.find()
      .populate("citizenId")
      .populate("scheduledBy");
    console.log("🔍 All inspections in DB:", inspections.length);
    res.json(inspections);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ================= DEBUG: Check current user info =================
router.get("/debug/me", protect, async (req, res) => {
  try {
    console.log("👤 Current user token decoded:", req.user);
    const user = await User.findById(req.user._id || req.user.id);
    res.json({
      tokenData: req.user,
      dbUser: user,
      message: `Token has _id: ${!!req.user._id}, Token has id: ${!!req.user.id}`
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ================= SCHEDULE INSPECTION (STAFF) =================
router.post("/schedule", protect, async (req, res) => {
  try {
    const { citizenEmail, type, date, time, remarks } = req.body;
    const normalizedCitizenEmail = (citizenEmail || "").trim().toLowerCase();
    console.log("📝 Scheduling inspection request:", { citizenEmail, type, date, time, remarks }); // DEBUG

    if (!normalizedCitizenEmail || !type || !date || !time) {
      return res.status(400).json({
        message: "Missing required fields: citizenEmail, type, date, or time.",
      });
    }

    const scheduledAt = new Date(`${date}T${time}`);
    if (isNaN(scheduledAt.getTime())) {
      return res.status(400).json({
        message: "Invalid date or time format.",
      });
    }

    // Find citizen by email
    const citizen = await User.findOne({ email: normalizedCitizenEmail });
    console.log("🔍 Looking for citizen with email:", citizenEmail); // DEBUG
    console.log("👤 Found citizen:", citizen ? `ID: ${citizen._id}, Email: ${citizen.email}` : "NOT FOUND"); // DEBUG
    
    if (!citizen) {
      return res.status(404).json({
        message: `Citizen with email ${citizenEmail} not found.`,
      });
    }


    // Assign dummy inspector based on type
    const inspectorMap = {
      "Fire Safety Inspection": "Juan Dela Cruz",
      "Sanitary Inspection": "Maria Santos",
      "Building & Electrical": "Jose Ramos",
      "Locational / Zoning": "Ana Lopez",
      "Environmental": "Pedro Garcia"
    };
    const inspector = inspectorMap[type] || "Default Inspector";

    // Create inspection
    const inspection = new Inspection({
      citizenId: citizen._id,
      type,
      date: scheduledAt,
      remarks: remarks || "",
      scheduledBy: req.user._id || req.user.id, // staff who scheduled
      inspector
    });

    await inspection.save();
    console.log("✅ Inspection saved with ID:", inspection._id, "for citizen ID:", inspection.citizenId); // DEBUG
    
    await inspection.populate({
      path: "citizenId",
      select: "fullName email",
    });

    res.status(201).json({
      message: "Inspection scheduled successfully",
      inspection,
    });
  } catch (err) {
    console.error("Schedule Inspection Error:", err);
    res.status(500).json({
      message: "Failed to schedule inspection",
      error: err.message,
    });
  }
});

// ================= GET ALL INSPECTIONS (STAFF) =================
router.get("/", protect, async (req, res) => {
  try {
    const inspections = await Inspection.find()
      .populate({ path: "citizenId", select: "fullName email" })
      .sort({ date: 1 });

    res.json(inspections);
  } catch (err) {
    res.status(500).json({
      message: "Failed to fetch inspections",
      error: err.message,
    });
  }
});

// ================= GET INSPECTIONS FOR LOGGED-IN USER =================
router.get("/my", protect, async (req, res) => {
  try {
    // Handle both _id and id (for backward compatibility)
    const userId = req.user._id || req.user.id;
    const tokenEmail = (req.user.email || "").trim().toLowerCase();
    
    console.log("🔍 User requesting inspections. User ID:", userId, "Email:", req.user.email); // DEBUG
    
    if (!userId && !tokenEmail) {
      return res.status(400).json({
        message: "User ID not found in token. Token data: " + JSON.stringify(req.user)
      });
    }

    // Resolve the authoritative user record. This avoids mismatches if token payload shape changed.
    const user = userId
      ? await User.findById(userId).select("_id email")
      : await User.findOne({ email: tokenEmail }).select("_id email");

    if (!user) {
      return res.status(404).json({ message: "User account not found for this token." });
    }
    
    const inspections = await Inspection.find({
      citizenId: user._id, // only for logged-in user
    })
      .sort({ date: 1 }) // sort by scheduled date
      .populate({ path: "scheduledBy", select: "fullName email" }); // optional: staff info

    console.log(`✅ Found ${inspections.length} inspections for user ${user._id}`); // DEBUG
    res.json(inspections);
  } catch (err) {
    console.error("Failed to fetch user inspections:", err);
    res.status(500).json({
      message: "Failed to fetch user inspections",
      error: err.message,
    });
  }
});

// ================= DELETE ALL INSPECTIONS FOR LOGGED-IN USER =================
router.delete("/my", protect, async (req, res) => {
  try {
    const userId = req.user._id || req.user.id;

    if (!userId) {
      return res.status(400).json({
        message: "User ID not found in token.",
      });
    }

    const result = await Inspection.deleteMany({ citizenId: userId });

    res.json({
      message: "Requested inspections cleared successfully.",
      deletedCount: result.deletedCount || 0,
    });
  } catch (err) {
    res.status(500).json({
      message: "Failed to clear requested inspections",
      error: err.message,
    });
  }
});

// ================= UPDATE INSPECTION STATUS (STAFF) =================
router.patch("/:id/status", protect, async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    if (!["Pending", "Approved", "Rejected"].includes(status)) {
      return res.status(400).json({ message: "Invalid status value" });
    }

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ message: "Invalid inspection ID" });
    }

    const inspection = await Inspection.findByIdAndUpdate(
      id,
      { status },
      { new: true }
    ).populate({ path: "citizenId", select: "fullName email" });

    if (!inspection) {
      return res.status(404).json({ message: "Inspection not found" });
    }

    res.json(inspection);
  } catch (err) {
    res.status(500).json({
      message: "Failed to update status",
      error: err.message,
    });
  }
});

module.exports = router;
