const express = require("express");
const router = express.Router();
const protect = require("../middleware/authMiddleware");
const SystemLog = require("../models/SystemLog");

router.get("/", protect, async (req, res) => {
  try {
    const logs = await SystemLog.find().sort({ createdAt: -1 }).lean();
    const formatted = logs.map((log) => ({
      _id: log._id,
      type: log.type,
      message: log.message,
      date: log.createdAt.toISOString().slice(0, 10),
      time: log.createdAt.toLocaleTimeString("en-US", {
        hour: "2-digit",
        minute: "2-digit",
      }),
      meta: log.meta || {},
    }));

    res.json(formatted);
  } catch (err) {
    console.error("Error fetching system logs:", err);
    res.status(500).json({ message: "Failed to load system logs" });
  }
});

router.post("/", protect, async (req, res) => {
  const { type, message, meta } = req.body;
  if (!message) {
    return res.status(400).json({ message: "Log message is required." });
  }

  try {
    const log = await SystemLog.create({ type: type || "system", message, meta });
    res.status(201).json(log);
  } catch (err) {
    console.error("Error creating system log:", err);
    res.status(500).json({ message: "Failed to create system log." });
  }
});

module.exports = router;
