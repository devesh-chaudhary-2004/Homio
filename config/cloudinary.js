const cloudinary = require("cloudinary").v2;

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

async function uploadImageBuffer(file, options = {}) {
  if (!file) return null;

  const base64 = file.buffer.toString("base64");
  const dataUri = `data:${file.mimetype};base64,${base64}`;

  const result = await cloudinary.uploader.upload(dataUri, {
    folder: "homio/listings",
    resource_type: "image",
    ...options,
  });

  return {
    url: result.secure_url,
    publicId: result.public_id,
  };
}

async function deleteByPublicId(publicId) {
  if (!publicId) return;
  try {
    await cloudinary.uploader.destroy(publicId);
  } catch (e) {
    // ignore delete failures
  }
}

module.exports = { cloudinary, uploadImageBuffer, deleteByPublicId };
