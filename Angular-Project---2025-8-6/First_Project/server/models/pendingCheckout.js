const mongoose = require('mongoose');

const pendingCheckoutSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    provider: { type: String, enum: ['stripe', 'paypal'], required: true },
    providerRef: { type: String, required: true, unique: true, index: true },

    currency: { type: String, default: 'usd' },
    subtotal: { type: Number, required: true },
    discount: { type: Number, default: 0 },
    total: { type: Number, required: true },

    couponCode: { type: String, default: '' },
    otpToken: { type: String, default: '' },
    shippingAddress: {
      fullName: { type: String, default: '' },
      phone: { type: String, default: '' },
      line1: { type: String, default: '' },
      line2: { type: String, default: '' },
      city: { type: String, default: '' },
      state: { type: String, default: '' },
      postalCode: { type: String, default: '' },
      country: { type: String, default: '' }
    },

    status: { type: String, enum: ['created', 'completed', 'cancelled'], default: 'created' },
    expiresAt: { type: Date, required: true, index: { expires: 0 } }
  },
  { timestamps: true }
);

module.exports = mongoose.model('PendingCheckout', pendingCheckoutSchema);
