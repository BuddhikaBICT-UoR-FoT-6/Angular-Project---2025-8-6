const express = require('express');
const router = express.Router();

const Cart = require('../models/cart');
const Product = require('../models/product');
const Order = require('../models/order');
const Coupon = require('../models/coupon');
const PendingCheckout = require('../models/pendingCheckout');
const User = require('../models/user');
const OTP = require('../models/otp');
const { verifyToken } = require('../middleware/auth');
const { generateOTP, sendCheckoutOTP } = require('../utils/emailService');
const { generateInvoicePDF, sendInvoiceEmail } = require('../utils/invoiceGenerator');

function toUpperCode(code) {
  return String(code || '').trim().toUpperCase();
}

function calcDiscount(subtotal, coupon) {
  if (!coupon) return 0;
  if (!coupon.active) return 0;
  if (coupon.expiresAt && new Date(coupon.expiresAt).getTime() < Date.now()) return 0;
  if (Number(subtotal) < Number(coupon.minSubtotal || 0)) return 0;

  if (coupon.type === 'percent') {
    const pct = Math.max(0, Math.min(100, Number(coupon.amount || 0)));
    return Math.round((Number(subtotal) * pct) / 100 * 100) / 100;
  }

  // fixed
  return Math.min(Number(subtotal), Math.max(0, Number(coupon.amount || 0)));
}

async function buildCartForUser(userId) {
  const cart = await Cart.findOne({ userId }).lean();
  const items = cart?.items || [];
  if (items.length === 0) return { items: [], products: new Map() };

  const productIds = items.map((i) => i.productId);
  const products = await Product.find({ _id: { $in: productIds } })
    .select('_id name price image stock colors')
    .lean();

  const productMap = new Map(products.map((p) => [String(p._id), p]));
  return { items, products: productMap };
}

function normalizeShippingAddress(input) {
  const a = input || {};
  return {
    fullName: String(a.fullName || '').trim(),
    phone: String(a.phone || '').trim(),
    line1: String(a.line1 || a.street || '').trim(),
    line2: String(a.line2 || '').trim(),
    city: String(a.city || '').trim(),
    state: String(a.state || '').trim(),
    postalCode: String(a.postalCode || '').trim(),
    country: String(a.country || '').trim()
  };
}

function requireBasicShipping(addr) {
  if (!addr.line1) return 'Address line 1 is required';
  if (!addr.city) return 'City is required';
  if (!addr.country) return 'Country is required';
  return '';
}

async function requireValidCheckoutOtpToken(userId, checkoutToken) {
  const token = String(checkoutToken || '').trim();
  if (!token) {
    const err = new Error('OTP verification is required');
    err.status = 403;
    throw err;
  }

  if (!/^[a-fA-F0-9]{24}$/.test(token)) {
    const err = new Error('Invalid checkoutToken');
    err.status = 400;
    throw err;
  }

  const user = await User.findById(userId).select('email').lean();
  if (!user?.email) {
    const err = new Error('User email not found');
    err.status = 400;
    throw err;
  }

  const otpRecord = await OTP.findOne({
    _id: token,
    email: String(user.email).toLowerCase(),
    purpose: 'checkout',
    verified: true,
    expiresAt: { $gt: new Date() }
  }).lean();

  if (!otpRecord) {
    const err = new Error('Invalid or expired checkout OTP token');
    err.status = 403;
    throw err;
  }

  return otpRecord;
}

function sendError(res, err) {
  const status = Number(err?.status || 0);
  if (status >= 400 && status < 600) {
    const msg = err.message || 'Request failed';
    return res.status(status).json({ error: msg, message: msg });
  }

  // Map common validation to 4xx instead of generic 500
  const msg = String(err?.message || 'Server error');
  if (msg === 'Cart is empty') return res.status(400).json({ error: msg });
  if (err?.name === 'ValidationError') return res.status(400).json({ error: msg });
  if (err?.name === 'CastError') return res.status(400).json({ error: msg });

  console.error('Checkout route error:', err);
  return res.status(500).json({ error: msg });
}

async function computeSummary(userId, couponCode) {
  const { items, products } = await buildCartForUser(userId);

  const enriched = [];
  let subtotal = 0;

  for (const i of items) {
    const p = products.get(String(i.productId));
    const unitPrice = Number(p?.price || 0);
    const qty = Number(i.quantity || 0);
    subtotal += unitPrice * qty;

    enriched.push({
      productId: String(i.productId),
      size: i.size,
      quantity: qty,
      name: p?.name || 'Product',
      unitPrice,
      imageUrl: Array.isArray(p?.image) ? p.image[0] : undefined,
      stock: p?.stock || { S: 0, M: 0, L: 0, XL: 0 }
    });
  }

  subtotal = Math.round(subtotal * 100) / 100;

  const code = toUpperCode(couponCode);
  const coupon = code ? await Coupon.findOne({ code }).lean() : null;
  const discount = Math.round(calcDiscount(subtotal, coupon) * 100) / 100;
  const total = Math.round(Math.max(0, subtotal - discount) * 100) / 100;

  return {
    items: enriched,
    subtotal,
    discount,
    total,
    coupon: coupon && discount > 0 ? { code: coupon.code, type: coupon.type, amount: coupon.amount } : null
  };
}

async function ensureFetch() {
  if (typeof fetch === 'function') return fetch;
  throw new Error('Global fetch is not available in this Node runtime.');
}

async function stripeCreateSession({ secretKey, successUrl, cancelUrl, lineItems }) {
  const f = await ensureFetch();
  const body = new URLSearchParams();
  body.set('mode', 'payment');
  body.set('success_url', successUrl);
  body.set('cancel_url', cancelUrl);

  lineItems.forEach((li, idx) => {
    body.set(`line_items[${idx}][quantity]`, String(li.quantity));
    body.set(`line_items[${idx}][price_data][currency]`, li.currency || 'usd');
    body.set(`line_items[${idx}][price_data][unit_amount]`, String(li.unitAmount));
    body.set(`line_items[${idx}][price_data][product_data][name]`, li.name);
  });

  const res = await f('https://api.stripe.com/v1/checkout/sessions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${secretKey}`,
      'Content-Type': 'application/x-www-form-urlencoded'
    },
    body
  });

  const json = await res.json();
  if (!res.ok) {
    throw new Error(json?.error?.message || 'Stripe session create failed');
  }

  return json;
}

async function stripeGetSession({ secretKey, sessionId }) {
  const f = await ensureFetch();
  const res = await f(`https://api.stripe.com/v1/checkout/sessions/${encodeURIComponent(sessionId)}`, {
    headers: { Authorization: `Bearer ${secretKey}` }
  });
  const json = await res.json();
  if (!res.ok) {
    throw new Error(json?.error?.message || 'Stripe session fetch failed');
  }
  return json;
}

async function paypalGetAccessToken({ clientId, clientSecret }) {
  const f = await ensureFetch();
  const basic = Buffer.from(`${clientId}:${clientSecret}`).toString('base64');

  const res = await f('https://api-m.sandbox.paypal.com/v1/oauth2/token', {
    method: 'POST',
    headers: {
      Authorization: `Basic ${basic}`,
      'Content-Type': 'application/x-www-form-urlencoded'
    },
    body: 'grant_type=client_credentials'
  });

  const json = await res.json();
  if (!res.ok) {
    throw new Error(json?.error_description || 'PayPal auth failed');
  }

  return json.access_token;
}

async function paypalCreateOrder({ accessToken, total, currency, returnUrl, cancelUrl }) {
  const f = await ensureFetch();

  const res = await f('https://api-m.sandbox.paypal.com/v2/checkout/orders', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      intent: 'CAPTURE',
      purchase_units: [
        {
          amount: {
            currency_code: currency.toUpperCase(),
            value: total.toFixed(2)
          }
        }
      ],
      application_context: {
        return_url: returnUrl,
        cancel_url: cancelUrl
      }
    })
  });

  const json = await res.json();
  if (!res.ok) {
    throw new Error(json?.message || 'PayPal order create failed');
  }

  return json;
}

async function paypalCaptureOrder({ accessToken, orderId }) {
  const f = await ensureFetch();
  const res = await f(`https://api-m.sandbox.paypal.com/v2/checkout/orders/${encodeURIComponent(orderId)}/capture`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json'
    }
  });
  const json = await res.json();
  if (!res.ok) {
    throw new Error(json?.message || 'PayPal capture failed');
  }
  return json;
}

// Summary for checkout UI
router.get('/summary', verifyToken, async (req, res) => {
  try {
    const userId = req.user.userId;
    const couponCode = req.query.coupon;
    const summary = await computeSummary(userId, couponCode);
    res.json(summary);
  } catch (err) {
    sendError(res, err);
  }
});

// Validate coupon code
router.post('/validate-coupon', verifyToken, async (req, res) => {
  try {
    const code = toUpperCode(req.body?.code);
    const subtotal = Math.max(0, Number(req.body?.subtotal || 0));

    if (!code) return res.json({ valid: false, code: '', discount: 0 });

    const coupon = await Coupon.findOne({ code }).lean();
    const discount = Math.round(calcDiscount(subtotal, coupon) * 100) / 100;

    res.json({
      valid: Boolean(coupon) && discount > 0,
      code: coupon?.code || code,
      discount,
      total: Math.round(Math.max(0, subtotal - discount) * 100) / 100
    });
  } catch (err) {
    sendError(res, err);
  }
});

// Send OTP for checkout verification
router.post('/send-otp', verifyToken, async (req, res) => {
  try {
    const userId = req.user.userId;
    const user = await User.findById(userId).select('email full_name').lean();
    if (!user?.email) return res.status(400).json({ error: 'User email not found' });

    const email = String(user.email).toLowerCase();
    const otp = generateOTP();

    await OTP.deleteMany({ email, purpose: 'checkout', verified: false });

    const otpDoc = await OTP.create({
      email,
      otp,
      purpose: 'checkout',
      expiresAt: new Date(Date.now() + 10 * 60 * 1000)
    });

    await sendCheckoutOTP(email, otp, user.full_name);

    res.json({ success: true, message: 'OTP sent', expiresIn: 600, checkoutToken: String(otpDoc._id) });
  } catch (err) {
    sendError(res, err);
  }
});

// Verify OTP for checkout verification
router.post('/verify-otp', verifyToken, async (req, res) => {
  try {
    const userId = req.user.userId;
    const code = String(req.body?.otp || '').trim();
    const checkoutToken = String(req.body?.checkoutToken || '').trim();

    if (!code || !checkoutToken) {
      return res.status(400).json({ error: 'OTP and checkoutToken are required' });
    }

    const user = await User.findById(userId).select('email').lean();
    if (!user?.email) return res.status(400).json({ error: 'User email not found' });

    const otpRecord = await OTP.findOne({
      _id: checkoutToken,
      email: String(user.email).toLowerCase(),
      purpose: 'checkout',
      verified: false,
      expiresAt: { $gt: new Date() }
    });

    if (!otpRecord) return res.status(400).json({ error: 'Invalid or expired OTP' });

    if (otpRecord.attempts >= 5) {
      await OTP.deleteOne({ _id: otpRecord._id });
      return res.status(429).json({ error: 'Too many failed attempts. Please request a new OTP.' });
    }

    if (otpRecord.otp !== code) {
      otpRecord.attempts += 1;
      await otpRecord.save();
      return res.status(400).json({ error: 'Invalid OTP', attemptsLeft: 5 - otpRecord.attempts });
    }

    otpRecord.verified = true;
    await otpRecord.save();

    res.json({ success: true, message: 'OTP verified', checkoutToken: String(otpRecord._id) });
  } catch (err) {
    sendError(res, err);
  }
});

// Create Stripe checkout session
router.post('/stripe/create-session', verifyToken, async (req, res) => {
  try {
    const secretKey = process.env.STRIPE_SECRET_KEY;
    if (!secretKey) return res.status(501).json({ error: 'Stripe is not configured (missing STRIPE_SECRET_KEY)' });

    const userId = req.user.userId;
    await requireValidCheckoutOtpToken(userId, req.body?.checkoutToken);
    const shippingAddress = normalizeShippingAddress(req.body?.shippingAddress);
    const shipErr = requireBasicShipping(shippingAddress);
    if (shipErr) return res.status(400).json({ error: shipErr });

    const couponCode = toUpperCode(req.body?.couponCode);
    const summary = await computeSummary(userId, couponCode);
    if (!summary.items.length) return res.status(400).json({ error: 'Cart is empty' });

    const baseUrl = process.env.PUBLIC_APP_URL || 'http://localhost:4200';
    const successUrl = process.env.STRIPE_SUCCESS_URL || `${baseUrl}/checkout?status=success&session_id={CHECKOUT_SESSION_ID}`;
    const cancelUrl = process.env.STRIPE_CANCEL_URL || `${baseUrl}/checkout?status=cancelled`;

    const lineItems = summary.items.map((i) => ({
      name: `${i.name} (${i.size})`,
      quantity: i.quantity,
      currency: 'usd',
      unitAmount: Math.round(Number(i.unitPrice) * 100)
    }));

    const session = await stripeCreateSession({ secretKey, successUrl, cancelUrl, lineItems });

    await PendingCheckout.create({
      userId,
      provider: 'stripe',
      providerRef: String(session.id),
      currency: 'usd',
      subtotal: summary.subtotal,
      discount: summary.discount,
      total: summary.total,
      couponCode: summary.coupon?.code || '',
      shippingAddress,
      otpToken: String(req.body?.checkoutToken || '').trim(),
      expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000)
    });

    res.json({ provider: 'stripe', providerRef: session.id, url: session.url });
  } catch (err) {
    sendError(res, err);
  }
});

// Create PayPal order (Sandbox)
router.post('/paypal/create-order', verifyToken, async (req, res) => {
  try {
    const clientId = process.env.PAYPAL_CLIENT_ID;
    const clientSecret = process.env.PAYPAL_CLIENT_SECRET;
    if (!clientId || !clientSecret) {
      return res.status(501).json({ error: 'PayPal is not configured (missing PAYPAL_CLIENT_ID / PAYPAL_CLIENT_SECRET)' });
    }

    const userId = req.user.userId;
    await requireValidCheckoutOtpToken(userId, req.body?.checkoutToken);
    const shippingAddress = normalizeShippingAddress(req.body?.shippingAddress);
    const shipErr = requireBasicShipping(shippingAddress);
    if (shipErr) return res.status(400).json({ error: shipErr });

    const couponCode = toUpperCode(req.body?.couponCode);
    const summary = await computeSummary(userId, couponCode);
    if (!summary.items.length) return res.status(400).json({ error: 'Cart is empty' });

    const baseUrl = process.env.PUBLIC_APP_URL || 'http://localhost:4200';
    const returnUrl = process.env.PAYPAL_RETURN_URL || `${baseUrl}/checkout?status=paypal_success&token={order_id}`;
    const cancelUrl = process.env.PAYPAL_CANCEL_URL || `${baseUrl}/checkout?status=paypal_cancelled`;

    const accessToken = await paypalGetAccessToken({ clientId, clientSecret });
    const order = await paypalCreateOrder({
      accessToken,
      total: Number(summary.total),
      currency: 'USD',
      returnUrl,
      cancelUrl
    });

    const approve = Array.isArray(order.links) ? order.links.find((l) => l.rel === 'approve') : null;

    await PendingCheckout.create({
      userId,
      provider: 'paypal',
      providerRef: String(order.id),
      currency: 'usd',
      subtotal: summary.subtotal,
      discount: summary.discount,
      total: summary.total,
      couponCode: summary.coupon?.code || '',
      shippingAddress,
      otpToken: String(req.body?.checkoutToken || '').trim(),
      expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000)
    });

    res.json({ provider: 'paypal', providerRef: order.id, approvalUrl: approve?.href });
  } catch (err) {
    sendError(res, err);
  }
});

async function createOrderFromCart({ userId, shippingAddress, paymentMethod, couponCodeOverride }) {
  const { items, products } = await buildCartForUser(userId);
  if (!items.length) throw new Error('Cart is empty');

  const summary = await computeSummary(userId, couponCodeOverride);

  const orderItems = items.map((i) => {
    const p = products.get(String(i.productId));
    const color = Array.isArray(p?.colors) && p.colors.length ? String(p.colors[0]) : 'Default';
    return {
      product_id: i.productId,
      name: p?.name || 'Product',
      size: i.size,
      color,
      quantity: i.quantity,
      price: Number(p?.price || 0)
    };
  });

  const created = await Order.create({
    user_id: userId,
    items: orderItems,
    total_amount: summary.total,
    status: 'pending',
    shipping_address: {
      fullName: shippingAddress.fullName,
      phone: shippingAddress.phone,
      street: shippingAddress.line1,
      line1: shippingAddress.line1,
      line2: shippingAddress.line2,
      city: shippingAddress.city,
      state: shippingAddress.state,
      postalCode: shippingAddress.postalCode,
      country: shippingAddress.country
    },
    payment_method: paymentMethod,
    coupon_code: summary.coupon?.code || '',
    discount_amount: summary.discount
  });

  await Cart.findOneAndUpdate({ userId }, { $set: { items: [] } }, { upsert: true });

  return { orderId: String(created._id), total: summary.total };
}

// Confirm / place order
router.post('/confirm', verifyToken, async (req, res) => {
  try {
    const userId = req.user.userId;
    const paymentMethod = String(req.body?.paymentMethod || 'cash_on_delivery');
    const providerRef = String(req.body?.providerRef || '').trim();
    const checkoutToken = String(req.body?.checkoutToken || '').trim();

    if (!['credit_card', 'paypal', 'cash_on_delivery'].includes(paymentMethod)) {
      const m = 'Invalid payment method';
      return res.status(400).json({ error: m, message: m });
    }

    // Always require a verified OTP for checkout confirmation
    await requireValidCheckoutOtpToken(userId, checkoutToken);

    if (paymentMethod === 'cash_on_delivery') {
      const shippingAddress = normalizeShippingAddress(req.body?.shippingAddress);
      const shipErr = requireBasicShipping(shippingAddress);
      if (shipErr) return res.status(400).json({ error: shipErr });

      const couponCode = toUpperCode(req.body?.couponCode);
      const created = await createOrderFromCart({ userId, shippingAddress, paymentMethod, couponCodeOverride: couponCode });

      // send invoice pdf by email in background (non-blocking)
      (async () => {
        try {
          const user = await User.findById(userId).select('email full_name').lean();
          if (user?.email) {
            const orderDoc = await Order.findById(created.orderId).populate('user_id').lean();
            const pdf = await generateInvoicePDF(orderDoc);
              await sendInvoiceEmail(user.email, orderDoc, pdf);
          }
        } catch (e) {
          console.error('Error sending invoice email (COD):', e);
        }
      })();

      await OTP.deleteOne({ _id: checkoutToken }).catch(() => undefined);
      return res.json({ ok: true, message: 'Order placed successfully', ...created });
    }

    // Stripe/PayPal: confirm based on providerRef (session/order id) and pending checkout data
    if (!providerRef) return res.status(400).json({ error: 'providerRef is required' });

    const pending = await PendingCheckout.findOne({ userId, providerRef, status: 'created' }).lean();
    if (!pending) return res.status(404).json({ error: 'Pending checkout not found (expired or already completed)' });

    if (pending.otpToken && String(pending.otpToken) !== checkoutToken) {
      return res.status(403).json({ error: 'OTP token does not match this checkout session' });
    }

    if (paymentMethod === 'credit_card') {
      const secretKey = process.env.STRIPE_SECRET_KEY;
      if (!secretKey) return res.status(501).json({ error: 'Stripe is not configured (missing STRIPE_SECRET_KEY)' });

      const session = await stripeGetSession({ secretKey, sessionId: providerRef });
      if (session.payment_status !== 'paid') {
        return res.status(400).json({ error: 'Stripe payment not completed' });
      }

      const created = await createOrderFromCart({
        userId,
        shippingAddress: pending.shippingAddress,
        paymentMethod: 'credit_card',
        couponCodeOverride: pending.couponCode
      });

        // send invoice pdf by email in background (non-blocking)
        (async () => {
          try {
            const user = await User.findById(userId).select('email full_name').lean();
            if (user?.email) {
              const orderDoc = await Order.findById(created.orderId).populate('user_id').lean();
              const pdf = await generateInvoicePDF(orderDoc);
              await sendInvoiceEmail(user.email, orderDoc, pdf);
            }
          } catch (e) {
            console.error('Error sending invoice email (Stripe):', e);
          }
        })();

        await PendingCheckout.updateOne({ _id: pending._id }, { $set: { status: 'completed' } });
        await OTP.deleteOne({ _id: checkoutToken }).catch(() => undefined);
        return res.json({ ok: true, provider: 'stripe', message: 'Payment confirmed and order created', ...created });
    }

    if (paymentMethod === 'paypal') {
      const clientId = process.env.PAYPAL_CLIENT_ID;
      const clientSecret = process.env.PAYPAL_CLIENT_SECRET;
      if (!clientId || !clientSecret) {
        return res.status(501).json({ error: 'PayPal is not configured (missing PAYPAL_CLIENT_ID / PAYPAL_CLIENT_SECRET)' });
      }

      const accessToken = await paypalGetAccessToken({ clientId, clientSecret });
      const captured = await paypalCaptureOrder({ accessToken, orderId: providerRef });

      const status = String(captured?.status || '').toUpperCase();
      if (status !== 'COMPLETED') {
        return res.status(400).json({ error: 'PayPal payment not completed' });
      }

      const created = await createOrderFromCart({
        userId,
        shippingAddress: pending.shippingAddress,
        paymentMethod: 'paypal',
        couponCodeOverride: pending.couponCode
      });

        // send invoice pdf by email in background (non-blocking)
        (async () => {
          try {
            const user = await User.findById(userId).select('email full_name').lean();
            if (user?.email) {
              const orderDoc = await Order.findById(created.orderId).populate('user_id').lean();
              const pdf = await generateInvoicePDF(orderDoc);
              await sendInvoiceEmail(user.email, orderDoc, pdf);
            }
          } catch (e) {
            console.error('Error sending invoice email (PayPal):', e);
          }
        })();

        await PendingCheckout.updateOne({ _id: pending._id }, { $set: { status: 'completed' } });
        await OTP.deleteOne({ _id: checkoutToken }).catch(() => undefined);
        return res.json({ ok: true, provider: 'paypal', message: 'Payment confirmed and order created', ...created });
    }

    res.status(400).json({ error: 'Unsupported payment flow' });
  } catch (err) {
    sendError(res, err);
  }
});

module.exports = router;
