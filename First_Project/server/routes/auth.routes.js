const express = require('express');
const bcrypt = require('bcryptjs');
const router = express.Router();

const User = require('../models/user');
const OTP = require('../models/otp');
const { generateToken, verifyToken } = require('../middleware/auth');
const { generateOTP, sendRegistrationOTP, sendPasswordResetOTP } = require('../utils/emailService');

// Send OTP for registration
router.post('/send-registration-otp', async (req, res) => {
  try {
    const { email, full_name } = req.body;

    if (!email) {
      return res.status(400).json({ error: 'Email is required' });
    }

    const existingUser = await User.findOne({ email: email.toLowerCase() });
    if (existingUser) {
      return res.status(400).json({ error: 'Email already registered' });
    }

    const otp = generateOTP();

    await OTP.deleteMany({ 
      email: email.toLowerCase(), 
      purpose: 'registration',
      verified: false
    });

    const otpDoc = new OTP({
      email: email.toLowerCase(),
      otp,
      purpose: 'registration',
      expiresAt: new Date(Date.now() + 10 * 60 * 1000)
    });
    await otpDoc.save();

    await sendRegistrationOTP(email, otp, full_name);

    res.json({ 
      success: true,
      message: 'OTP sent to your email',
      expiresIn: 600
    });
  } catch (err) {
    console.error('Error sending registration OTP:', err);
    res.status(500).json({ error: 'Failed to send OTP. Please try again.' });
  }
});

// Verify OTP and complete registration
router.post('/verify-registration-otp', async (req, res) => {
  try {
    const { email, otp, password, full_name, phone, address } = req.body;

    if (!email || !otp || !password) {
      return res.status(400).json({ error: 'Email, OTP, and password are required' });
    }

    const otpRecord = await OTP.findOne({
      email: email.toLowerCase(),
      purpose: 'registration',
      verified: false,
      expiresAt: { $gt: new Date() }
    });

    if (!otpRecord) {
      return res.status(400).json({ error: 'Invalid or expired OTP' });
    }

    if (otpRecord.attempts >= 5) {
      await OTP.deleteOne({ _id: otpRecord._id });
      return res.status(429).json({ error: 'Too many failed attempts. Please request a new OTP.' });
    }

    if (otpRecord.otp !== otp) {
      otpRecord.attempts += 1;
      await otpRecord.save();
      return res.status(400).json({ 
        error: 'Invalid OTP',
        attemptsLeft: 5 - otpRecord.attempts
      });
    }

    otpRecord.verified = true;
    await otpRecord.save();

    const existingUser = await User.findOne({ email: email.toLowerCase() });
    if (existingUser) {
      return res.status(400).json({ error: 'Email already registered' });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const user = new User({
      email: email.toLowerCase(),
      password: hashedPassword,
      full_name,
      phone,
      role: 'customer',
      address: address || {}
    });

    await user.save();

    const token = generateToken(user._id, user.role);

    await OTP.deleteOne({ _id: otpRecord._id });

    res.status(201).json({ 
      success: true,
      message: 'Registration successful',
      token,
      user: {
        userId: user._id,
        email: user.email,
        full_name: user.full_name,
        role: user.role
      }
    });
  } catch (err) {
    console.error('Error verifying registration OTP:', err);
    res.status(500).json({ error: 'Registration failed. Please try again.' });
  }
});

// Send OTP for password reset
router.post('/forgot-password', async (req, res) => {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({ error: 'Email is required' });
    }

    const user = await User.findOne({ email: email.toLowerCase() });
    if (!user) {
      return res.json({ 
        success: true,
        message: 'If an account exists with this email, you will receive a password reset OTP.'
      });
    }

    const otp = generateOTP();

    await OTP.deleteMany({ 
      email: email.toLowerCase(), 
      purpose: 'password-reset',
      verified: false
    });

    const otpDoc = new OTP({
      email: email.toLowerCase(),
      otp,
      purpose: 'password-reset',
      expiresAt: new Date(Date.now() + 10 * 60 * 1000)
    });
    await otpDoc.save();

    await sendPasswordResetOTP(email, otp, user.full_name);

    res.json({ 
      success: true,
      message: 'If an account exists with this email, you will receive a password reset OTP.',
      expiresIn: 600
    });
  } catch (err) {
    console.error('Error sending password reset OTP:', err);
    res.status(500).json({ error: 'Failed to send OTP. Please try again.' });
  }
});

// Verify OTP for password reset
router.post('/verify-reset-otp', async (req, res) => {
  try {
    const { email, otp } = req.body;

    if (!email || !otp) {
      return res.status(400).json({ error: 'Email and OTP are required' });
    }

    const otpRecord = await OTP.findOne({
      email: email.toLowerCase(),
      purpose: 'password-reset',
      verified: false,
      expiresAt: { $gt: new Date() }
    });

    if (!otpRecord) {
      return res.status(400).json({ error: 'Invalid or expired OTP' });
    }

    if (otpRecord.attempts >= 5) {
      await OTP.deleteOne({ _id: otpRecord._id });
      return res.status(429).json({ error: 'Too many failed attempts. Please request a new OTP.' });
    }

    if (otpRecord.otp !== otp) {
      otpRecord.attempts += 1;
      await otpRecord.save();
      return res.status(400).json({ 
        error: 'Invalid OTP',
        attemptsLeft: 5 - otpRecord.attempts
      });
    }

    otpRecord.verified = true;
    await otpRecord.save();

    res.json({ 
      success: true,
      message: 'OTP verified successfully. You can now reset your password.',
      resetToken: otpRecord._id
    });
  } catch (err) {
    console.error('Error verifying reset OTP:', err);
    res.status(500).json({ error: 'Failed to verify OTP. Please try again.' });
  }
});

// Reset password with verified OTP
router.post('/reset-password', async (req, res) => {
  try {
    const { resetToken, newPassword } = req.body;

    if (!resetToken || !newPassword) {
      return res.status(400).json({ error: 'Reset token and new password are required' });
    }

    if (newPassword.length < 6) {
      return res.status(400).json({ error: 'Password must be at least 6 characters long' });
    }

    const otpRecord = await OTP.findOne({
      _id: resetToken,
      purpose: 'password-reset',
      verified: true,
      expiresAt: { $gt: new Date() }
    });

    if (!otpRecord) {
      return res.status(400).json({ error: 'Invalid or expired reset token' });
    }

    const user = await User.findOne({ email: otpRecord.email });
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    const hashedPassword = await bcrypt.hash(newPassword, 10);
    user.password = hashedPassword;
    await user.save();

    await OTP.deleteOne({ _id: otpRecord._id });

    res.json({ 
      success: true,
      message: 'Password reset successful. You can now login with your new password.'
    });
  } catch (err) {
    console.error('Error resetting password:', err);
    res.status(500).json({ error: 'Failed to reset password. Please try again.' });
  }
});

// Login
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    const user = await User.findOne({ email });
    if (!user) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const isValidPassword = await bcrypt.compare(password, user.password);
    if (!isValidPassword) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const token = generateToken(user._id, user.role);

    res.json({ 
      message: 'Login successful',
      token,
      user: {
        userId: user._id,
        email: user.email,
        full_name: user.full_name,
        role: user.role
      }
    });
  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ error: err.message });
  }
});

// Verify token
router.get('/verify', verifyToken, async (req, res) => {
  try {
    const user = await User.findById(req.user.userId).select('-password');
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    res.json({ 
      valid: true,
      user: {
        userId: user._id,
        email: user.email,
        full_name: user.full_name,
        role: user.role
      }
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
