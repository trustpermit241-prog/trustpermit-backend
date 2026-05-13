const crypto = require("crypto");

const hashPermit = (permitData) => {
  return crypto
    .createHash("sha256")
    .update(JSON.stringify(permitData))
    .digest("hex");
};

module.exports = hashPermit;