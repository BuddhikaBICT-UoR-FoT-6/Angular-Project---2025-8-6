const mongoose = require('mongoose');

// RestockRequest
// - Created by admin/superadmin when stock is needed from a supplier
// - Includes a one-time code (stored hashed) that is valid for 7 days
// - Request is "FULFILLED" only when the code is scanned/fulfilled
// - Admin can cancel a pending request

const restockRequestSchema = new mongoose.Schema(
  {
    inventory_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Inventory', required: true },
    product_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Product' },

    requested_by_size: {
      S: { type: Number, default: 0, min: 0, required: true },
      M: { type: Number, default: 0, min: 0, required: true },
      L: { type: Number, default: 0, min: 0, required: true },
      XL: { type: Number, default: 0, min: 0, required: true }
    },

    supplier_name: { type: String, default: '' },
    supplier_email: { type: String, required: true },

    note: { type: String, default: '' },

    // Store the code hashed so DB leaks don't reveal valid codes.
    request_code_hash: { type: String, required: true, index: true },

    // Expiration (7 days from creation). Enforced in API.
    expires_at: { type: Date, required: true },

    // Marked when the batch code is scanned/fulfilled.
    fulfilled_at: { type: Date },
    fulfilled_by: {
      userId: { type: String, default: '' },
      role: { type: String, default: '' }
    },

    // Admin can cancel pending requests.
    cancelled_at: { type: Date },
    cancelled_by: {
      userId: { type: String, default: '' },
      role: { type: String, default: '' }
    },
    cancelled_reason: { type: String, default: '' }
  },
  { timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' } }
);

restockRequestSchema.index({ supplier_email: 1, created_at: -1 });
restockRequestSchema.index({ inventory_id: 1, created_at: -1 });
restockRequestSchema.index({ expires_at: 1 });

module.exports = mongoose.model('RestockRequest', restockRequestSchema);