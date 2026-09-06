const express = require("express");
const AuditTrail = require("../models/AuditTrail");
const protect = require("../middleware/authMiddleware");

const router = express.Router();
const resourceLabels = {
  applications: "Application",
  inspections: "Inspection",
  uploadeddocuments: "Uploaded Document",
  payments: "Payment",
  users: "User",
  auth: "Authentication",
  blockchain: "Blockchain",
};

router.get("/", protect, async (req, res) => {
  if (!['admin', 'staff'].includes(req.user.role)) {
    return res.status(403).json({ message: "Admin or staff access required" });
  }

  try {
    const limit = Math.min(Number(req.query.limit) || 500, 1000);
    const records = await AuditTrail.find()
      .sort({ createdAt: -1 })
      .limit(limit)
      .lean();

    return res.json(
      records.map((record) => ({
        _id: record._id,
        type: resourceLabels[record.resource] || record.resource,
        icon: "ti-activity",
        title: `${resourceLabels[record.resource] || record.resource} ${record.action}`,
        user: record.userName || record.userEmail || "Unknown user",
        status: record.success ? "Success" : `Failed (${record.statusCode})`,
        date: record.createdAt,
        description: record.description,
        action: record.action,
        resource: record.resource,
        method: record.method,
        path: record.path,
        statusCode: record.statusCode,
        success: record.success,
        meta: record.meta || {},
      }))
    );
  } catch (error) {
    console.error("Error fetching audit trail:", error);
    return res.status(500).json({ message: "Failed to load audit trail" });
  }
});

module.exports = router;