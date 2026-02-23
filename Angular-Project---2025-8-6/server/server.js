const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });

const { v2: cloudinary } = require('cloudinary');

// Import route modules
const authRoutes = require('./routes/auth.routes');
const userRoutes = require('./routes/user.routes');
const productRoutes = require('./routes/product.routes');
const orderRoutes = require('./routes/order.routes');
const inventoryRoutes = require('./routes/inventory.routes');
const restockRequestRoutes = require('./routes/restockRequest.routes');
const financialRoutes = require('./routes/financial.routes');
const reviewRoutes = require('./routes/review.routes');
const cartRoutes = require('./routes/cart.routes');
const checkoutRoutes = require('./routes/checkout.routes');
const uploadsRoutes = require('./routes/uploads.routes');
const analyticsRoutes = require('./routes/analytics.routes');
const supplierRoutes = require('./routes/supplier.routes');

const app = express();

// Security Middleware
app.use(helmet()); // Secure HTTP headers (XSS, Content-Security-Policy, etc)
app.use(cors()); // Configure CORS as needed

// Rate Limiting on authentication routes to prevent brute-force attacks
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes window
  max: 20, // limit each IP to 20 auth requests per windowMs
  message: 'Too many authentication attempts from this IP, please try again after 15 minutes',
  standardHeaders: true,
  legacyHeaders: false,
});

app.use(express.json());

// Cloudinary configuration
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET
});

// MongoDB Connection
const mongoURI = process.env.MONGO_URI;

if (!mongoURI) {
  console.error('❌ Missing MONGO_URI. This project is configured to use an online MongoDB only.');
  console.error('   Set MONGO_URI in server/.env to your MongoDB Atlas (or other remote) connection string.');
  process.exit(1);
}

if (/mongodb:\/\/localhost|mongodb:\/\/127\.0\.0\.1|@localhost|@127\.0\.0\.1/i.test(mongoURI)) {
  console.error('❌ Refusing to start: MONGO_URI points to a local MongoDB instance.');
  console.error('   Please use your online MongoDB connection string in server/.env.');
  process.exit(1);
}

mongoose
  .connect(mongoURI)
  .then(() => {
    const dbName = mongoose.connection?.db?.databaseName;
    console.log(`✅ MongoDB Connected${dbName ? ` (db: ${dbName})` : ''}`);
  })
  .catch((err) => {
    console.error('❌ MongoDB connection error:', err);
    process.exit(1);
  });

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    uptime: process.uptime(),
    timestamp: new Date().toISOString(),
    mongodb: mongoose.connection.readyState === 1 ? 'connected' : 'disconnected',
    dbName: mongoose.connection?.db?.databaseName
  });
});

// API Routes
app.use('/api/auth', authLimiter, authRoutes);
app.use('/api/user', userRoutes);
app.use('/api/products', productRoutes);
app.use('/api/orders', orderRoutes);
app.use('/api/inventory', inventoryRoutes);
app.use('/api/restock-requests', restockRequestRoutes);
app.use('/api/financials', financialRoutes);
app.use('/api/reviews', reviewRoutes);
app.use('/api/cart', cartRoutes);
app.use('/api/checkout', checkoutRoutes);
app.use('/api/uploads', uploadsRoutes);
app.use('/api/analytics', analyticsRoutes);
app.use('/api/suppliers', supplierRoutes);
app.use('/api/categories', require('./routes/category.routes')); // New
app.use('/api/collections', require('./routes/collection.routes')); // New
app.use('/api/reports', require('./routes/report.routes')); // New Reports
// Test DB endpoint (optional, for debugging)
app.get("/test-db", async (req, res) => {
  try {
    const User = require('./models/user');
    const count = await User.countDocuments();
    res.json({ message: "MongoDB connection successful", userCount: count });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({ error: 'Route not found' });
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error('❌ Server error:', err);
  res.status(500).json({ error: err.message || 'Internal server error' });
});

// Start server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log('📧 Email service: ' + (process.env.EMAIL_USER ? 'PRODUCTION MODE' : 'DEVELOPMENT MODE (console logging only)'));
  console.log(`🚀 Server running on port ${PORT}`);
  console.log('📚 API Documentation: server/API_DOCUMENTATION.md');
});
