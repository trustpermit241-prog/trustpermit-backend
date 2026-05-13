const express = require("express");
const router = express.Router();
const Application = require("../models/Application");
const protect = require("../middleware/authMiddleware");

// =====================================================
// Get all applications with uploaded documents (for staff review)
// =====================================================
router.get("/review/pending", protect, async (req, res) => {
  try {
    const role = req.user.role;
    if (role !== "staff" && role !== "admin") {
      return res.status(403).json({ message: "Access denied" });
    }
    // Find applications that have at least one document uploaded
    const applications = await Application.find({
      documents: { $exists: true, $ne: {} },
      status: "Pending"
    })
      .populate({ path: "citizenId", select: "fullName email" })
      .populate({ path: "assignedStaff", select: "fullName email" })
      .sort({ createdAt: -1 });
    res.json(applications);
  } catch (err) {
    console.error("Fetch review applications error:", err);
    res.status(500).json({ message: "Failed to fetch review applications", error: err.message });
  }
});

// =====================================================
// Get a specific application's uploaded documents (for staff review)
// =====================================================
router.get("/review/:id/documents", protect, async (req, res) => {
  try {
    const role = req.user.role;
    if (role !== "staff" && role !== "admin") {
      return res.status(403).json({ message: "Access denied" });
    }
    const { id } = req.params;
    const application = await Application.findById(id);
    if (!application) {
      return res.status(404).json({ message: "Application not found" });
    }
    res.json({ documents: application.documents });
  } catch (err) {
    console.error("Fetch application documents error:", err);
    res.status(500).json({ message: "Failed to fetch documents", error: err.message });
  }
});

module.exports = router;
