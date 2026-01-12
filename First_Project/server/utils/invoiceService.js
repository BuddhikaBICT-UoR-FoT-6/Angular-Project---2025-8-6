const PDFDocument = require('pdfkit');
const nodemailer = require('nodemailer');

function generateInvoicePdfBuffer(order, user) {
  return new Promise((resolve, reject) => {
    try {
      const doc = new PDFDocument({ size: 'A4', margin: 50 });
      const buffers = [];
      doc.on('data', (chunk) => buffers.push(chunk));
      doc.on('end', () => resolve(Buffer.concat(buffers)));

      // Header
      doc.fontSize(20).text('Invoice', { align: 'left' });
      doc.moveDown();

      doc.fontSize(12).text(`Order ID: ${order._id}`);
      const createdAt = new Date(order.created_at || order.createdAt || Date.now()).toLocaleString();
      doc.text(`Date: ${createdAt}`);
      doc.moveDown();

      // Customer
      doc.fontSize(14).text('Customer', { underline: true });
      doc.fontSize(12).text(user?.full_name || user?.name || 'Customer');
      if (user?.email) doc.text(user.email);
      doc.moveDown();

      // Shipping
      doc.fontSize(14).text('Shipping Address', { underline: true });
      const sa = order.shipping_address || {};
      if (sa.fullName) doc.text(sa.fullName);
      if (sa.line1) doc.text(sa.line1);
      const cityLine = [sa.city, sa.state, sa.postalCode].filter(Boolean).join(', ');
      if (cityLine) doc.text(cityLine);
      if (sa.country) doc.text(sa.country);
      doc.moveDown();

      // Table header
      doc.fontSize(14).text('Items', { underline: true });
      doc.moveDown(0.5);

      const tableTop = doc.y;
      const itemX = 50;
      const qtyX = 320;
      const unitX = 380;
      const totalX = 460;

      doc.fontSize(10).text('Product', itemX, tableTop);
      doc.text('Qty', qtyX, tableTop);
      doc.text('Unit', unitX, tableTop);
      doc.text('Total', totalX, tableTop);
      doc.moveDown();

      (order.items || []).forEach((it) => {
        const y = doc.y;
        doc.text(`${it.name} (${it.size})`, itemX, y, { width: 260 });
        doc.text(String(it.quantity || 0), qtyX, y);
        doc.text(`$${(it.price || 0).toFixed(2)}`, unitX, y);
        doc.text(`$${(((it.price || 0) * (it.quantity || 0)) || 0).toFixed(2)}`, totalX, y);
        doc.moveDown();
      });

      doc.moveDown();
      doc.fontSize(12).text(`Subtotal: $${(((order.total_amount || 0) + (order.discount_amount || 0)) - (order.discount_amount || 0)).toFixed(2)}`, { align: 'right' });
      doc.text(`Discount: $${(order.discount_amount || 0).toFixed(2)}`, { align: 'right' });
      doc.moveDown(0.5);
      doc.fontSize(14).text(`Total: $${(order.total_amount || 0).toFixed(2)}`, { align: 'right' });

      doc.end();
    } catch (err) {
      reject(err);
    }
  });
}

async function sendInvoiceEmailPDF({ to, subject, pdfBuffer, filename }) {
  const emailUser = process.env.EMAIL_USER || '';
  const emailPass = (process.env.EMAIL_PASSWORD || '').replace(/\s+/g, '');
  const emailService = process.env.EMAIL_SERVICE || '';

  const isConfigured = !!(emailUser && emailPass && emailService);
  if (!isConfigured) {
    console.log('📧 [DEV] Invoice email not sent. To:', to, 'Subject:', subject);
    return { success: true, devMode: true };
  }

  const transporter = nodemailer.createTransport({
    service: emailService,
    auth: { user: emailUser, pass: emailPass }
  });

  const mailOptions = {
    from: emailUser,
    to,
    subject,
    text: 'Thank you for your order. Please find the attached invoice.',
    attachments: [
      { filename: filename || 'invoice.pdf', content: pdfBuffer, contentType: 'application/pdf' }
    ]
  };

  const info = await transporter.sendMail(mailOptions);
  return { success: true, messageId: info.messageId };
}

module.exports = { generateInvoicePdfBuffer, sendInvoiceEmailPDF };
