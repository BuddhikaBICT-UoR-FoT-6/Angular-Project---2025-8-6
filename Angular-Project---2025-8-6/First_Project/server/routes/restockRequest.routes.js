const express = require('express');
const crypto = require('crypto');

const router = express.Router();

const Inventory = require('../models/inventory');
const InventoryAudit = require('../models/inventoryAudit');
const RestockRequest = require('../models/restockRequest');
const User = require('../models/user');
const { verifyToken, requireRole } = require('../middleware/auth');
const { sendRestockRequestEmail, sendRestockCancellationEmail } = require('../utils/emailService');

const SIZES = ['S', 'M', 'L', 'XL'];

function normalizeSizeObject(input) {
  const normalized = { S: 0, M: 0, L: 0, XL: 0 };
  if (!input || typeof input !== 'object') return normalized;

  for (const size of SIZES) {
    const value = input[size];
    if (value === undefined || value === null || value === '') continue;

    const num = Number(value);
    if (!Number.isFinite(num)) throw new Error(`Invalid number for size ${size}`);
    if (num < 0) throw new Error(`Negative values not allowed for size ${size}`);
    normalized[size] = num;
  }
  return normalized;
}

function isAllZero(sizes) {
  return SIZES.every((s) => (sizes?.[s] ?? 0) === 0);
}

function generateCode() {
  // Human-friendly, short-ish code.
  return crypto.randomBytes(8).toString('base64').replace(/[^A-Z0-9]/gi, '').toUpperCase().slice(0, 10);
}

function sha256(input) {
  return crypto.createHash('sha256').update(String(input)).digest('hex');
}

function getRestockCodeSecret() {
  // Prefer a dedicated secret; fallback to JWT secret to avoid extra setup.
  return String(process.env.RESTOCK_CODE_SECRET || process.env.JWT_SECRET || '').trim();
}

function codeHint(code) {
  const c = String(code || '').trim().toUpperCase();
  if (c.length <= 6) return c;
  return `${c.slice(0, 3)}…${c.slice(-3)}`;
}

function encryptRestockCode(code) {
  const secret = getRestockCodeSecret();
  if (!secret) return '';

  const key = crypto.createHash('sha256').update(secret).digest(); // 32 bytes
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
  const ciphertext = Buffer.concat([cipher.update(String(code), 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();

  return `${iv.toString('base64')}.${ciphertext.toString('base64')}.${tag.toString('base64')}`;
}

function decryptRestockCode(payload) {
  const secret = getRestockCodeSecret();
  if (!secret) return '';
  if (!payload) return '';

  const parts = String(payload).split('.');
  if (parts.length !== 3) throw new Error('Invalid encrypted code format');
  const [ivB64, dataB64, tagB64] = parts;

  const key = crypto.createHash('sha256').update(secret).digest();
  const iv = Buffer.from(ivB64, 'base64');
  const data = Buffer.from(dataB64, 'base64');
  const tag = Buffer.from(tagB64, 'base64');

  const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
  decipher.setAuthTag(tag);
  const plaintext = Buffer.concat([decipher.update(data), decipher.final()]);
  return plaintext.toString('utf8');
}

function validEmail(email) {
  return /^\S+@\S+\.\S+$/.test(email);
}

function addSizeObjects(a, b) {
  return {
    S: (a?.S ?? 0) + (b?.S ?? 0),
    M: (a?.M ?? 0) + (b?.M ?? 0),
    L: (a?.L ?? 0) + (b?.L ?? 0),
    XL: (a?.XL ?? 0) + (b?.XL ?? 0)
  };
}

router.use(verifyToken);

// Admin creates a request (email supplier with a 7-day code)
// POST /api/restock-requests
// Body: { inventoryId, requested_by_size, supplier_name?, supplier_email?, note? }
router.post('/', requireRole('admin', 'superadmin'), async (req, res) => {
  try {
    const inventoryId = String(req.body?.inventoryId || '').trim();
    if (!inventoryId) return res.status(400).json({ error: 'inventoryId is required' });

    const requested = normalizeSizeObject(req.body?.requested_by_size);
    if (isAllZero(requested)) {
      return res.status(400).json({ error: 'requested_by_size must include at least one non-zero size' });
    }

    const inv = await Inventory.findById(inventoryId).populate('product_id');
    if (!inv) return res.status(404).json({ error: 'Inventory item not found' });

    const supplierName =
      typeof req.body?.supplier_name === 'string' ? req.body.supplier_name.trim() : inv.supplier || '';

    // Prefer explicitly provided supplier_email; fallback to inventory.supplier_email
    let supplierEmail = '';
    if (typeof req.body?.supplier_email === 'string') {
      supplierEmail = req.body.supplier_email.trim();
      if (supplierEmail && !validEmail(supplierEmail)) return res.status(400).json({ error: 'Invalid supplier_email' });

      inv.supplier_email = supplierEmail;
      if (supplierName) inv.supplier = supplierName;
      await inv.save();
    } else {
      supplierEmail = (inv.supplier_email || '').trim();
    }

    if (!supplierEmail) {
      return res.status(400).json({ error: 'supplier_email is required (either pass it or set it on the inventory item)' });
    }

    const code = generateCode();
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

    // Persist an encrypted copy of the code for future cancellation emails.
    const codeEnc = encryptRestockCode(code);
    const codeHintValue = codeHint(code);

    const productName = typeof inv.product_id === 'object' && inv.product_id ? inv.product_id.name || '' : '';

    const doc = await RestockRequest.create({
      inventory_id: inv._id,
      product_id: inv.product_id && inv.product_id._id ? inv.product_id._id : inv.product_id,
      requested_by_size: requested,
      supplier_name: supplierName,
      supplier_email: supplierEmail,
      note: typeof req.body?.note === 'string' ? req.body.note : '',
      request_code_hash: sha256(code),
      request_code_enc: codeEnc,
      request_code_hint: codeHintValue,
      expires_at: expiresAt,
      fulfilled_by: { userId: '', role: '' },
      cancelled_by: { userId: '', role: '' }
    });

    // Best-effort email (request creation should succeed even if email fails).
    try {
      await sendRestockRequestEmail({
        to: supplierEmail,
        supplierName,
        productName,
        requestedBySize: requested,
        requestCode: code,
        expiresAt,
        note: doc.note
      });
    } catch (emailErr) {
      console.error('Restock request created but email failed:', emailErr?.message || emailErr);
    }

    // Never return the raw code.
    res.status(201).json(doc);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// Admin: list requests (optional filter by inventoryId)
// GET /api/restock-requests?status=pending|fulfilled|cancelled|expired|all&inventoryId=<id>&limit=50
router.get('/', requireRole('admin', 'superadmin'), async (req, res) => {
  try {
    const limit = Math.min(Math.max(Number(req.query?.limit || 50), 1), 200);
    const status = String(req.query?.status || 'all');
    const inventoryId = String(req.query?.inventoryId || '').trim();

    const now = new Date();
    const query = {};

    if (inventoryId) query.inventory_id = inventoryId;

    if (status === 'pending') {
      query.fulfilled_at = { $exists: false };
      query.cancelled_at = { $exists: false };
      query.expires_at = { $gt: now };
    } else if (status === 'fulfilled') {
      query.fulfilled_at = { $exists: true };
    } else if (status === 'cancelled') {
      query.cancelled_at = { $exists: true };
    } else if (status === 'expired') {
      query.fulfilled_at = { $exists: false };
      query.cancelled_at = { $exists: false };
      query.expires_at = { $lte: now };
    }

    const items = await RestockRequest.find(query).sort({ created_at: -1 }).limit(limit).populate('product_id');
    res.json(items);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Admin: cancel a pending request
// POST /api/restock-requests/:id/cancel
// Body: { reason? }
router.post('/:id/cancel', requireRole('admin', 'superadmin'), async (req, res) => {
  try {
    const doc = await RestockRequest.findById(req.params.id).populate('product_id');
    if (!doc) return res.status(404).json({ error: 'Request not found' });

    const now = new Date();

    if (doc.fulfilled_at) return res.status(400).json({ error: 'Cannot cancel: already fulfilled' });
    if (doc.cancelled_at) return res.status(400).json({ error: 'Already cancelled' });
    if (doc.expires_at && doc.expires_at <= now) return res.status(400).json({ error: 'Cannot cancel: already expired' });

    doc.cancelled_at = now;
    doc.cancelled_reason = typeof req.body?.reason === 'string' ? req.body.reason : '';
    doc.cancelled_by = { userId: String(req.user?.userId || ''), role: String(req.user?.role || '') };

    await doc.save();

    // Best-effort email to supplier with apology + request details.
    let emailStatus = { attempted: false, success: false };
    try {
      const p = doc.product_id;
      const productName = typeof p === 'object' && p ? p.name || '' : '';

      let requestCode = '';
      try {
        requestCode = decryptRestockCode(doc.request_code_enc);
      } catch (_decryptErr) {
        requestCode = '';
      }

      emailStatus = { attempted: true, ...(await sendRestockCancellationEmail({
        to: doc.supplier_email,
        supplierName: doc.supplier_name,
        productName,
        requestedBySize: doc.requested_by_size,
        requestCode,
        requestCodeHint: doc.request_code_hint,
        requestId: String(doc._id),
        createdAt: doc.created_at,
        expiresAt: doc.expires_at,
        cancelledAt: doc.cancelled_at,
        cancellationReason: doc.cancelled_reason,
        note: doc.note
      })) };
    } catch (emailErr) {
      emailStatus = {
        attempted: true,
        success: false,
        error: emailErr?.message || String(emailErr)
      };
      console.error('Restock request cancelled but email failed:', emailErr?.message || emailErr);
    }

    res.json({ success: true, request: doc, emailStatus });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// Supplier: list my pending requests
// GET /api/restock-requests/my
router.get('/my', requireRole('supplier'), async (req, res) => {
  try {
    const user = await User.findById(req.user.userId).select('email');
    if (!user?.email) return res.status(404).json({ error: 'User not found' });

    const now = new Date();
    const items = await RestockRequest.find({
      supplier_email: user.email,
      fulfilled_at: { $exists: false },
      cancelled_at: { $exists: false },
      expires_at: { $gt: now }
    })
      .sort({ created_at: -1 })
      .populate('product_id');

    res.json(items);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Helper: fulfill + update inventory + write audit log
async function fulfillAndApplyToInventory({ requestDoc, performedBy }) {
  const now = new Date();

  const inv = await Inventory.findById(requestDoc.inventory_id).populate('product_id');
  if (!inv) throw new Error('Inventory item not found');

  const beforeRaw = typeof inv.stock_by_size?.toObject === 'function' ? inv.stock_by_size.toObject() : inv.stock_by_size;
  const before = {
    S: beforeRaw?.S ?? 0,
    M: beforeRaw?.M ?? 0,
    L: beforeRaw?.L ?? 0,
    XL: beforeRaw?.XL ?? 0
  };

  const delta = requestDoc.requested_by_size || { S: 0, M: 0, L: 0, XL: 0 };
  const after = addSizeObjects(before, delta);

  inv.stock_by_size = after;
  inv.last_restocked = now;
  await inv.save();

  await InventoryAudit.create({
    inventory_id: inv._id,
    product_id: inv.product_id && inv.product_id._id ? inv.product_id._id : inv.product_id,
    action: 'RESTOCK',
    delta_by_size: delta,
    before_by_size: before,
    after_by_size: after,
    reason: `Restock request fulfilled (requestId: ${requestDoc._id})`,
    supplier: inv.supplier || '',
    performed_by: performedBy
  });

  requestDoc.fulfilled_at = now;
  requestDoc.fulfilled_by = performedBy;
  await requestDoc.save();

  return { inv, request: requestDoc };
}

// Supplier: fulfill a request by code (this is the “scanner” action)
// POST /api/restock-requests/fulfill
// Body: { code }
router.post('/fulfill', requireRole('supplier'), async (req, res) => {
  try {
    const code = String(req.body?.code || '').trim().toUpperCase();
    if (!code) return res.status(400).json({ error: 'code is required' });

    const user = await User.findById(req.user.userId).select('email role');
    if (!user?.email) return res.status(404).json({ error: 'User not found' });

    const now = new Date();
    const codeHash = sha256(code);

    const requestDoc = await RestockRequest.findOne({
      request_code_hash: codeHash,
      supplier_email: user.email,
      fulfilled_at: { $exists: false },
      cancelled_at: { $exists: false },
      expires_at: { $gt: now }
    });

    if (!requestDoc) return res.status(400).json({ error: 'Invalid code, expired/cancelled code, or already fulfilled' });

    const performedBy = { userId: String(req.user.userId || ''), role: String(user.role || '') };
    const result = await fulfillAndApplyToInventory({ requestDoc, performedBy });

    res.json({
      success: true,
      message: 'Request fulfilled and inventory updated',
      request: {
        _id: result.request._id,
        inventory_id: result.request.inventory_id,
        product_id: result.request.product_id,
        requested_by_size: result.request.requested_by_size,
        supplier_email: result.request.supplier_email,
        fulfilled_at: result.request.fulfilled_at
      }
    });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// Optional: Admin/staff “scan” endpoint (if the scanner device uses an admin token)
// POST /api/restock-requests/scan
// Body: { code }
router.post('/scan', requireRole('admin', 'superadmin'), async (req, res) => {
  try {
    const code = String(req.body?.code || '').trim().toUpperCase();
    if (!code) return res.status(400).json({ error: 'code is required' });

    const now = new Date();
    const codeHash = sha256(code);

    const requestDoc = await RestockRequest.findOne({
      request_code_hash: codeHash,
      fulfilled_at: { $exists: false },
      cancelled_at: { $exists: false },
      expires_at: { $gt: now }
    });

    if (!requestDoc) return res.status(400).json({ error: 'Invalid code, expired/cancelled code, or already fulfilled' });

    const performedBy = { userId: String(req.user?.userId || ''), role: String(req.user?.role || '') };
    const result = await fulfillAndApplyToInventory({ requestDoc, performedBy });

    res.json({
      success: true,
      message: 'Request fulfilled (scanned) and inventory updated',
      request: {
        _id: result.request._id,
        inventory_id: result.request.inventory_id,
        product_id: result.request.product_id,
        requested_by_size: result.request.requested_by_size,
        supplier_email: result.request.supplier_email,
        fulfilled_at: result.request.fulfilled_at
      }
    });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

module.exports = router;