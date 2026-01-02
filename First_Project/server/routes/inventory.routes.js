const express = require('express');
const router = express.Router();

const Inventory = require('../models/inventory');
const InventoryAudit = require('../models/inventoryAudit');
const { verifyToken, requireRole } = require('../middleware/auth');
const { sendRestockNotificationEmail } = require('../utils/emailService');

// Supported sizes (kept consistent across backend + frontend)
const SIZES = ['S', 'M', 'L', 'XL'];

// Normalize input into a full size object.
// - Missing sizes become 0
// - Rejects non-numeric values
// - allowNegative=true is used for adjustments (delta can be negative)
function normalizeSizeObject(input, { allowNegative = false } = {}) {
  const normalized = { S: 0, M: 0, L: 0, XL: 0 };
  if (!input || typeof input !== 'object') return normalized;

  for (const size of SIZES) {
    const value = input[size];
    if (value === undefined || value === null || value === '') continue;

    const num = Number(value);
    if (!Number.isFinite(num)) {
      throw new Error(`Invalid number for size ${size}`);
    }
    if (!allowNegative && num < 0) {
      throw new Error(`Negative values not allowed for size ${size}`);
    }
    normalized[size] = num;
  }

  return normalized;
}

function addSizeObjects(a, b) {
  return {
    S: (a?.S ?? 0) + (b?.S ?? 0),
    M: (a?.M ?? 0) + (b?.M ?? 0),
    L: (a?.L ?? 0) + (b?.L ?? 0),
    XL: (a?.XL ?? 0) + (b?.XL ?? 0)
  };
}

function ensureNonNegativeSizes(stock) {
  for (const size of SIZES) {
    if ((stock?.[size] ?? 0) < 0) {
      throw new Error(`Stock cannot be negative for size ${size}`);
    }
  }
}

// Inventory management should be admin-only.
// Frontend already attaches Bearer token via auth interceptor.
router.use(verifyToken, requireRole('admin', 'superadmin'));

router.get('/', async (req, res) => {
  try {
    // Populate product so UI can show product name without extra requests.
    const items = await Inventory.find().populate('product_id').sort({ updated_at: -1 });
    res.json(items);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Low stock alerts
router.get('/low-stock', async (req, res) => {
  try {
    // Compute which sizes are at/below threshold.
    const items = await Inventory.find().populate('product_id');

    const results = items
      .map((inv) => {
        const stock = inv.stock_by_size || {};
        const thresholds = inv.low_stock_threshold_by_size || {};

        const low = SIZES
          .map((size) => ({
            size,
            stock: stock[size] ?? 0,
            threshold: thresholds[size] ?? 0
          }))
          .filter((x) => x.stock <= x.threshold);

        return low.length
          ? {
              inventory_id: inv._id,
              product: inv.product_id,
              stock_by_size: inv.stock_by_size,
              low_stock_threshold_by_size: inv.low_stock_threshold_by_size,
              low
            }
          : null;
      })
      .filter(Boolean);

    res.json(results);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/', async (req, res) => {
  try {
    // Simple CRUD endpoint (optional utility).
    res.json(await new Inventory(req.body).save());
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.put('/:id', async (req, res) => {
  try {
    // Simple CRUD endpoint (optional utility).
    res.json(await Inventory.findByIdAndUpdate(req.params.id, req.body, { new: true }));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Restock: increments stock by size
// Payload:
//   { add: {S,M,L,XL}, supplier?: string, supplier_email?: string, note?: string }
router.post('/:id/restock', async (req, res) => {
  try {
    // Populate product so we can include a friendly product name in email.
    const inv = await Inventory.findById(req.params.id).populate('product_id');
    if (!inv) return res.status(404).json({ error: 'Inventory item not found' });

    // Restock adds are non-negative increments.
    const add = normalizeSizeObject(req.body?.add, { allowNegative: false });
    const beforeRaw = typeof inv.stock_by_size?.toObject === 'function' ? inv.stock_by_size.toObject() : inv.stock_by_size;
    const before = {
      S: beforeRaw?.S ?? 0,
      M: beforeRaw?.M ?? 0,
      L: beforeRaw?.L ?? 0,
      XL: beforeRaw?.XL ?? 0
    };
    const after = addSizeObjects(before, add);
    ensureNonNegativeSizes(after);

    inv.stock_by_size = after;
    inv.last_restocked = new Date();
    if (typeof req.body?.supplier === 'string') inv.supplier = req.body.supplier;
    if (typeof req.body?.supplier_email === 'string') {
      const email = req.body.supplier_email.trim();
      if (email && !/^\S+@\S+\.\S+$/.test(email)) {
        return res.status(400).json({ error: 'Invalid supplier_email' });
      }
      inv.supplier_email = email;
    }

    await inv.save();

    await InventoryAudit.create({
      inventory_id: inv._id,
      product_id: inv.product_id && inv.product_id._id ? inv.product_id._id : inv.product_id,
      action: 'RESTOCK',
      delta_by_size: add,
      before_by_size: before,
      after_by_size: after,
      reason: typeof req.body?.note === 'string' ? req.body.note : '',
      supplier: inv.supplier || '',
      performed_by: { userId: req.user?.userId || '', role: req.user?.role || '' }
    });

    // Send notification email to supplier (if email is provided).
    // In dev mode, this is logged to the console by emailService.
    if (inv.supplier_email) {
      const productName = typeof inv.product_id === 'object' && inv.product_id ? inv.product_id.name : '';
      try {
        await sendRestockNotificationEmail({
          to: inv.supplier_email,
          supplierName: inv.supplier,
          productName,
          addedBySize: add,
          newStockBySize: after,
          timestamp: inv.last_restocked
        });
      } catch (emailErr) {
        // Don't block restocks if email fails.
        console.error('Restock succeeded but email failed:', emailErr?.message || emailErr);
      }
    }

    res.json(inv);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// Adjust: can increase or decrease stock, requires reason
// Payload:
//   { delta: {S,M,L,XL}, reason: string }
router.post('/:id/adjust', async (req, res) => {
  try {
    const reason = (req.body?.reason || '').toString().trim();
    if (!reason) return res.status(400).json({ error: 'Adjustment reason is required' });

    const inv = await Inventory.findById(req.params.id);
    if (!inv) return res.status(404).json({ error: 'Inventory item not found' });

    // Adjustments can be positive or negative.
    const delta = normalizeSizeObject(req.body?.delta, { allowNegative: true });
    const beforeRaw = typeof inv.stock_by_size?.toObject === 'function' ? inv.stock_by_size.toObject() : inv.stock_by_size;
    const before = {
      S: beforeRaw?.S ?? 0,
      M: beforeRaw?.M ?? 0,
      L: beforeRaw?.L ?? 0,
      XL: beforeRaw?.XL ?? 0
    };
    const after = addSizeObjects(before, delta);
    // Prevent stock from ever going negative.
    ensureNonNegativeSizes(after);

    inv.stock_by_size = after;
    await inv.save();

    await InventoryAudit.create({
      inventory_id: inv._id,
      product_id: inv.product_id,
      action: 'ADJUST',
      delta_by_size: delta,
      before_by_size: before,
      after_by_size: after,
      reason,
      supplier: inv.supplier || '',
      performed_by: { userId: req.user?.userId || '', role: req.user?.role || '' }
    });

    res.json(inv);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// Inventory history/audit log
// Returns newest-first.
router.get('/:id/history', async (req, res) => {
  try {
    const limit = Math.min(Math.max(Number(req.query?.limit || 50), 1), 200);
    const history = await InventoryAudit.find({ inventory_id: req.params.id })
      .sort({ created_at: -1 })
      .limit(limit);
    res.json(history);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.delete('/:id', async (req, res) => {
  try {
    res.json(await Inventory.findByIdAndDelete(req.params.id));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
