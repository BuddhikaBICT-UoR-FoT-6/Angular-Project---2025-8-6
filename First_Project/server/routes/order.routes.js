// Order routes: list orders, update status, invoice download, create, refund, update, delete.
// Includes inline helpers to generate invoice HTML and to send invoice emails (development-friendly).
const express = require('express');
const router = express.Router();
const nodemailer = require('nodemailer');

const Order = require('../models/order');
const User = require('../models/user');


/**
 * Helper: build a simple invoice as HTML from order + user data.
 * Returns a string containing an HTML invoice.
 */
function buildInvoiceHtml(order, user){
  const itemsHtml = (order.items || [])
    .map((it) => `<tr>
      <td style="padding:6px;border-bottom:1px solid #eee">${it.name} (${it.size})</td>
      <td style="padding:6px;border-bottom:1px solid #eee">${it.quantity}</td>
      <td style="padding:6px;border-bottom:1px solid #eee">$${(it.price || 0).toFixed(2)}</td>
      <td style="padding:6px;border-bottom:1px solid #eee">$${((it.price||0) * (it.quantity||0)).toFixed(2)}</td>
    </tr>`)
    .join('');

    const createdAt = new Date(order.created_at || order.createdAt || Date.now()).toLocaleString();

    return `
      <!doctype html>
      <html>

        <head>
          <meta charset="utf-8">
          <title>Invoice ${order._id}</title>
        </head>

        <body style="font-family:Arial,Helvetica,sans-serif;color:#222;line-height:1.4;">
          <h2>Invoice — Order ${order._id}</h2>
          <p><strong>Date:</strong> ${createdAt}</p>
          <h3>Customer</h3>
            <p>
              ${user?.full_name || user?.name || 'Customer'}<br>
              ${user?.email || ''}<br>
            </p>
          
            <h3>Shipping Address</h3>
            <p>
              ${(order.shipping_address && (
                (order.shipping_address.fullName ? order.shipping_address.fullName + '<br/>' : '') +
                (order.shipping_address.line1 ? order.shipping_address.line1 + '<br/>' : '') +
                (order.shipping_address.city ? order.shipping_address.city + ', ' : '') +
                (order.shipping_address.state ? order.shipping_address.state + '<br/>' : '') +
                (order.shipping_address.country ? order.shipping_address.country + '<br/>' : '')
              )) || ''}
            </p>

            <h3>Items</h3>
            <table style="width:100%;border-collapse:collapse;">
              <thead>
                <tr>
                  <th style="text-align:left;padding:6px;border-bottom:2px solid #ddd">Product</th>
                  <th style="text-align:left;padding:6px;border-bottom:2px solid #ddd">Qty</th>
                  <th style="text-align:left;padding:6px;border-bottom:2px solid #ddd">Unit</th>
                  <th style="text-align:left;padding:6px;border-bottom:2px solid #ddd">Total</th>
                </tr>
              </thead>
              <tbody>
                ${itemsHtml}
              </tbody>
            </table>

            <h3>Summary</h3>
            <p>
              Subtotal: $${((order.total_amount || 0) - (order.discount_amount || 0)).toFixed(2)}<br>
              Discount: $${(order.discount_amount || 0).toFixed(2)}<br>
              <strong>Total: $${(order.total_amount || 0).toFixed(2)}</strong>
            </p>

            <hr/>
            <p style="font-size:12px;color:#666;">Thank you for shopping with us!</p>
        </body>
      </html>   
    `;
}

/**
 * Helper: send invoice email.
 * - Uses env EMAIL_SERVICE, EMAIL_USER, EMAIL_PASSWORD if configured.
 * - In development mode (missing config) logs the payload to console.
 */
async function sendInvoiceEmail({to, subject, htmlContent, attachmentName}){
  const emailUser = process.env.EMAIL_USER || '';
  const emailPass = (process.env.EMAIL_PASSWORD || '').replace(/\s+/g, '');
  const emailService = process.env.EMAIL_SERVICE || '';

  const isConfigured = !!(emailUser && emailPass && emailService);
  if(!isConfigured){
    console.log('📧 [DEV] Invoice email (not sent) — to:', to, 'subject:', subject);
    // Log short preview
    console.log(htmlContent.substring(0, 400));
    return { success: true, devMode: true };

  }
  
  const transporter = nodemailer.createTransport({
    service: emailService,
    auth: {user: emailUser, pass: emailPass}
  });

  const mailOptions = {
    from: emailUser,
    to,
    subject,
    html: `<p>Hi,</p><p>Thank you for your order. Please find your invoice attached.</p>${htmlContent}`,
    attachmentName: [
      {
        filename: attachmentName || `invoice-${Date.now()}.html`,
        content: htmlContent,
        contentType: 'text/html'
      }
    ]
  };

  const info = await transporter.sendMail(mailOptions);
  return {success: true, messageId: info.messageId};
}

/* -----------------------------
   ROUTES
   ----------------------------- */

/**
 * GET / - list orders, support optional ?status=...
 * - populates customer info for display
 */
router.get('/', async (req, res) => {
  try {
    const status = req.query.status;
    const filter = status ? { status } : {};
    const orders = await Order.find(filter).populate('user_id');
    res.json(orders);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * PATCH /:id/status
 * - update only the `status` field for an order
 */
router.patch('/:id/status', async (req, res) => {
  try{
    const {status} = req.body;
    const order = await Order.findByIdAndUpdate(
      req.params.id,
      { status },
      { new: true }

    );
    res.json(order);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }

});

/**
 * GET /:id/invoice
 * - returns a downloadable invoice (HTML) for the order
 * - the frontend can open this link in a new tab to download
 */
router.get('/:id/invoice', async (req, res) => {
  try{
    const order = await Order.findById(req.params.id).populate('user_id').lean();
    if(!order) return res.status(404).json({error: 'Order not found'});

    const user = order.user_id || {};
    const html = buildInvoiceHtml(order, user);

    res.setHeader('Content-Type', 'text/html; charset=UTF-8');
    res.setHeader('Content-Disposition', `attachement; filename="invoice-${order._id}.html"`);
    res.send(html);

  } catch (err) {
    res.status(500).json({ error: err.message });
  }

});

/**
 * POST /
 * - create a new order (admin/general)
 * - after saving, attempt to email the invoice to the user (if email present)
 */
router.post('/', async (req, res) => {
  try {
    // Save the new order
    const created = await new Order(req.body).save();

    // Try to email invoice to the order's user if available
    try{
      const fullOrder = await Order.findById(created._id).populate('user_id').lean();
      const user = fullOrder.user_id || {};
      const html = buildInvoiceHtml(fullOrder, user);

      if(user?.email){
        await sendInvoiceEmail({
          to: user.email,
          subject: `Invoice for Order ${fullOrder._id}`,
          htmlContent: html,
          attachmentName: `invoice-${fullOrder._id}.html`
        });

      } else {
        console.log('No user email found; skipping invoice email for order', fullOrder._id);
      }

    } catch(emailErr){
      console.error('Error while sending invoice email:', emailErr);
    }

    res.json(created);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * POST /:id/refund
 * - only allow refund if order is at least 30 days old
 * - updates order.status to 'refunded' when allowed
 */
router.post('/:id/refund', async (req, res) => {
  try {
    // Implement refund logic here (e.g., update order, call payment API)
    const order = await Order.findById(req.params.id).lean();
    if(!order) return res.status(404).json({ error: 'Order not found' });

    const createdTime = new Date(order.created_at || order.createdAt || Date.now()).getTime();
    const daysSince = Math.floor((Date.now() - createdTime) / (24 * 60 * 60 * 1000));

    if(daysSince < 30){
      return res.status(400).json({error: 'Refunds are only allowed for orders older than 30 days'});
    }

    // Implement actual refund logic here (payment provider call) if required.
    // For now, mark order as refunded in DB.
    const updated = await Order.findByIdAndUpdate(req.params.id, {status: 'refunded'}, {new: true});
    res.json({ message: 'Refund processed', order: updated });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * PUT /:id - update an order document
 */
router.put('/:id', async (req, res) => {
  try {
    res.json(await Order.findByIdAndUpdate(req.params.id, req.body, { new: true }));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * DELETE /:id - delete an order
 */
router.delete('/:id', async (req, res) => {
  try {
    res.json(await Order.findByIdAndDelete(req.params.id));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
