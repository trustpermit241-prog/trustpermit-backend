const fs = require("fs");
const os = require("os");
const path = require("path");

const getWritableUploadsDir = () => {
  const configuredDir = process.env.UPLOADS_DIR
    ? path.resolve(process.env.UPLOADS_DIR)
    : path.join(__dirname, "../uploads");

  try {
    fs.mkdirSync(configuredDir, { recursive: true });
    fs.accessSync(configuredDir, fs.constants.W_OK);
    return configuredDir;
  } catch (error) {
    const fallbackDir = path.join(os.tmpdir(), "trustpermit", "uploads");
    fs.mkdirSync(fallbackDir, { recursive: true });
    console.warn(`UPLOADS_DIR is not writable (${configuredDir}); using ${fallbackDir}.`);
    return fallbackDir;
  }
};

module.exports = getWritableUploadsDir;