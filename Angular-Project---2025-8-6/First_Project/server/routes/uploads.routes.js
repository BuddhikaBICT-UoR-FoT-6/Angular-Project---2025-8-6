const express = require('express');
const router = express.Router();
const multer = require('multer');
const { v2: cloudinary } = require('cloudinary');

const { verifyToken } = require('../middleware/auth');
const { validateImage } = require('../utils/imageProcessor');

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024, files: 10 },
  fileFilter: (req, file, cb) => {
    if (!file.mimetype.startsWith('image/')) {
      return cb(new Error('Only image files are allowed'), false);
    }
    cb(null, true);
  }
});

async function uploadBufferToCloudinary(buffer, folder, options = {}) {
  return new Promise((resolve, reject) => {
    const { maxWidth = 1200, maxHeight = 1200, quality = 85 } = options;
    const uploadStream = cloudinary.uploader.upload_stream(
      { folder, transformation: [{ width: maxWidth, height: maxHeight, crop: 'limit', quality }] },
      (error, result) => {
        if (error) reject(error);
        else resolve(result);
      }
    );
    uploadStream.end(buffer);
  });
}

// POST /api/uploads/images
router.post('/images', verifyToken, upload.array('images', 10), async (req, res) => {
  try {
    if (!process.env.CLOUDINARY_CLOUD_NAME) {
      return res.status(500).json({ error: 'Cloudinary is not configured' });
    }

    const files = req.files || [];
    if (!files.length) {
      return res.status(400).json({ error: 'No files uploaded' });
    }

    const validationResults = await Promise.all(files.map((f) => validateImage(f.buffer)));
    const invalidImages = validationResults.filter((r) => !r.valid);
    if (invalidImages.length > 0) {
      return res.status(400).json({
        error: 'Invalid images detected',
        details: invalidImages.map((r) => r.error)
      });
    }

    const uploaded = await Promise.all(
      files.map((f) =>
        uploadBufferToCloudinary(f.buffer, 'clothingstore/products', {
          maxWidth: 1200,
          maxHeight: 1200,
          quality: 85
        })
      )
    );

    res.json({
      urls: uploaded.map((u) => u.secure_url),
      count: uploaded.length,
      message: 'Images uploaded successfully'
    });
  } catch (err) {
    console.error('Image upload error:', err);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
