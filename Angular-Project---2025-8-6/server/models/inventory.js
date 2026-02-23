const mongoose = require('mongoose');

// Inventory collection
// - One document per product (enforced by unique index on product_id)
// - Tracks stock by size (S/M/L/XL)
// - Stores per-size thresholds for low-stock alerts
const inventorySchema = new mongoose.Schema(
    {
        product_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Product', required: true },

        // Real-time stock tracking by size
        stock_by_size: {
            S: { type: Number, default: 0, min: 0, required: true },
            M: { type: Number, default: 0, min: 0, required: true },
            L: { type: Number, default: 0, min: 0, required: true },
            XL: { type: Number, default: 0, min: 0, required: true }
        },

        // Low stock threshold by size (used for alerts)
        low_stock_threshold_by_size: {
            S: { type: Number, default: 5, min: 0 },
            M: { type: Number, default: 5, min: 0 },
            L: { type: Number, default: 5, min: 0 },
            XL: { type: Number, default: 5, min: 0 }
        },

        // NOTE: Backwards-compatible typo in DB field name.
        // We keep the stored field name `last_restoked` but expose an alias `last_restocked`.
        last_restoked: { type: Date, default: Date.now, alias: 'last_restocked' },

        supplier: { type: String, default: '' },

        // Optional supplier email (used for restock notifications)
        supplier_email: { type: String, default: '' }
    },
    {
        // Keep the existing created_at/updated_at naming used elsewhere in this project.
        timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' }
    }
);

// Ensure 1 inventory record per product.
inventorySchema.index({ product_id: 1 }, { unique: true });

module.exports = mongoose.model('Inventory', inventorySchema);
