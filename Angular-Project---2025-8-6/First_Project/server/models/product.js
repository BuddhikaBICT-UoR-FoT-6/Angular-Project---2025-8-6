// Product model (MongoDB + Mongoose)
const mongoose = require('mongoose');

const productSchema = new mongoose.Schema(
  {
    // Basic details
    name: { type: String, required: true, trim: true },
    description: { type: String, default: '' },
    category: { type: String, required: true, trim: true },
    sub_category: { type: String, default: '' },

    // Pricing
    price: { type: Number, required: true, min: 0 },
    discount: { type: Number, default: 0, min: 0 },

    // Optional merchandising fields
    image: { type: [String], default: [] },
    sizes: { type: [String], default: [] },
    colors: { type: [String], default: [] },

    // Inventory by size
    stock: {
      S: { type: Number, default: 0, min: 0 },
      M: { type: Number, default: 0, min: 0 },
      L: { type: Number, default: 0, min: 0 },
      XL: { type: Number, default: 0, min: 0 }
    }
  },
  // Automatically adds createdAt/updatedAt
  { timestamps: true }
);

// Enforce uniqueness by (name + category)
productSchema.index({ name: 1, category: 1 }, { unique: true });

module.exports = mongoose.model('Product', productSchema);