const mongoose = require('mongoose');

// Shared schema for sizes, used in audit log.
const sizesSchema = new mongoose.Schema(
  {
    S: { type: Number, default: 0, required: true },
    M: { type: Number, default: 0, required: true },
    L: { type: Number, default: 0, required: true },
    XL: { type: Number, default: 0, required: true }
  },
  { _id: false }
);

// Captures who performed the action (from JWT middleware).
const performedBySchema = new mongoose.Schema(
  {
    userId: { type: String, default: '' },
    role: { type: String, default: '' }
  },
  { _id: false }
);

// InventoryAudit collection
// - Immutable audit entries for RESTOCK/ADJUST operations
// - Stores before/after snapshots for traceability
// - Stores a required reason for ADJUST (enforced by route)
const inventoryAuditSchema = new mongoose.Schema(
  {
    inventory_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Inventory', required: true },
    product_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Product', required: true },

    action: { type: String, enum: ['RESTOCK', 'ADJUST'], required: true },

    delta_by_size: { type: sizesSchema, required: true },
    before_by_size: { type: sizesSchema, required: true },
    after_by_size: { type: sizesSchema, required: true },

    reason: { type: String, default: '' },
    supplier: { type: String, default: '' },

    performed_by: { type: performedBySchema, default: () => ({}) }
  },
  {
    // Only store created timestamp; audit entries should not be updated.
    timestamps: { createdAt: 'created_at', updatedAt: false }
  }
);

// Common query patterns: fetch history for an inventory item or product.
inventoryAuditSchema.index({ inventory_id: 1, created_at: -1 });
inventoryAuditSchema.index({ product_id: 1, created_at: -1 });

module.exports = mongoose.model('InventoryAudit', inventoryAuditSchema);
