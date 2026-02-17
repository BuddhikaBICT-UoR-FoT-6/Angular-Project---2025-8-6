const express = require('express');
const bcrypt = require('bcryptjs');
const router = express.Router();
const multer = require('multer');
const { v2: cloudinary } = require('cloudinary');

const User = require('../models/user');
const { verifyToken, requireRole } = require('../middleware/auth');
const {
  hashPassword,
  generateResetToken,
  getResetTokenExpiry,
  sanitizeUser,
  validatePasswordStrength
} = require('../utils/userUtils');

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024, files: 1 },
  fileFilter: (req, file, cb) => {
    if (!file.mimetype.startsWith('image/')) {
      return cb(new Error('Only image files are allowed'), false);
    }
    cb(null, true);
  }
});

async function uploadBufferToCloudinary(buffer, folder, options = {}) {
  return new Promise((resolve, reject) => {
    const { maxWidth = 512, maxHeight = 512, quality = 85 } = options;
    const uploadStream = cloudinary.uploader.upload_stream(
      {
        folder,
        transformation: [{ width: maxWidth, height: maxHeight, crop: 'limit', quality }]
      },
      (error, result) => {
        if (error) reject(error);
        else resolve(result);
      }
    );
    uploadStream.end(buffer);
  });
}

// Get all users with filters (Admin only)
router.get('/', verifyToken, requireRole('admin', 'superadmin'), async (req, res) => {
  try {
    const { role, status, search, page = 1, limit = 10 } = req.query;

    // Build query
    const query = {};
    if (role) query.role = role;
    if (status) query.status = status;
    if (search) {
      query.$or = [
        { full_name: { $regex: search, $options: 'i' } },
        { email: { $regex: search, $options: 'i' } }
      ];
    }

    // Calculate pagination
    const skip = (parseInt(page) - 1) * parseInt(limit);

    // Get users
    const users = await User.find(query)
      .select('-password -resetPasswordToken -resetPasswordExpires')
      .sort({ created_at: -1 })
      .skip(skip)
      .limit(parseInt(limit));

    // Get total count
    const total = await User.countDocuments(query);

    res.json({
      success: true,
      data: users,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / parseInt(limit))
      }
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get current user profile
router.get('/me', verifyToken, async (req, res) => {
  try {
    const user = await User.findById(req.user.userId).select('-password');
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    res.json(user);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Upload/update current user's profile picture (optional)
router.post('/me/profile-image', verifyToken, upload.single('image'), async (req, res) => {
  try {
    if (!process.env.CLOUDINARY_CLOUD_NAME) {
      return res.status(500).json({ error: 'Cloudinary is not configured' });
    }

    if (!req.file?.buffer) {
      return res.status(400).json({ error: 'Image file is required' });
    }

    const uploaded = await uploadBufferToCloudinary(req.file.buffer, 'clothingstore/profiles', {
      maxWidth: 512,
      maxHeight: 512,
      quality: 85
    });

    const user = await User.findByIdAndUpdate(
      req.user.userId,
      { $set: { profile_image: uploaded.secure_url } },
      { new: true }
    ).select('-password');

    res.json({
      success: true,
      url: uploaded.secure_url,
      user
    });
  } catch (err) {
    console.error('Profile image upload error:', err);
    res.status(500).json({ error: err.message || 'Failed to upload image' });
  }
});

// Create user (Admin only)
router.post('/', verifyToken, requireRole('admin', 'superadmin'), async (req, res) => {
  try {
    if (req.body.password) {
      req.body.password = await bcrypt.hash(req.body.password, 10);
    }
    const user = await new User(req.body).save();
    const userResponse = user.toObject();
    delete userResponse.password;
    res.json(userResponse);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Update user (Admin or self)
router.put('/:id', verifyToken, async (req, res) => {
  try {
    if (req.user.userId !== req.params.id && !['admin', 'superadmin'].includes(req.user.role)) {
      return res.status(403).json({ error: 'Insufficient permissions' });
    }

    if (req.body.password) {
      req.body.password = await bcrypt.hash(req.body.password, 10);
    }

    const user = await User.findByIdAndUpdate(req.params.id, req.body, { new: true }).select('-password');
    res.json(user);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Update user status (Admin only)
router.patch('/:id/status', verifyToken, requireRole('admin', 'superadmin'), async (req, res) => {
  try {
    const { status } = req.body;

    if (!['active', 'inactive', 'suspended'].includes(status)) {
      return res.status(400).json({ error: 'Invalid status. Must be active, inactive, or suspended' });
    }

    const user = await User.findById(req.params.id);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    const oldStatus = user.status;
    user.status = status;

    await user.addActivity('status_change', `Status changed from ${oldStatus} to ${status}`, req.user.userId);
    await user.save();

    res.json({
      success: true,
      message: `User ${status === 'active' ? 'activated' : status === 'inactive' ? 'deactivated' : 'suspended'} successfully`,
      data: sanitizeUser(user)
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get user activity log (Admin only)
router.get('/:id/activity', verifyToken, requireRole('admin', 'superadmin'), async (req, res) => {
  try {
    const { limit = 50 } = req.query;

    const user = await User.findById(req.params.id)
      .select('activityLog full_name email')
      .populate('activityLog.performedBy', 'full_name email');

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Get recent activities
    const activities = user.activityLog
      .slice(-parseInt(limit))
      .reverse();

    res.json({
      success: true,
      data: {
        user: {
          id: user._id,
          fullName: user.full_name,
          email: user.email
        },
        activities
      }
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Initiate password reset (Admin only)
router.post('/:id/reset-password', verifyToken, requireRole('admin', 'superadmin'), async (req, res) => {
  try {
    const user = await User.findById(req.params.id);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Generate reset token
    const resetToken = generateResetToken();
    user.resetPasswordToken = resetToken;
    user.resetPasswordExpires = getResetTokenExpiry();

    await user.addActivity('password_change', 'Password reset initiated by admin', req.user.userId);
    await user.save();

    res.json({
      success: true,
      message: 'Password reset initiated. Reset token has been generated.',
      resetToken,
      resetLink: `/reset-password/${resetToken}`
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Complete password reset with token (Public)
router.post('/reset-password/:token', async (req, res) => {
  try {
    const { password } = req.body;

    if (!password) {
      return res.status(400).json({ error: 'Password is required' });
    }

    // Validate password strength
    const passwordValidation = validatePasswordStrength(password);
    if (!passwordValidation.isValid) {
      return res.status(400).json({ error: passwordValidation.message });
    }

    // Find user with valid reset token
    const user = await User.findOne({
      resetPasswordToken: req.params.token,
      resetPasswordExpires: { $gt: Date.now() }
    });

    if (!user) {
      return res.status(400).json({ error: 'Invalid or expired reset token' });
    }

    // Hash new password
    const hashedPassword = await hashPassword(password);
    user.password = hashedPassword;
    user.resetPasswordToken = null;
    user.resetPasswordExpires = null;

    await user.addActivity('password_change', 'Password reset completed', user._id);
    await user.save();

    res.json({
      success: true,
      message: 'Password reset successfully'
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Delete user (Admin only)
router.delete('/:id', verifyToken, requireRole('admin', 'superadmin'), async (req, res) => {
  try {
    const user = await User.findById(req.params.id);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Soft delete - set status to inactive
    user.status = 'inactive';
    await user.addActivity('deleted', 'User account deleted by admin', req.user.userId);
    await user.save();

    res.json({ message: 'User deleted successfully', user: { _id: user._id, email: user.email } });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Update profile
router.put('/me/profile', verifyToken, async (req, res) => {
  try {
    const { full_name, phone, address } = req.body;
    const user = await User.findByIdAndUpdate(
      req.user.userId,
      { $set: { full_name, phone, address } },
      { new: true }
    ).select('-password');
    res.json(user);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Change password
router.put('/me/password', verifyToken, async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;
    const user = await User.findById(req.user.userId);
    if (!user) return res.status(404).json({ error: 'User not found' });

    const isMatch = await bcrypt.compare(currentPassword, user.password);
    if (!isMatch) return res.status(400).json({ error: 'Current password is incorrect' });

    user.password = await bcrypt.hash(newPassword, 10);
    await user.save();
    res.json({ message: 'Password updated successfully' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Manage addresses
router.get('/me/addresses', verifyToken, async (req, res) => {
  try {
    const user = await User.findById(req.user.userId).select('addresses');
    res.json(user.addresses || []);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/me/addresses', verifyToken, async (req, res) => {
  try {
    const user = await User.findById(req.user.userId);
    if (!user.addresses) user.addresses = [];
    if (req.body.isDefault) {
      user.addresses.forEach(a => a.isDefault = false);
    }
    user.addresses.push(req.body);
    await user.save();
    res.json(user.addresses);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.put('/me/addresses/:addressId', verifyToken, async (req, res) => {
  try {
    const user = await User.findById(req.user.userId);
    const address = user.addresses.id(req.params.addressId);
    if (!address) return res.status(404).json({ error: 'Address not found' });

    if (req.body.isDefault) {
      user.addresses.forEach(a => a.isDefault = false);
    }
    Object.assign(address, req.body);
    await user.save();
    res.json(user.addresses);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.delete('/me/addresses/:addressId', verifyToken, async (req, res) => {
  try {
    const user = await User.findById(req.user.userId);
    user.addresses.pull(req.params.addressId);
    await user.save();
    res.json(user.addresses);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Manage payment methods
router.get('/me/payment-methods', verifyToken, async (req, res) => {
  try {
    const user = await User.findById(req.user.userId).select('paymentMethods');
    res.json(user.paymentMethods || []);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/me/payment-methods', verifyToken, async (req, res) => {
  try {
    const user = await User.findById(req.user.userId);
    if (!user.paymentMethods) user.paymentMethods = [];
    if (req.body.isDefault) {
      user.paymentMethods.forEach(p => p.isDefault = false);
    }
    user.paymentMethods.push(req.body);
    await user.save();
    res.json(user.paymentMethods);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.delete('/me/payment-methods/:methodId', verifyToken, async (req, res) => {
  try {
    const user = await User.findById(req.user.userId);
    user.paymentMethods.pull(req.params.methodId);
    await user.save();
    res.json(user.paymentMethods);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Email preferences
router.get('/me/email-preferences', verifyToken, async (req, res) => {
  try {
    const user = await User.findById(req.user.userId).select('emailPreferences');
    res.json(user.emailPreferences || {});
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.put('/me/email-preferences', verifyToken, async (req, res) => {
  try {
    const user = await User.findByIdAndUpdate(
      req.user.userId,
      { $set: { emailPreferences: req.body } },
      { new: true }
    ).select('emailPreferences');
    res.json(user.emailPreferences);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
