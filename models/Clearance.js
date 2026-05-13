const mongoose = require("mongoose");

const ClearanceSchema = new mongoose.Schema({
  citizenId: String,
  agency: String,
  status: {
    type: String,
    enum: ["pending", "approved", "rejected"],
    default: "pending"
  },
  hash: String,
  previousHash: String,
  timestamp: Date
});

module.exports = mongoose.model("Clearance", ClearanceSchema);