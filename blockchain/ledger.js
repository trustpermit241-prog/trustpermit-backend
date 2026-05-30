// ledger.js - CommonJS version
const crypto = require("crypto");

function createLedgerHash(clearance) {
  const data = `${clearance._id}${clearance.fullName}${clearance.type}${clearance.createdAt}`;
  return crypto.createHash("sha256").update(data).digest("hex");
}

// Export the function
module.exports = { createLedgerHash };