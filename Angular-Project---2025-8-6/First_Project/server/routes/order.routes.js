const express = require('express');
const router = express.Router();
const Order = require('../models/order');
const { verifyToken, requireRole } = require('../middleware/auth');
const { generateInvoicePDF, sendInvoiceEmail } = require('../utils/invoiceGenerator');
const { broadcastAnalyticsUpdated } = require('../utils/analyticsStream');

/**
 * GET /api/orders
 * Fetch all orders (Admin only)
 * Populates user details for display
 */
router.get('/', verifyToken, requireRole('admin', 'superadmin'), async (req, res) => {
  try {
    const filter = {};
    if (req.query.status) {
      filter.status = req.query.status;
    }
    const orders = await Order.find(filter).populate('user_id', 'full_name email');
    res.json(orders);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * GET /api/orders/my-orders
 * Fetch authenticated customer's orders
 * Requires authentication token
 */
router.get('/my-orders', verifyToken, async (req, res) => {
  try {
    const filter = { user_id: req.user.userId };
    if (req.query.status) {
      filter.status = req.query.status;
    }
    const orders = await Order.find(filter).sort({ created_at: -1 });
    res.json(orders);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * GET /api/orders/:id
 * Fetch single order by ID
 * Returns order with populated user details
 */
router.get('/:id', verifyToken, async (req, res) => {
  try {
    const order = await Order.findById(req.params.id).populate('user_id', 'full_name email');
    if (!order) return res.status(404).json({ error: 'Order not found' });

    // Check ownership or admin role
    if (req.user.role !== 'admin' && req.user.role !== 'superadmin' && order.user_id._id.toString() !== req.user.userId) {
      return res.status(403).json({ error: 'Unauthorized' });
    }

    res.json(order);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * GET /api/orders/:id/invoice
 * Generate and download invoice PDF
 * Returns PDF file as download
 */
router.get('/:id/invoice', verifyToken, async (req, res) => {
  try {
    const order = await Order.findById(req.params.id).populate('user_id', 'full_name email');
    if (!order) return res.status(404).json({ error: 'Order not found' });

    // Check ownership or admin role
    if (req.user.role !== 'admin' && req.user.role !== 'superadmin' && order.user_id._id.toString() !== req.user.userId) {
      return res.status(403).json({ error: 'Unauthorized' });
    }

    // Generate PDF
    const pdfBuffer = await generateInvoicePDF(order);

    // Set response headers for PDF download
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename=invoice-${order._id}.pdf`);
    res.send(pdfBuffer);
  } catch (err) {
    res.status(500).json({ error: 'Failed to generate invoice' });
  }
});

/**
 * POST /api/orders
 * Create new order (Admin only - Customers use checkout)
 * Generates invoice and sends confirmation email
 */
router.post('/', verifyToken, requireRole('admin', 'superadmin'), async (req, res) => {
  try {
    // Create order
    const order = await new Order(req.body).save();

    // Populate user details for email
    await order.populate('user_id', 'full_name email');

    // Generate invoice PDF
    try {
      const pdfBuffer = await generateInvoicePDF(order);

      // Send confirmation email with invoice
      if (order.user_id && order.user_id.email) {
        await sendInvoiceEmail(order.user_id.email, order, pdfBuffer);
      }
    } catch (emailError) {
      console.error('Failed to send invoice email:', emailError);
      // Don't fail order creation if email fails
    }

    broadcastAnalyticsUpdated('order_created');
    broadcastAnalyticsUpdated('order_status_updated');

    res.json(order);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * PATCH /api/orders/:id/status
 * Update order status (Admin only)
 * Validates status values
 */
router.patch('/:id/status', verifyToken, requireRole('admin', 'superadmin'), async (req, res) => {
  try {
    const { status } = req.body;

    // Validate status
    if (!['pending', 'processing', 'shipped', 'delivered', 'cancelled'].includes(status)) {
      return res.status(400).json({ error: 'Invalid status' });
    }

    // Update order
    const order = await Order.findByIdAndUpdate(
      req.params.id,
      { status, updated_at: Date.now() },
      { new: true }
    ).populate('user_id', 'full_name email');

    if (!order) return res.status(404).json({ error: 'Order not found' });

    // After status update, send invoice email if user email exists
    try {
      const pdfBuffer = await generateInvoicePDF(order);
      if (order.user_id && order.user_id.email) {
        await sendInvoiceEmail(order.user_id.email, order, pdfBuffer);
      }
    } catch (emailError) {
      console.error('Failed to send invoice email after status update:', emailError);
    }
    res.json(order);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * POST /api/orders/:id/refund
 * Process refund (Admin only)
 * Marks order as cancelled and refund as completed
 */
/**
 * POST /api/orders/:id/refund
 * Process refund (Admin only)
 * Marks order as cancelled and refund as completed
 */
router.post('/:id/refund', verifyToken, requireRole('admin', 'superadmin'), async (req, res) => {
  try {
    const { reason, amount } = req.body;
    const order = await Order.findById(req.params.id);

    if (!order) return res.status(404).json({ error: 'Order not found' });

    // Update refund details
    order.refund_status = 'completed';
    order.refund_amount = amount || order.total_amount;
    order.refund_reason = reason || 'Admin refund';
    order.status = 'cancelled';
    order.updated_at = Date.now();

    await order.save();
    // After refund, send invoice email if user email exists
    await order.populate('user_id', 'full_name email');
    try {
      const pdfBuffer = await generateInvoicePDF(order);
      if (order.user_id && order.user_id.email) {
        await sendInvoiceEmail(order.user_id.email, order, pdfBuffer);
      }
    } catch (emailError) {
      console.error('Failed to send invoice email after refund:', emailError);
    }

    broadcastAnalyticsUpdated('order_refunded');

    res.json(order);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * POST /api/orders/:id/cancel
 * Cancel order (Customer)
 * Only allows cancellation for pending/processing orders
 */
router.post('/:id/cancel', verifyToken, async (req, res) => {
  try {
    const order = await Order.findById(req.params.id);

    if (!order) return res.status(404).json({ error: 'Order not found' });

    // Verify ownership
    if (order.user_id.toString() !== req.user.userId) {
      return res.status(403).json({ error: 'Unauthorized' });
    }

    // Check if order can be cancelled
    if (['shipped', 'delivered'].includes(order.status)) {
      return res.status(400).json({ error: 'Cannot cancel shipped or delivered orders' });
    }

    // Cancel order
    order.status = 'cancelled';
    order.updated_at = Date.now();
    await order.save();

    // After cancellation, send invoice email if user email exists
    await order.populate('user_id', 'full_name email');
    try {
      const pdfBuffer = await generateInvoicePDF(order);
      if (order.user_id && order.user_id.email) {
        await sendInvoiceEmail(order.user_id.email, order, pdfBuffer);
      }
    } catch (emailError) {
      console.error('Failed to send invoice email after cancellation:', emailError);
    }

    broadcastAnalyticsUpdated('order_cancelled');

    res.json(order);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * POST /api/orders/:id/request-refund
 * Request refund (Customer)
 * Only allows refund requests within 30 days of delivery
 */
router.post('/:id/request-refund', verifyToken, async (req, res) => {
  try {
    const { reason } = req.body;
    const order = await Order.findById(req.params.id);

    if (!order) return res.status(404).json({ error: 'Order not found' });

    // Verify ownership
    if (order.user_id.toString() !== req.user.userId) {
      return res.status(403).json({ error: 'Unauthorized' });
    }

    // Check if order is delivered
    if (order.status !== 'delivered') {
      return res.status(400).json({ error: 'Only delivered orders can be refunded' });
    }

    // Check 30-day refund window
    const orderDate = new Date(order.updated_at || order.created_at);
    const daysSinceOrder = Math.floor((Date.now() - orderDate.getTime()) / (1000 * 60 * 60 * 24));

    if (daysSinceOrder > 30) {
      return res.status(400).json({ error: 'Refund window expired. Refunds are only available within 30 days of delivery.' });
    }

    // Check if refund already requested
    if (order.refund_status !== 'none') {
      return res.status(400).json({ error: 'Refund already requested for this order' });
    }

    // Request refund
    order.refund_status = 'requested';
    order.refund_reason = reason || 'Customer refund request';
    order.updated_at = Date.now();
    await order.save();

    res.json(order);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * PUT /api/orders/:id
 * Update entire order (Admin only)
 */
router.put('/:id', verifyToken, requireRole('admin', 'superadmin'), async (req, res) => {
  try {
    const order = await Order.findByIdAndUpdate(req.params.id, req.body, { new: true });
    res.json(order);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * DELETE /api/orders/:id
 * Delete order (Admin only)
 */
router.delete('/:id', verifyToken, requireRole('admin', 'superadmin'), async (req, res) => {
  try {
    const order = await Order.findByIdAndDelete(req.params.id);
    res.json(order);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
