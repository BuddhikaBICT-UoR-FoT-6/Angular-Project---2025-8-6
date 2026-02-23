const nodemailer = require('nodemailer');

// Check if email is configured
const normalizedEmailPassword = (process.env.EMAIL_PASSWORD || '').replace(/\s+/g, '');
const isEmailConfigured = !!(process.env.EMAIL_SERVICE && process.env.EMAIL_USER && normalizedEmailPassword);

// Create reusable transporter
const createTransporter = () => {
  if (isEmailConfigured) {
    // Production email configuration
    console.log('📧 Email service configured:', process.env.EMAIL_SERVICE);
    return nodemailer.createTransport({
      service: process.env.EMAIL_SERVICE, // e.g., 'gmail', 'outlook'
      auth: {
        user: process.env.EMAIL_USER,
        pass: normalizedEmailPassword
      }
    });
  } else {
    // Development mode - log email to console instead
    console.log('📧 Email service: DEVELOPMENT MODE (console logging only)');
    return null; // No transporter in dev mode
  }
};

const transporter = createTransporter();

/**
 * Generate a random 6-digit OTP
 */
const generateOTP = () => {
  return Math.floor(100000 + Math.random() * 900000).toString();
};

/**
 * Send OTP email for registration verification
 */
const sendRegistrationOTP = async (email, otp, fullName) => {
  // Development mode - just log to console
  if (!isEmailConfigured) {
    console.log('\n📧 ═══════════════════════════════════════════════════');
    console.log('📧 REGISTRATION OTP EMAIL (Development Mode)');
    console.log('📧 ═══════════════════════════════════════════════════');
    console.log('📧 To:', email);
    console.log('📧 Name:', fullName);
    console.log('📧 OTP Code:', otp);
    console.log('📧 Subject: Verify Your Email - Clothing Store');
    console.log('📧 ═══════════════════════════════════════════════════\n');
    return Promise.resolve({ success: true, messageId: 'dev-mode-' + Date.now() });
  }

  const mailOptions = {
    from: process.env.EMAIL_USER || 'noreply@clothingstore.com',
    to: email,
    subject: 'Verify Your Email - Clothing Store',
    html: `
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
          .content { background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px; }
          .otp-box { background: white; border: 2px dashed #667eea; padding: 20px; text-align: center; margin: 20px 0; border-radius: 8px; }
          .otp-code { font-size: 32px; font-weight: bold; color: #667eea; letter-spacing: 8px; }
          .footer { text-align: center; margin-top: 20px; color: #666; font-size: 12px; }
          .warning { color: #e74c3c; font-weight: bold; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>👕 Welcome to Clothing Store!</h1>
          </div>
          <div class="content">
            <p>Hi ${fullName || 'there'},</p>
            <p>Thank you for registering with us! To complete your registration, please verify your email address using the OTP below:</p>
            
            <div class="otp-box">
              <p style="margin: 0; color: #666;">Your Verification Code</p>
              <div class="otp-code">${otp}</div>
            </div>
            
            <p><strong>This code will expire in 10 minutes.</strong></p>
            <p>If you didn't request this verification, please ignore this email.</p>
            
            <p class="warning">⚠️ Never share this code with anyone. Our team will never ask for your OTP.</p>
          </div>
          <div class="footer">
            <p>© 2026 Clothing Store. All rights reserved.</p>
          </div>
        </div>
      </body>
      </html>
    `
  };

  try {
    const info = await transporter.sendMail(mailOptions);
    console.log('✅ Registration OTP email sent:', info.messageId);
    return { success: true, messageId: info.messageId };
  } catch (error) {
    console.error('❌ Error sending registration OTP email:', error);
    throw error;
  }
};

/**
 * Send OTP email for password reset
 */
const sendPasswordResetOTP = async (email, otp, fullName) => {
  // Development mode - just log to console
  if (!isEmailConfigured) {
    console.log('\n📧 ═══════════════════════════════════════════════════');
    console.log('📧 PASSWORD RESET OTP EMAIL (Development Mode)');
    console.log('📧 ═══════════════════════════════════════════════════');
    console.log('📧 To:', email);
    console.log('📧 Name:', fullName);
    console.log('📧 OTP Code:', otp);
    console.log('📧 Subject: Reset Your Password - Clothing Store');
    console.log('📧 ═══════════════════════════════════════════════════\n');
    return Promise.resolve({ success: true, messageId: 'dev-mode-' + Date.now() });
  }

  const mailOptions = {
    from: process.env.EMAIL_USER || 'noreply@clothingstore.com',
    to: email,
    subject: 'Reset Your Password - Clothing Store',
    html: `
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: linear-gradient(135deg, #f093fb 0%, #f5576c 100%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
          .content { background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px; }
          .otp-box { background: white; border: 2px dashed #f5576c; padding: 20px; text-align: center; margin: 20px 0; border-radius: 8px; }
          .otp-code { font-size: 32px; font-weight: bold; color: #f5576c; letter-spacing: 8px; }
          .footer { text-align: center; margin-top: 20px; color: #666; font-size: 12px; }
          .warning { color: #e74c3c; font-weight: bold; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>🔐 Password Reset Request</h1>
          </div>
          <div class="content">
            <p>Hi ${fullName || 'there'},</p>
            <p>We received a request to reset your password. Use the OTP below to proceed with resetting your password:</p>
            
            <div class="otp-box">
              <p style="margin: 0; color: #666;">Your Verification Code</p>
              <div class="otp-code">${otp}</div>
            </div>
            
            <p><strong>This code will expire in 10 minutes.</strong></p>
            <p>If you didn't request a password reset, please ignore this email and your password will remain unchanged.</p>
            
            <p class="warning">⚠️ Never share this code with anyone. Our team will never ask for your OTP.</p>
          </div>
          <div class="footer">
            <p>© 2026 Clothing Store. All rights reserved.</p>
          </div>
        </div>
      </body>
      </html>
    `
  };

  try {
    const info = await transporter.sendMail(mailOptions);
    console.log('✅ Password reset OTP email sent:', info.messageId);
    return { success: true, messageId: info.messageId };
  } catch (error) {
    console.error('❌ Error sending password reset OTP email:', error);
    throw error;
  }
};

/**
 * Send OTP email for account deactivation/deletion
 */
const sendAccountActionOTP = async (email, otp, fullName, action) => {
  const actionText = action === 'deactivation' ? 'Deactivate' : 'Delete';
  const actionColor = action === 'deactivation' ? '#ff9800' : '#e74c3c';

  // Development mode - just log to console
  if (!isEmailConfigured) {
    console.log('\n📧 ═══════════════════════════════════════════════════');
    console.log(`📧 ACCOUNT ${actionText.toUpperCase()} OTP EMAIL (Development Mode)`);
    console.log('📧 ═══════════════════════════════════════════════════');
    console.log('📧 To:', email);
    console.log('📧 Name:', fullName);
    console.log('📧 OTP Code:', otp);
    console.log('📧 Action:', actionText);
    console.log(`📧 Subject: ${actionText} Your Account - Clothing Store`);
    console.log('📧 ═══════════════════════════════════════════════════\n');
    return Promise.resolve({ success: true, messageId: 'dev-mode-' + Date.now() });
  }

  const mailOptions = {
    from: process.env.EMAIL_USER || 'noreply@clothingstore.com',
    to: email,
    subject: `${actionText} Your Account - Clothing Store`,
    html: `
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: ${actionColor}; color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
          .content { background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px; }
          .otp-box { background: white; border: 2px dashed ${actionColor}; padding: 20px; text-align: center; margin: 20px 0; border-radius: 8px; }
          .otp-code { font-size: 32px; font-weight: bold; color: ${actionColor}; letter-spacing: 8px; }
          .footer { text-align: center; margin-top: 20px; color: #666; font-size: 12px; }
          .warning { color: #e74c3c; font-weight: bold; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>⚠️ Account ${actionText} Request</h1>
          </div>
          <div class="content">
            <p>Hi ${fullName || 'there'},</p>
            <p>We received a request to ${action === 'deactivation' ? 'temporarily deactivate' : 'permanently delete'} your account. Use the OTP below to confirm this action:</p>
            
            <div class="otp-box">
              <p style="margin: 0; color: #666;">Your Verification Code</p>
              <div class="otp-code">${otp}</div>
            </div>
            
            <p><strong>This code will expire in 10 minutes.</strong></p>
            
            ${action === 'deactivation'
        ? '<p class="warning">📅 Note: Your account will be automatically deleted after 30 days of deactivation.</p>'
        : '<p class="warning">⚠️ WARNING: This action is irreversible. All your data will be permanently deleted.</p>'
      }
            
            <p>If you didn't request this action, please contact our support team immediately.</p>
            
            <p class="warning">⚠️ Never share this code with anyone.</p>
          </div>
          <div class="footer">
            <p>© 2026 Clothing Store. All rights reserved.</p>
          </div>
        </div>
      </body>
      </html>
    `
  };

  try {
    const info = await transporter.sendMail(mailOptions);
    console.log(`✅ Account ${action} OTP email sent:`, info.messageId);
    return { success: true, messageId: info.messageId };
  } catch (error) {
    console.error(`❌ Error sending account ${action} OTP email:`, error);
    throw error;
  }
};

/**
 * Send a restock notification email to the supplier.
 *
 * In development mode (when email isn't configured), this logs the email payload
 * to the console instead of sending.
 */
const sendRestockNotificationEmail = async ({
  to,
  supplierName,
  productName,
  addedBySize,
  newStockBySize,
  timestamp
}) => {
  if (!to) {
    return { success: false, messageId: null, skipped: true, reason: 'missing-recipient' };
  }

  const when = timestamp ? new Date(timestamp).toISOString() : new Date().toISOString();

  // Development mode - just log to console
  if (!isEmailConfigured || !transporter) {
    console.log('\n📦 ═══════════════════════════════════════════════════');
    console.log('📦 RESTOCK NOTIFICATION (Development Mode)');
    console.log('📦 ═══════════════════════════════════════════════════');
    console.log('📦 To:', to);
    console.log('📦 Supplier:', supplierName || '-');
    console.log('📦 Product:', productName || '-');
    console.log('📦 Added:', addedBySize);
    console.log('📦 New Stock:', newStockBySize);
    console.log('📦 When:', when);
    console.log('📦 Subject: Restock Notification - Clothing Store');
    console.log('📦 ═══════════════════════════════════════════════════\n');
    return { success: true, messageId: 'dev-mode-' + Date.now(), skipped: true };
  }

  const safeSupplier = supplierName || 'Supplier';
  const safeProduct = productName || 'Product';
  const add = addedBySize || { S: 0, M: 0, L: 0, XL: 0 };
  const after = newStockBySize || { S: 0, M: 0, L: 0, XL: 0 };

  const mailOptions = {
    from: process.env.EMAIL_USER || 'noreply@clothingstore.com',
    to,
    subject: `Restock Notification - ${safeProduct}`,
    html: `
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 640px; margin: 0 auto; padding: 20px; }
          .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 22px; border-radius: 10px 10px 0 0; }
          .content { background: #f9f9f9; padding: 22px; border-radius: 0 0 10px 10px; }
          table { width: 100%; border-collapse: collapse; margin: 12px 0; }
          th, td { text-align: left; padding: 10px; border-bottom: 1px solid #e6e6e6; }
          th { background: #ffffff; }
          .muted { color: #666; font-size: 12px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h2 style="margin:0">📦 Restock Notification</h2>
          </div>
          <div class="content">
            <p>Hi ${safeSupplier},</p>
            <p>We have restocked <strong>${safeProduct}</strong>.</p>

            <h3 style="margin-bottom:6px">Added quantities</h3>
            <table>
              <tr><th>Size</th><th>Added</th></tr>
              <tr><td>S</td><td>${add.S ?? 0}</td></tr>
              <tr><td>M</td><td>${add.M ?? 0}</td></tr>
              <tr><td>L</td><td>${add.L ?? 0}</td></tr>
              <tr><td>XL</td><td>${add.XL ?? 0}</td></tr>
            </table>

            <h3 style="margin-bottom:6px">New stock levels</h3>
            <table>
              <tr><th>Size</th><th>In Stock</th></tr>
              <tr><td>S</td><td>${after.S ?? 0}</td></tr>
              <tr><td>M</td><td>${after.M ?? 0}</td></tr>
              <tr><td>L</td><td>${after.L ?? 0}</td></tr>
              <tr><td>XL</td><td>${after.XL ?? 0}</td></tr>
            </table>

            <p class="muted">Timestamp: ${when}</p>
          </div>
        </div>
      </body>
      </html>
    `
  };

  try {
    const info = await transporter.sendMail(mailOptions);
    console.log('✅ Restock notification email sent:', info.messageId);
    return { success: true, messageId: info.messageId };
  } catch (error) {
    console.error('❌ Error sending restock notification email:', error);
    throw error;
  }
};

/**
 * Send a restock request email to the supplier.
 *
 * This is different from a "restock notification": this email asks the supplier to fulfill stock,
 * and includes a one-time code that expires in 7 days.
 */
const sendRestockRequestEmail = async ({
  to,
  supplierName,
  productName,
  requestedBySize,
  requestCode,
  expiresAt,
  note
}) => {
  if (!to) {
    return { success: false, messageId: null, skipped: true, reason: 'missing-recipient' };
  }

  const safeSupplier = supplierName || 'Supplier';
  const safeProduct = productName || 'Product';
  const reqSizes = requestedBySize || { S: 0, M: 0, L: 0, XL: 0 };
  const exp = expiresAt ? new Date(expiresAt) : new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
  const expIso = exp.toISOString();
  const code = (requestCode || '').toString().trim().toUpperCase();

  // Development mode - just log to console
  if (!isEmailConfigured || !transporter) {
    console.log('\n📦 ═══════════════════════════════════════════════════');
    console.log('📦 RESTOCK REQUEST (Development Mode)');
    console.log('📦 ═══════════════════════════════════════════════════');
    console.log('📦 To:', to);
    console.log('📦 Supplier:', safeSupplier);
    console.log('📦 Product:', safeProduct);
    console.log('📦 Requested:', reqSizes);
    console.log('📦 Code:', code);
    console.log('📦 Expires:', expIso);
    if (note) console.log('📦 Note:', note);
    console.log('📦 Subject: Stock Needed - Clothing Store');
    console.log('📦 ═══════════════════════════════════════════════════\n');
    return { success: true, messageId: 'dev-mode-' + Date.now(), skipped: true };
  }

  const mailOptions = {
    from: process.env.EMAIL_USER || 'noreply@clothingstore.com',
    to,
    subject: `Stock Needed - ${safeProduct}`,
    html: `
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 640px; margin: 0 auto; padding: 20px; }
          .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 22px; border-radius: 10px 10px 0 0; }
          .content { background: #f9f9f9; padding: 22px; border-radius: 0 0 10px 10px; }
          table { width: 100%; border-collapse: collapse; margin: 12px 0; }
          th, td { text-align: left; padding: 10px; border-bottom: 1px solid #e6e6e6; }
          th { background: #ffffff; }
          .code { font-size: 22px; font-weight: bold; letter-spacing: 2px; background: #fff; border: 1px dashed #667eea; padding: 12px; border-radius: 8px; display: inline-block; }
          .muted { color: #666; font-size: 12px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h2 style="margin:0">📦 Stock Needed</h2>
          </div>
          <div class="content">
            <p>Hi ${safeSupplier},</p>
            <p>We need a restock for <strong>${safeProduct}</strong>. Please fulfill this request within 7 days.</p>

            <h3 style="margin-bottom:6px">Requested quantities</h3>
            <table>
              <tr><th>Size</th><th>Quantity</th></tr>
              <tr><td>S</td><td>${reqSizes.S ?? 0}</td></tr>
              <tr><td>M</td><td>${reqSizes.M ?? 0}</td></tr>
              <tr><td>L</td><td>${reqSizes.L ?? 0}</td></tr>
              <tr><td>XL</td><td>${reqSizes.XL ?? 0}</td></tr>
            </table>

            ${note ? `<p><strong>Note:</strong> ${String(note)}</p>` : ''}

            <p><strong>Fulfillment code:</strong></p>
            <div class="code">${code}</div>
            <p class="muted">Code expires: ${expIso}</p>
          </div>
        </div>
      </body>
      </html>
    `
  };

  try {
    const info = await transporter.sendMail(mailOptions);
    console.log('✅ Restock request email sent:', info.messageId);
    return { success: true, messageId: info.messageId };
  } catch (error) {
    console.error('❌ Error sending restock request email:', error);
    throw error;
  }
};

/**
 * Send a cancellation email to the supplier when an admin cancels a pending restock request.
 *
 * Note: We cannot include the original code because we never store it in plaintext.
 * Instead, we include the request id + product + quantities + timestamps.
 */
const sendRestockCancellationEmail = async ({
  to,
  supplierName,
  productName,
  requestedBySize,
  requestCode,
  requestCodeHint,
  requestId,
  createdAt,
  expiresAt,
  cancelledAt,
  cancellationReason,
  note
}) => {
  if (!to) {
    return { success: false, messageId: null, skipped: true, reason: 'missing-recipient' };
  }

  const safeSupplier = supplierName || 'Supplier';
  const safeProduct = productName || 'Product';
  const reqSizes = requestedBySize || { S: 0, M: 0, L: 0, XL: 0 };

  const createdIso = createdAt ? new Date(createdAt).toISOString() : '';
  const expiresIso = expiresAt ? new Date(expiresAt).toISOString() : '';
  const cancelledIso = cancelledAt ? new Date(cancelledAt).toISOString() : new Date().toISOString();
  const safeReason = (cancellationReason || '').toString().trim();
  const safeNote = (note || '').toString().trim();
  const safeRequestId = (requestId || '').toString().trim();
  const safeRequestCode = (requestCode || '').toString().trim().toUpperCase();
  const safeRequestCodeHint = (requestCodeHint || '').toString().trim().toUpperCase();

  // Development mode - just log to console
  if (!isEmailConfigured || !transporter) {
    console.log('\n📦 ═══════════════════════════════════════════════════');
    console.log('📦 RESTOCK REQUEST CANCELLED (Development Mode)');
    console.log('📦 ═══════════════════════════════════════════════════');
    console.log('📦 To:', to);
    console.log('📦 Supplier:', safeSupplier);
    console.log('📦 Product:', safeProduct);
    if (safeRequestCode) console.log('📦 Batch Code:', safeRequestCode);
    else if (safeRequestCodeHint) console.log('📦 Batch Code Hint:', safeRequestCodeHint);
    console.log('📦 Request ID:', safeRequestId);
    console.log('📦 Requested:', reqSizes);
    if (createdIso) console.log('📦 Created:', createdIso);
    if (expiresIso) console.log('📦 Expires:', expiresIso);
    console.log('📦 Cancelled:', cancelledIso);
    if (safeReason) console.log('📦 Reason:', safeReason);
    if (safeNote) console.log('📦 Note:', safeNote);
    console.log('📦 Subject: Restock Request Cancelled - Clothing Store');
    console.log('📦 ═══════════════════════════════════════════════════\n');
    return { success: true, messageId: 'dev-mode-' + Date.now(), skipped: true };
  }

  const mailOptions = {
    from: process.env.EMAIL_USER || 'noreply@clothingstore.com',
    to,
    subject: `Restock Request Cancelled - ${safeProduct}`,
    html: `
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 640px; margin: 0 auto; padding: 20px; }
          .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 22px; border-radius: 10px 10px 0 0; }
          .content { background: #f9f9f9; padding: 22px; border-radius: 0 0 10px 10px; }
          table { width: 100%; border-collapse: collapse; margin: 12px 0; }
          th, td { text-align: left; padding: 10px; border-bottom: 1px solid #e6e6e6; }
          th { background: #ffffff; }
          .muted { color: #666; font-size: 12px; }
          .badge { display: inline-block; padding: 4px 8px; border-radius: 999px; background: #fff; border: 1px solid #e6e6e6; font-size: 12px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h2 style="margin:0">📦 Restock Request Cancelled</h2>
          </div>
          <div class="content">
            <p>Hi ${safeSupplier},</p>
            <p>We’re sorry — the following restock request has been cancelled. Please do not prepare or ship this batch.</p>

            <p><span class="badge">Product: <strong>${safeProduct}</strong></span></p>

            <h3 style="margin-bottom:6px">Cancelled batch details</h3>
            <table>
              <tr><th>Field</th><th>Value</th></tr>
              ${safeRequestCode ? `<tr><td>Batch code</td><td><strong>${safeRequestCode}</strong></td></tr>` : ''}
              ${!safeRequestCode && safeRequestCodeHint ? `<tr><td>Batch code hint</td><td><strong>${safeRequestCodeHint}</strong></td></tr>` : ''}
              <tr><td>Request ID</td><td>${safeRequestId || '-'}</td></tr>
              <tr><td>Cancelled at</td><td>${cancelledIso}</td></tr>
              ${createdIso ? `<tr><td>Created at</td><td>${createdIso}</td></tr>` : ''}
              ${expiresIso ? `<tr><td>Original expiry</td><td>${expiresIso}</td></tr>` : ''}
            </table>

            <h3 style="margin-bottom:6px">Requested quantities</h3>
            <table>
              <tr><th>Size</th><th>Quantity</th></tr>
              <tr><td>S</td><td>${reqSizes.S ?? 0}</td></tr>
              <tr><td>M</td><td>${reqSizes.M ?? 0}</td></tr>
              <tr><td>L</td><td>${reqSizes.L ?? 0}</td></tr>
              <tr><td>XL</td><td>${reqSizes.XL ?? 0}</td></tr>
            </table>

            ${safeReason ? `<p><strong>Cancellation reason:</strong> ${safeReason}</p>` : ''}
            ${safeNote ? `<p><strong>Original note:</strong> ${safeNote}</p>` : ''}

            <p class="muted">If you have already started processing, please contact us so we can coordinate next steps. The batch code above (if shown) should be considered invalid.</p>
          </div>
        </div>
      </body>
      </html>
    `
  };

  try {
    const info = await transporter.sendMail(mailOptions);
    console.log('✅ Restock cancellation email sent:', info.messageId);
    return { success: true, messageId: info.messageId };
  } catch (error) {
    console.error('❌ Error sending restock cancellation email:', error);
    throw error;
  }
};

/**
 * Send OTP email for checkout verification
 */
const sendCheckoutOTP = async (email, otp, fullName) => {
  // Development mode - just log to console
  if (!isEmailConfigured) {
    console.log('\n📧 ═══════════════════════════════════════════════════');
    console.log('📧 CHECKOUT OTP EMAIL (Development Mode)');
    console.log('📧 ═══════════════════════════════════════════════════');
    console.log('📧 To:', email);
    console.log('📧 Name:', fullName);
    console.log('📧 OTP Code:', otp);
    console.log('📧 Subject: Verify Your Checkout - Clothing Store');
    console.log('📧 ═══════════════════════════════════════════════════\n');
    return Promise.resolve({ success: true, messageId: 'dev-mode-' + Date.now() });
  }

  const mailOptions = {
    from: process.env.EMAIL_USER || 'noreply@clothingstore.com',
    to: email,
    subject: 'Verify Your Checkout - Clothing Store',
    html: `
      <!DOCTYPE html>
      <html>
      <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
        <div style="max-width: 600px; margin: 0 auto; padding: 20px;">
          <h2>Checkout Verification</h2>
          <p>Hi ${fullName || 'there'},</p>
          <p>Use the OTP below to verify your checkout:</p>
          <div style="font-size: 28px; font-weight: bold; letter-spacing: 6px; margin: 18px 0;">${otp}</div>
          <p><strong>This code expires in 10 minutes.</strong></p>
          <p style="color:#b00;"><strong>Never share this code with anyone.</strong></p>
        </div>
      </body>
      </html>
    `
  };

  const info = await transporter.sendMail(mailOptions);
  console.log('✅ Checkout OTP email sent:', info.messageId);
  return { success: true, messageId: info.messageId };
};

module.exports = {
  generateOTP,
  sendRegistrationOTP,
  sendPasswordResetOTP,
  sendCheckoutOTP,
  sendAccountActionOTP,
  sendRestockNotificationEmail,
  sendRestockRequestEmail,
  sendRestockCancellationEmail
};
