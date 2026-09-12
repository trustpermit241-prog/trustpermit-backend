const multer = require('multer');
const path = require('path');
const fs = require('fs');
const getWritableUploadsDir = require('../utils/uploadStorage');

const uploadRoot = getWritableUploadsDir();
const uploadDirectory = path.join(uploadRoot, 'documents');

if (!fs.existsSync(uploadDirectory)) {
  fs.mkdirSync(uploadDirectory, { recursive: true });
}

// Set up storage engine
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, uploadDirectory);
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, uniqueSuffix + '-' + file.originalname);
  }
});

const fileFilter = (req, file, cb) => {
  // Accept only certain file types (optional)
  cb(null, true);
};

const upload = multer({ storage, fileFilter });

module.exports = upload;