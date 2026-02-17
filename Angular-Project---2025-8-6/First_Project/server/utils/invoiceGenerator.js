const PDFDocument = require('pdfkit');
const nodemailer = require('nodemailer');

/**
 * Generate invoice PDF buffer from order data
 * @param {Object} order - Order object with items, customer, and payment details
 * @returns {Promise<Buffer>} PDF buffer
 */
async function generateInvoicePDF(order) {
  return new Promise((resolve, reject) => {
    try {
      // Create PDF document
      const doc = new PDFDocument({ margin: 50 });
      const chunks = [];

      // Collect PDF data chunks
      doc.on('data', chunk => chunks.push(chunk));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', reject);

      // Header
      doc.fontSize(24).text('INVOICE', { align: 'center' });
      doc.moveDown();

      // Order details
      doc.fontSize(12);
      doc.text(`Order ID: ${order._id}`, { continued: false });
      doc.text(`Date: ${new Date(order.created_at).toLocaleDateString()}`);
      doc.text(`Status: ${order.status}`);
      doc.moveDown();

      // Customer info
      const customerName = typeof order.user_id === 'object' ? order.user_id.full_name : 'Customer';
      const customerEmail = typeof order.user_id === 'object' ? order.user_id.email : '';
      doc.text(`Customer: ${customerName}`);
      if (customerEmail) doc.text(`Email: ${customerEmail}`);
      doc.moveDown();

      // Shipping address
      if (order.shipping_address) {
        doc.text('Shipping Address:');
        const addr = order.shipping_address;
        doc.text(`${addr.line1 || ''} ${addr.line2 || ''}`);
        doc.text(`${addr.city || ''}, ${addr.state || ''} ${addr.postalCode || ''}`);
        doc.text(`${addr.country || ''}`);
        doc.moveDown();
      }

      // Items table header
      const tableTop = doc.y;
      doc.text('Item', 50, tableTop);
      doc.text('Qty', 250, tableTop);
      doc.text('Price', 320, tableTop);
      doc.text('Total', 420, tableTop);
      doc.moveTo(50, tableTop + 15).lineTo(550, tableTop + 15).stroke();
      doc.moveDown();

      // Items
      let yPos = doc.y;
      (order.items || []).forEach(item => {
        doc.text(item.name || 'Product', 50, yPos);
        doc.text(item.quantity.toString(), 250, yPos);
        doc.text(`$${item.price.toFixed(2)}`, 320, yPos);
        doc.text(`$${(item.quantity * item.price).toFixed(2)}`, 420, yPos);
        yPos += 25;
      });

      // Total
      doc.moveTo(50, yPos).lineTo(550, yPos).stroke();
      yPos += 20;
      doc.fontSize(14).text(`Total: $${order.total_amount.toFixed(2)}`, 420, yPos);

      // Footer
      doc.fontSize(10).text('Thank you for your order!', 50, doc.page.height - 100, { align: 'center' });

      doc.end();
    } catch (error) {
      reject(error);
    }
  });
}

/**
 * Send invoice email with PDF attachment
 * @param {string} recipientEmail - Customer email address
 * @param {Object} order - Order object
 * @param {Buffer} pdfBuffer - Invoice PDF buffer
 * @returns {Promise<void>}
 */
async function sendInvoiceEmail(recipientEmail, order, pdfBuffer) {
  // Create email transporter
  const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST || 'smtp.gmail.com',
    port: process.env.SMTP_PORT || 587,
    secure: false,
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS
    }
  });

  // Email content
  const mailOptions = {
    from: process.env.SMTP_FROM || process.env.SMTP_USER,
    to: recipientEmail,
    subject: `Order Confirmation - Order #${order._id.toString().slice(-8)}`,
    html: `
      <h2>Order Confirmed!</h2>
      <p>Thank you for your order. Your order has been successfully placed.</p>
      <p><strong>Order ID:</strong> ${order._id}</p>
      <p><strong>Total Amount:</strong> $${order.total_amount.toFixed(2)}</p>
      <p><strong>Status:</strong> ${order.status}</p>
      <p>Please find your invoice attached.</p>
      <br>
      <p>Thank you for shopping with us!</p>
    `,
    attachments: [
      {
        filename: `invoice-${order._id}.pdf`,
        content: pdfBuffer,
        contentType: 'application/pdf'
      }
    ]
  };

  // Send email
  await transporter.sendMail(mailOptions);
}

module.exports = { generateInvoicePDF, sendInvoiceEmail };
