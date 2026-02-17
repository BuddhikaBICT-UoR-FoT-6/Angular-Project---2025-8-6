const sharp = require('sharp');

/**
 * Compress and resize image buffer
 * @param {Buffer} buffer - Original image buffer
 * @param {Object} options - Compression options
 * @returns {Promise<Buffer>} - Compressed image buffer
 */
async function compressImage(buffer, options = {}) {
  const {
    maxWidth = 1200,
    maxHeight = 1200,
    quality = 85,
    format = 'jpeg'
  } = options;

  try {
    let image = sharp(buffer);
    
    // Get image metadata
    const metadata = await image.metadata();
    
    // Resize if image is larger than max dimensions
    if (metadata.width > maxWidth || metadata.height > maxHeight) {
      image = image.resize(maxWidth, maxHeight, {
        fit: 'inside',
        withoutEnlargement: true
      });
    }

    // Convert and compress based on format
    if (format === 'jpeg' || format === 'jpg') {
      image = image.jpeg({ quality, progressive: true });
    } else if (format === 'png') {
      image = image.png({ quality, compressionLevel: 9 });
    } else if (format === 'webp') {
      image = image.webp({ quality });
    }

    return await image.toBuffer();
  } catch (err) {
    console.error('Image compression error:', err);
    // Return original buffer if compression fails
    return buffer;
  }
}

/**
 * Create thumbnail from image buffer
 * @param {Buffer} buffer - Original image buffer
 * @param {Object} options - Thumbnail options
 * @returns {Promise<Buffer>} - Thumbnail buffer
 */
async function createThumbnail(buffer, options = {}) {
  const {
    width = 300,
    height = 300,
    quality = 80,
    format = 'jpeg'
  } = options;

  try {
    let thumbnail = sharp(buffer)
      .resize(width, height, {
        fit: 'cover',
        position: 'center'
      });

    if (format === 'jpeg' || format === 'jpg') {
      thumbnail = thumbnail.jpeg({ quality });
    } else if (format === 'png') {
      thumbnail = thumbnail.png({ quality });
    } else if (format === 'webp') {
      thumbnail = thumbnail.webp({ quality });
    }

    return await thumbnail.toBuffer();
  } catch (err) {
    console.error('Thumbnail creation error:', err);
    throw err;
  }
}

/**
 * Get image metadata
 * @param {Buffer} buffer - Image buffer
 * @returns {Promise<Object>} - Image metadata
 */
async function getImageInfo(buffer) {
  try {
    const metadata = await sharp(buffer).metadata();
    return {
      width: metadata.width,
      height: metadata.height,
      format: metadata.format,
      size: buffer.length,
      hasAlpha: metadata.hasAlpha,
      orientation: metadata.orientation
    };
  } catch (err) {
    console.error('Error getting image info:', err);
    return null;
  }
}

/**
 * Validate image file
 * @param {Buffer} buffer - Image buffer
 * @param {Object} options - Validation options
 * @returns {Promise<Object>} - Validation result
 */
async function validateImage(buffer, options = {}) {
  const {
    maxSizeMB = 10,
    allowedFormats = ['jpeg', 'jpg', 'png', 'webp'],
    minWidth = 100,
    minHeight = 100,
    maxWidth = 5000,
    maxHeight = 5000
  } = options;

  try {
    const info = await getImageInfo(buffer);
    
    if (!info) {
      return { valid: false, error: 'Invalid image file' };
    }

    // Check file size
    const sizeMB = buffer.length / (1024 * 1024);
    if (sizeMB > maxSizeMB) {
      return { valid: false, error: `Image size exceeds ${maxSizeMB}MB limit` };
    }

    // Check format
    if (!allowedFormats.includes(info.format)) {
      return { valid: false, error: `Format ${info.format} not allowed. Allowed: ${allowedFormats.join(', ')}` };
    }

    // Check dimensions
    if (info.width < minWidth || info.height < minHeight) {
      return { valid: false, error: `Image too small. Minimum: ${minWidth}x${minHeight}px` };
    }

    if (info.width > maxWidth || info.height > maxHeight) {
      return { valid: false, error: `Image too large. Maximum: ${maxWidth}x${maxHeight}px` };
    }

    return { valid: true, info };
  } catch (err) {
    return { valid: false, error: err.message };
  }
}

module.exports = {
  compressImage,
  createThumbnail,
  getImageInfo,
  validateImage
};
