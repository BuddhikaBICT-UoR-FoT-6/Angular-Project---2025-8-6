const express = require('express');
const router = express.Router();

const Cart = require('../models/cart');
const Product = require('../models/product');
const { verifyToken } = require('../middleware/auth');

// Helper: return cart with product details embedded for UI
async function buildCartResponse(cart) {
  const items = cart?.items || [];
  const productIds = items.map((i) => i.productId);

  const products = await Product.find({ _id: { $in: productIds } })
    .select('_id name price image stock')
    .lean();

  const productMap = new Map(products.map((p) => [String(p._id), p]));

  return items.map((i) => {
    const p = productMap.get(String(i.productId));
    return {
      productId: String(i.productId),
      size: i.size,
      quantity: i.quantity,
      name: p?.name || 'Product',
      unitPrice: Number(p?.price || 0),
      imageUrl: Array.isArray(p?.image) ? p.image[0] : undefined,
      stock: p?.stock || { S: 0, M: 0, L: 0, XL: 0 }
    };
  });
}

// GET current user's cart
router.get('/', verifyToken, async (req, res) => {
  try {
    const userId = req.user.userId;

    const cart = await Cart.findOne({ userId }).lean();
    if (!cart) return res.json({ items: [] });

    const enriched = await buildCartResponse(cart);
    res.json({ items: enriched });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Add item (or increment if exists)
router.post('/items', verifyToken, async (req, res) => {
  try {
    const userId = req.user.userId;
    const { productId, size, quantity } = req.body || {};

    const safeQty = Math.max(1, Math.floor(Number(quantity || 1)));
    if (!productId) return res.status(400).json({ error: 'productId is required' });
    if (!['S', 'M', 'L', 'XL'].includes(String(size))) return res.status(400).json({ error: 'Invalid size' });

    // Check product exists + stock
    const product = await Product.findById(productId).select('_id stock').lean();
    if (!product) return res.status(404).json({ error: 'Product not found' });

    const available = Number(product.stock?.[size] || 0);
    if (available <= 0) return res.status(400).json({ error: 'Out of stock for selected size' });

    // Load or create cart
    const cart = await Cart.findOne({ userId });
    if (!cart) {
      const created = await Cart.create({ userId, items: [{ productId, size, quantity: Math.min(safeQty, available) }] });
      const enriched = await buildCartResponse(created.toObject());
      return res.json({ items: enriched });
    }

    const idx = cart.items.findIndex((i) => String(i.productId) === String(productId) && i.size === size);
    if (idx >= 0) {
      const nextQty = Math.min(cart.items[idx].quantity + safeQty, available);
      cart.items[idx].quantity = nextQty;
    } else {
      cart.items.push({ productId, size, quantity: Math.min(safeQty, available) });
    }

    await cart.save();
    const enriched = await buildCartResponse(cart.toObject());
    res.json({ items: enriched });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Update quantity for item
router.put('/items', verifyToken, async (req, res) => {
  try {
    const userId = req.user.userId;
    const { productId, size, quantity } = req.body || {};

    const safeQty = Math.max(1, Math.floor(Number(quantity || 1)));
    if (!productId) return res.status(400).json({ error: 'productId is required' });
    if (!['S', 'M', 'L', 'XL'].includes(String(size))) return res.status(400).json({ error: 'Invalid size' });

    const product = await Product.findById(productId).select('_id stock').lean();
    if (!product) return res.status(404).json({ error: 'Product not found' });

    const available = Number(product.stock?.[size] || 0);
    if (available <= 0) return res.status(400).json({ error: 'Out of stock for selected size' });

    const cart = await Cart.findOne({ userId });
    if (!cart) return res.json({ items: [] });

    const idx = cart.items.findIndex((i) => String(i.productId) === String(productId) && i.size === size);
    if (idx < 0) return res.json({ items: await buildCartResponse(cart.toObject()) });

    cart.items[idx].quantity = Math.min(safeQty, available);
    await cart.save();

    const enriched = await buildCartResponse(cart.toObject());
    res.json({ items: enriched });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Remove item
router.delete('/items', verifyToken, async (req, res) => {
  try {
    const userId = req.user.userId;
    const { productId, size } = req.body || {};

    if (!productId) return res.status(400).json({ error: 'productId is required' });
    if (!['S', 'M', 'L', 'XL'].includes(String(size))) return res.status(400).json({ error: 'Invalid size' });

    const cart = await Cart.findOne({ userId });
    if (!cart) return res.json({ items: [] });

    cart.items = cart.items.filter((i) => !(String(i.productId) === String(productId) && i.size === size));
    await cart.save();

    const enriched = await buildCartResponse(cart.toObject());
    res.json({ items: enriched });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Clear cart
router.delete('/', verifyToken, async (req, res) => {
  try {
    const userId = req.user.userId;
    await Cart.findOneAndUpdate({ userId }, { $set: { items: [] } }, { upsert: true });
    res.json({ items: [] });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;