const mongoose = require('mongoose');

const couponSchema = new mongoose.Schema(
  {
    code: { type: String, required: true, unique: true, trim: true, uppercase: true },
    type: { type: String, enum: ['percent', 'fixed'], required: true },
    amount: { type: Number, required: true, min: 0 },
    active: { type: Boolean, default: true },
    minSubtotal: { type: Number, default: 0, min: 0 },
    expiresAt: { type: Date }
  },
  { timestamps: true }
);

module.exports = mongoose.model('Coupon', couponSchema);
