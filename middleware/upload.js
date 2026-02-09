const multer = require("multer");
const ExpressError = require("../utils/ExpressError");

const storage = multer.memoryStorage();

function fileFilter(req, file, cb) {
  if (!file.mimetype || !file.mimetype.startsWith("image/")) {
    return cb(new ExpressError(400, "Only image files are allowed."));
  }
  cb(null, true);
}

const upload = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB
  },
});

module.exports = { upload };
