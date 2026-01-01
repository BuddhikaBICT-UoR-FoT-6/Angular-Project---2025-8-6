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

module.exports = {
  generateOTP,
  sendRegistrationOTP,
  sendPasswordResetOTP,
  sendAccountActionOTP
};
