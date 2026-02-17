const mongoose = require('mongoose');

const cartItemSchema = new mongoose.Schema(
  {
    productId: { type: mongoose.Schema.Types.ObjectId, ref: 'Product', required: true },
    size: { type: String, enum: ['S', 'M', 'L', 'XL'], required: true },
    quantity: { type: Number, required: true, min: 1 }
  },
  { _id: false }
);

const cartSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, unique: true, index: true },
    items: { type: [cartItemSchema], default: [] }
  },
  { timestamps: true }
);

module.exports = mongoose.model('Cart', cartSchema);