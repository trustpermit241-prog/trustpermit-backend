const Clearance = require("../models/Clearance");
const createBlock = require("../blockchain/ledger");

// ===================== REQUEST CLEARANCE =====================
exports.requestClearance = async (req, res) => {
  try {
    const last = await Clearance.findOne().sort({ _id: -1 });
    const previousHash = last ? last.hash : "GENESIS";

    const block = createBlock(req.body, previousHash);

    const clearance = new Clearance({
      ...req.body,
      ...block,
      timestamp: new Date()
    });

    await clearance.save();

    // 🔥 REALTIME EVENT (does NOT affect existing logic)
    const io = req.app.get("io");
    if (io) {
      io.emit("clearanceUpdated", {
        type: "NEW_REQUEST",
        data: clearance
      });
    }

    res.json(clearance);
  } catch (err) {
    console.error("Error requesting clearance:", err);
    res.status(500).json({ msg: "Server error" });
  }
};

// ===================== VERIFY CLEARANCE =====================
exports.verifyClearance = async (req, res) => {
  try {
    const clearance = await Clearance.findById(req.params.id);
    if (!clearance) {
      return res.status(404).json({ msg: "Not found" });
    }

    const check = createBlock(
      { citizenId: clearance.citizenId, agency: clearance.agency },
      clearance.previousHash
    );

    res.json({
      valid: check.hash === clearance.hash
    });
  } catch (err) {
    console.error("Error verifying clearance:", err);
    res.status(500).json({ msg: "Server error" });
  }
};