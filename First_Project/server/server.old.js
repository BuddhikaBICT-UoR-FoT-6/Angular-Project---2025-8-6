const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });

const multer = require('multer');
const { v2: cloudinary } = require('cloudinary');
const bcrypt = require('bcryptjs');

const { Parser } = require('json2csv');
const { parse } = require('csv-parse/sync');

// Import middleware and utilities
const { generateToken, verifyToken, requireRole, optionalAuth } = require('./middleware/auth');
const { compressImage, validateImage, createThumbnail } = require('./utils/imageProcessor');
const { generateOTP, sendRegistrationOTP, sendPasswordResetOTP, sendAccountActionOTP } = require('./utils/emailService');


// Import models
const User = require('./models/user');
const Product = require('./models/product');
const Order = require('./models/order');
const Inventory = require('./models/inventory');
const Financial = require('./models/financial');
const OTP = require('./models/otp');

const app = express();
app.use(express.json());
app.use(cors());

// --- Cloudinary setup (image hosting) ---
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET
});

// --- Multer: store uploads in memory (we upload buffer to Cloudinary) ---
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { 
    fileSize: 10 * 1024 * 1024, // 10MB per file
    files: 10 // Max 10 files per request
  },
  fileFilter: (req, file, cb) => {
    // Accept images only
    if (!file.mimetype.startsWith('image/')) {
      return cb(new Error('Only image files are allowed'), false);
    }
    cb(null, true);
  }
});

// Helper: upload a buffer to Cloudinary with compression
async function uploadBufferToCloudinary(buffer, folder, options = {}) {
  try {
    // Compress image before uploading
    const compressedBuffer = await compressImage(buffer, {
      maxWidth: options.maxWidth || 1200,
      maxHeight: options.maxHeight || 1200,
      quality: options.quality || 85,
      format: 'jpeg'
    });

    return new Promise((resolve, reject) => {
      const uploadStream = cloudinary.uploader.upload_stream(
        { 
          folder,
          resource_type: 'image',
          transformation: [
            { quality: 'auto:good' },
            { fetch_format: 'auto' }
          ]
        },
        (error, result) => {
          if (error) return reject(error);
          resolve(result);
        }
      );
      uploadStream.end(compressedBuffer);
    });
  } catch (err) {
    throw new Error('Image processing failed: ' + err.message);
  }
}


// Connect to MongoDB (replace with your connection string)
mongoose.connect(process.env.MONGO_URI)
  .then(() => console.log("✅ MongoDB Connected"))
  .catch(err => console.error("❌ MongoDB connection error:", err));

// Health endpoint used by the UI to know when Mongo is ready.
// Important: must be reachable even while Mongo is connecting.
app.get('/api/health', (req, res) => {
  const dbReady = mongoose.connection.readyState === 1;
  res.status(dbReady ? 200 : 503).json({ ok: true, dbReady });
});

// If MongoDB isn't ready yet, don't let API requests hang.
// Mongoose can buffer queries while connecting, which makes the UI look like it's loading forever.
app.use('/api', (req, res, next) => {
  if (req.path === '/health') return next();
  if (mongoose.connection.readyState !== 1) {
    return res.status(503).json({ error: 'Database is still connecting. Please retry.' });
  }
  next();
});


// test connection
app.get("/test-db", async (req, res) => {
  if (mongoose.connection.readyState !== 1) {
    return res.status(503).send('Database is still connecting.');
  }
  const count = await mongoose.connection.db.collection("users").countDocuments();
  res.send(`Users count: ${count}`);
});


// --- User Endpoints (Protected) ---
// Get all users - Admin only
app.get('/api/users', verifyToken, requireRole('admin', 'superadmin'), async (req, res) => {
  try {
    const users = await User.find().select('-password'); // Exclude password
    res.json(users);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get current user profile
app.get('/api/users/me', verifyToken, async (req, res) => {
  try {
    const user = await User.findById(req.user.userId).select('-password');
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    res.json(user);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Create user - Admin only
app.post('/api/users', verifyToken, requireRole('admin', 'superadmin'), async (req, res) => {
  try {
    // Hash password if provided
    if (req.body.password) {
      req.body.password = await bcrypt.hash(req.body.password, 10);
    }
    const user = await new User(req.body).save();
    const userResponse = user.toObject();
    delete userResponse.password;
    res.json(userResponse);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Update user - Admin or self
app.put('/api/users/:id', verifyToken, async (req, res) => {
  try {
    // Check if user is updating their own profile or is admin
    if (req.user.userId !== req.params.id && !['admin', 'superadmin'].includes(req.user.role)) {
      return res.status(403).json({ error: 'Insufficient permissions' });
    }

    // Hash password if being updated
    if (req.body.password) {
      req.body.password = await bcrypt.hash(req.body.password, 10);
    }

    const user = await User.findByIdAndUpdate(req.params.id, req.body, { new: true }).select('-password');
    res.json(user);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Delete user - Admin only
app.delete('/api/users/:id', verifyToken, requireRole('admin', 'superadmin'), async (req, res) => {
  try {
    const user = await User.findByIdAndDelete(req.params.id);
    res.json({ message: 'User deleted successfully', user: { _id: user._id, email: user.email } });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// --- Product Endpoints ---
app.get('/api/products', async (req, res) => {
  try {
    res.json(await Product.find());
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get a single product by MongoDB id
app.get('/api/products/:id', async (req, res) => {
  try {
    const product = await Product.findById(req.params.id);
    if (!product) {
      return res.status(404).json({ error: 'Product not found' });
    }
    res.json(product);
  } catch (err) {
    // Invalid ObjectId format or other lookup error
    res.status(400).json({ error: 'Invalid product id' });
  }
});

app.post('/api/products', async (req, res) => {
  try {
    res.json(await new Product(req.body).save());
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});
app.put('/api/products/:id', async (req, res) => {
  try {
    res.json(await Product.findByIdAndUpdate(req.params.id, req.body, { new: true }));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});
app.delete('/api/products/:id', async (req, res) => {
  try {
    res.json(await Product.findByIdAndDelete(req.params.id));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// --- Image Upload Endpoint (Cloudinary) with Compression ---
// POST /api/uploads/images  (multipart/form-data, field name: images)
app.post('/api/uploads/images', verifyToken, upload.array('images', 10), async (req, res) => {
  try {
    if (!process.env.CLOUDINARY_CLOUD_NAME) {
      return res.status(500).json({ error: 'Cloudinary is not configured' });
    }

    const files = req.files || [];
    if (!files.length) {
      return res.status(400).json({ error: 'No files uploaded' });
    }

    // Validate all images first
    const validationResults = await Promise.all(
      files.map(f => validateImage(f.buffer))
    );

    const invalidImages = validationResults.filter(r => !r.valid);
    if (invalidImages.length > 0) {
      return res.status(400).json({ 
        error: 'Invalid images detected',
        details: invalidImages.map(r => r.error)
      });
    }

    // Upload with compression
    const uploaded = await Promise.all(
      files.map((f) => uploadBufferToCloudinary(f.buffer, 'clothingstore/products', {
        maxWidth: 1200,
        maxHeight: 1200,
        quality: 85
      }))
    );

    const urls = uploaded.map((u) => u.secure_url);
    res.json({ 
      urls,
      count: urls.length,
      message: 'Images uploaded and compressed successfully'
    });
  } catch (err) {
    console.error('Image upload error:', err);
    res.status(500).json({ error: err.message });
  }
});

// --- Export products as CSV ---
app.get('/api/products/export/csv', async (req, res) => {
  try {
    const products = await Product.find().lean();

    const rows = products.map((p) => ({
      name: p.name || '',
      description: p.description || '',
      category: p.category || '',
      sub_category: p.sub_category || '',
      price: p.price ?? 0,
      discount: p.discount ?? 0,
      image: Array.isArray(p.image) ? p.image.join('|') : '',
      sizes: Array.isArray(p.sizes) ? p.sizes.join('|') : '',
      colors: Array.isArray(p.colors) ? p.colors.join('|') : '',
      stock_S: p.stock?.S ?? 0,
      stock_M: p.stock?.M ?? 0,
      stock_L: p.stock?.L ?? 0,
      stock_XL: p.stock?.XL ?? 0
    }));

    const fields = Object.keys(rows[0] || {
      name: '', description: '', category: '', sub_category: '',
      price: 0, discount: 0, image: '', sizes: '', colors: '',
      stock_S: 0, stock_M: 0, stock_L: 0, stock_XL: 0
    });

    const parser = new Parser({ fields });
    const csv = parser.parse(rows);

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename=\"products.csv\"');
    res.status(200).send(csv);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// --- Import products from CSV (upsert by name+category) ---
// POST /api/products/import/csv (multipart/form-data, field name: file)
app.post('/api/products/import/csv', upload.single('file'), async (req, res) => {
  try {
    if (!req.file?.buffer) {
      return res.status(400).json({ error: 'CSV file is required (field name: file)' });
    }

    // Some tools (Excel, Windows PowerShell) write UTF-8 CSVs with a BOM.
    // If present, the first header becomes "\ufeffname" instead of "name".
    const csvText = req.file.buffer.toString('utf-8').replace(/^\uFEFF/, '');

    const records = parse(csvText, {
      columns: true,
      skip_empty_lines: true,
      trim: true
    });

    let inserted = 0;
    let updated = 0;
    const errors = [];

    for (let i = 0; i < records.length; i++) {
      const rowNumber = i + 2; // +2 because row 1 is header
      const r = records[i];

      try {
        const name = (r.name || '').trim();
        const category = (r.category || '').trim();
        const price = Number(r.price || 0);

        if (!name || !category || Number.isNaN(price) || price <= 0) {
          throw new Error('Missing/invalid required fields: name, category, price');
        }

        const payload = {
          name,
          description: r.description || '',
          category,
          sub_category: r.sub_category || '',
          price,
          discount: Number(r.discount || 0),
          image: (r.image || '').split('|').map(s => s.trim()).filter(Boolean),
          sizes: (r.sizes || '').split('|').map(s => s.trim()).filter(Boolean),
          colors: (r.colors || '').split('|').map(s => s.trim()).filter(Boolean),
          stock: {
            S: Number(r.stock_S || 0),
            M: Number(r.stock_M || 0),
            L: Number(r.stock_L || 0),
            XL: Number(r.stock_XL || 0)
          }
        };

        const existing = await Product.findOne({ name, category }).select('_id').lean();

        await Product.findOneAndUpdate(
          { name, category },
          { $set: payload },
          { upsert: true, new: true, setDefaultsOnInsert: true }
        );

        if (existing) updated++;
        else inserted++;
      } catch (e) {
        errors.push({ rowNumber, message: e.message });
      }
    }

    res.json({
      message: 'CSV import completed',
      inserted,
      updated,
      failed: errors.length,
      errors
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// --- Order Endpoints ---
app.get('/api/orders', async (req, res) => {
  try {
    res.json(await Order.find());
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});
app.post('/api/orders', async (req, res) => {
  try {
    res.json(await new Order(req.body).save());
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});
app.put('/api/orders/:id', async (req, res) => {
  try {
    res.json(await Order.findByIdAndUpdate(req.params.id, req.body, { new: true }));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});
app.delete('/api/orders/:id', async (req, res) => {
  try {
    res.json(await Order.findByIdAndDelete(req.params.id));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// --- Inventory Endpoints ---
app.get('/api/inventory', async (req, res) => {
  try {
    res.json(await Inventory.find());
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});
app.post('/api/inventory', async (req, res) => {
  try {
    res.json(await new Inventory(req.body).save());
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});
app.put('/api/inventory/:id', async (req, res) => {
  try {
    res.json(await Inventory.findByIdAndUpdate(req.params.id, req.body, { new: true }));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});
app.delete('/api/inventory/:id', async (req, res) => {
  try {
    res.json(await Inventory.findByIdAndDelete(req.params.id));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// --- Financial Endpoints ---
app.get('/api/financials', async (req, res) => {
  try {
    res.json(await Financial.find());
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});
app.post('/api/financials', async (req, res) => {
  try {
    res.json(await new Financial(req.body).save());
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});
app.put('/api/financials/:id', async (req, res) => {
  try {
    res.json(await Financial.findByIdAndUpdate(req.params.id, req.body, { new: true }));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});
app.delete('/api/financials/:id', async (req, res) => {
  try {
    res.json(await Financial.findByIdAndDelete(req.params.id));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ==========================================
// OTP ENDPOINTS FOR EMAIL VERIFICATION
// ==========================================

/**
 * Step 1: Send OTP for registration
 * POST /api/auth/send-registration-otp
 * Body: { email, full_name }
 */
app.post('/api/auth/send-registration-otp', async (req, res) => {
  try {
    const { email, full_name } = req.body;

    if (!email) {
      return res.status(400).json({ error: 'Email is required' });
    }

    // Check if user already exists
    const existingUser = await User.findOne({ email: email.toLowerCase() });
    if (existingUser) {
      return res.status(400).json({ error: 'Email already registered' });
    }

    // Generate 6-digit OTP
    const otp = generateOTP();

    // Delete any existing unverified OTPs for this email/purpose
    await OTP.deleteMany({ 
      email: email.toLowerCase(), 
      purpose: 'registration',
      verified: false
    });

    // Store OTP in database with 10-minute expiry
    const otpDoc = new OTP({
      email: email.toLowerCase(),
      otp,
      purpose: 'registration',
      expiresAt: new Date(Date.now() + 10 * 60 * 1000) // 10 minutes
    });
    await otpDoc.save();

    // Send OTP via email
    await sendRegistrationOTP(email, otp, full_name);

    res.json({ 
      success: true,
      message: 'OTP sent to your email',
      expiresIn: 600 // seconds
    });
  } catch (err) {
    console.error('Error sending registration OTP:', err);
    res.status(500).json({ error: 'Failed to send OTP. Please try again.' });
  }
});

/**
 * Step 2: Verify OTP and complete registration
 * POST /api/auth/verify-registration-otp
 * Body: { email, otp, password, full_name, phone, address }
 */
app.post('/api/auth/verify-registration-otp', async (req, res) => {
  try {
    const { email, otp, password, full_name, phone, address } = req.body;

    if (!email || !otp || !password) {
      return res.status(400).json({ error: 'Email, OTP, and password are required' });
    }

    // Find OTP record
    const otpRecord = await OTP.findOne({
      email: email.toLowerCase(),
      purpose: 'registration',
      verified: false,
      expiresAt: { $gt: new Date() }
    });

    if (!otpRecord) {
      return res.status(400).json({ error: 'Invalid or expired OTP' });
    }

    // Check attempts (max 5 attempts)
    if (otpRecord.attempts >= 5) {
      await OTP.deleteOne({ _id: otpRecord._id });
      return res.status(429).json({ error: 'Too many failed attempts. Please request a new OTP.' });
    }

    // Verify OTP
    if (otpRecord.otp !== otp) {
      otpRecord.attempts += 1;
      await otpRecord.save();
      return res.status(400).json({ 
        error: 'Invalid OTP',
        attemptsLeft: 5 - otpRecord.attempts
      });
    }

    // Mark OTP as verified
    otpRecord.verified = true;
    await otpRecord.save();

    // Check again if user was created in the meantime
    const existingUser = await User.findOne({ email: email.toLowerCase() });
    if (existingUser) {
      return res.status(400).json({ error: 'Email already registered' });
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Create user
    const user = new User({
      email: email.toLowerCase(),
      password: hashedPassword,
      full_name,
      phone,
      role: 'customer',
      address: address || {}
    });

    await user.save();

    // Generate JWT token
    const token = generateToken(user._id, user.role);

    // Clean up verified OTP
    await OTP.deleteOne({ _id: otpRecord._id });

    res.status(201).json({ 
      success: true,
      message: 'Registration successful',
      token,
      user: {
        userId: user._id,
        email: user.email,
        full_name: user.full_name,
        role: user.role
      }
    });
  } catch (err) {
    console.error('Error verifying registration OTP:', err);
    res.status(500).json({ error: 'Registration failed. Please try again.' });
  }
});

/**
 * Step 1: Send OTP for password reset
 * POST /api/auth/forgot-password
 * Body: { email }
 */
app.post('/api/auth/forgot-password', async (req, res) => {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({ error: 'Email is required' });
    }

    // Find user
    const user = await User.findOne({ email: email.toLowerCase() });
    if (!user) {
      // Don't reveal if email exists or not (security)
      return res.json({ 
        success: true,
        message: 'If an account exists with this email, you will receive a password reset OTP.'
      });
    }

    // Generate 6-digit OTP
    const otp = generateOTP();

    // Delete any existing unverified OTPs for this email/purpose
    await OTP.deleteMany({ 
      email: email.toLowerCase(), 
      purpose: 'password-reset',
      verified: false
    });

    // Store OTP in database with 10-minute expiry
    const otpDoc = new OTP({
      email: email.toLowerCase(),
      otp,
      purpose: 'password-reset',
      expiresAt: new Date(Date.now() + 10 * 60 * 1000) // 10 minutes
    });
    await otpDoc.save();

    // Send OTP via email
    await sendPasswordResetOTP(email, otp, user.full_name);

    res.json({ 
      success: true,
      message: 'If an account exists with this email, you will receive a password reset OTP.',
      expiresIn: 600 // seconds
    });
  } catch (err) {
    console.error('Error sending password reset OTP:', err);
    res.status(500).json({ error: 'Failed to send OTP. Please try again.' });
  }
});

/**
 * Step 2: Verify OTP for password reset
 * POST /api/auth/verify-reset-otp
 * Body: { email, otp }
 */
app.post('/api/auth/verify-reset-otp', async (req, res) => {
  try {
    const { email, otp } = req.body;

    if (!email || !otp) {
      return res.status(400).json({ error: 'Email and OTP are required' });
    }

    // Find OTP record
    const otpRecord = await OTP.findOne({
      email: email.toLowerCase(),
      purpose: 'password-reset',
      verified: false,
      expiresAt: { $gt: new Date() }
    });

    if (!otpRecord) {
      return res.status(400).json({ error: 'Invalid or expired OTP' });
    }

    // Check attempts
    if (otpRecord.attempts >= 5) {
      await OTP.deleteOne({ _id: otpRecord._id });
      return res.status(429).json({ error: 'Too many failed attempts. Please request a new OTP.' });
    }

    // Verify OTP
    if (otpRecord.otp !== otp) {
      otpRecord.attempts += 1;
      await otpRecord.save();
      return res.status(400).json({ 
        error: 'Invalid OTP',
        attemptsLeft: 5 - otpRecord.attempts
      });
    }

    // Mark OTP as verified
    otpRecord.verified = true;
    await otpRecord.save();

    res.json({ 
      success: true,
      message: 'OTP verified successfully. You can now reset your password.',
      resetToken: otpRecord._id // Use OTP ID as temporary reset token
    });
  } catch (err) {
    console.error('Error verifying reset OTP:', err);
    res.status(500).json({ error: 'Failed to verify OTP. Please try again.' });
  }
});

/**
 * Step 3: Reset password with verified OTP
 * POST /api/auth/reset-password
 * Body: { resetToken, newPassword }
 */
app.post('/api/auth/reset-password', async (req, res) => {
  try {
    const { resetToken, newPassword } = req.body;

    if (!resetToken || !newPassword) {
      return res.status(400).json({ error: 'Reset token and new password are required' });
    }

    if (newPassword.length < 6) {
      return res.status(400).json({ error: 'Password must be at least 6 characters long' });
    }

    // Find verified OTP record
    const otpRecord = await OTP.findOne({
      _id: resetToken,
      purpose: 'password-reset',
      verified: true,
      expiresAt: { $gt: new Date() }
    });

    if (!otpRecord) {
      return res.status(400).json({ error: 'Invalid or expired reset token' });
    }

    // Find user
    const user = await User.findOne({ email: otpRecord.email });
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Hash new password
    const hashedPassword = await bcrypt.hash(newPassword, 10);

    // Update password
    user.password = hashedPassword;
    await user.save();

    // Delete used OTP
    await OTP.deleteOne({ _id: otpRecord._id });

    res.json({ 
      success: true,
      message: 'Password reset successful. You can now login with your new password.'
    });
  } catch (err) {
    console.error('Error resetting password:', err);
    res.status(500).json({ error: 'Failed to reset password. Please try again.' });
  }
});

// ==========================================
// ORIGINAL AUTH ENDPOINTS (for backward compatibility)
// ==========================================

// --- Auth Endpoints with JWT ---
app.post('/api/auth/register', async (req, res) => {
  try {
    const { email, password, full_name, phone, role } = req.body;

    // Check if user already exists
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json({ error: 'Email already registered' });
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Create user with customer role by default (unless specified)
    const user = new User({
      email,
      password: hashedPassword,
      full_name,
      phone,
      role: role || 'customer',
      address: req.body.address || {}
    });

    await user.save();

    // Generate JWT token
    const token = generateToken(user._id, user.role);

    res.status(201).json({ 
      message: 'User registered successfully',
      token,
      user: {
        userId: user._id,
        email: user.email,
        full_name: user.full_name,
        role: user.role
      }
    });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.post('/api/auth/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    
    console.log('🔐 Login attempt:', { email, passwordLength: password?.length });

    // Find user by email
    const user = await User.findOne({ email });
    if (!user) {
      console.log('❌ User not found:', email);
      return res.status(401).json({ error: 'Invalid credentials' });
    }
    
    console.log('✅ User found:', { email: user.email, role: user.role });

    // Compare password with hashed password
    const isValidPassword = await bcrypt.compare(password, user.password);
    console.log('🔑 Password valid:', isValidPassword);
    
    if (!isValidPassword) {
      console.log('❌ Invalid password for:', email);
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    // Generate JWT token
    const token = generateToken(user._id, user.role);
    console.log('✅ Login successful:', { email: user.email, role: user.role });

    res.json({ 
      message: 'Login successful',
      token,
      user: {
        userId: user._id,
        email: user.email,
        full_name: user.full_name,
        role: user.role
      }
    });
  } catch (err) {
    console.error('❌ Login error:', err);
    res.status(500).json({ error: err.message });
  }
});

// Verify token endpoint
app.get('/api/auth/verify', verifyToken, async (req, res) => {
  try {
    const user = await User.findById(req.user.userId).select('-password');
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    res.json({ 
      valid: true,
      user: {
        userId: user._id,
        email: user.email,
        full_name: user.full_name,
        role: user.role
      }
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// --- Global Error Handler ---
app.use((err, req, res, next) => {
  console.error('Error:', err);
  
  // Multer file upload errors
  if (err instanceof multer.MulterError) {
    if (err.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({ error: 'File size exceeds 10MB limit' });
    }
    if (err.code === 'LIMIT_FILE_COUNT') {
      return res.status(400).json({ error: 'Too many files. Maximum 10 files allowed' });
    }
    return res.status(400).json({ error: err.message });
  }
  
  // Custom errors
  if (err.message.includes('Only image files')) {
    return res.status(400).json({ error: err.message });
  }
  
  // Default error
  res.status(500).json({ error: 'Internal server error' });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
  console.log(`📚 API Documentation: server/API_DOCUMENTATION.md`);
});
