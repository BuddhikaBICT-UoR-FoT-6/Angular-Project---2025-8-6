const mongoose = require('mongoose');

const otpSchema = new mongoose.Schema({
  email: {
    type: String,
    required: true,
    lowercase: true,
    trim: true
  },
  otp: {
    type: String,
    required: true
  },
  purpose: {
    type: String,
    required: true,
    enum: ['registration', 'password-reset', 'account-deactivation', 'account-deletion']
  },
  verified: {
    type: Boolean,
    default: false
  },
  attempts: {
    type: Number,
    default: 0
  },
  expiresAt: {
    type: Date,
    required: true,
    index: { expires: 0 } // MongoDB TTL index - automatically deletes expired documents
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

// Index for faster lookups
otpSchema.index({ email: 1, purpose: 1, verified: 1 });

const OTP = mongoose.model('OTP', otpSchema);

module.exports = OTP;
