const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });

const multer = require('multer');
const { v2: cloudinary } = require('cloudinary');

const { Parser } = require('json2csv');
const { parse } = require('csv-parse/sync');


// Import models
const User = require('./models/user');
const Product = require('./models/product');
const Order = require('./models/order');
const Inventory = require('./models/inventory');
const Financial = require('./models/financial');

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
  limits: { fileSize: 5 * 1024 * 1024 } // 5MB per file
});

// Helper: upload a buffer to Cloudinary
function uploadBufferToCloudinary(buffer, folder) {
  return new Promise((resolve, reject) => {
    const uploadStream = cloudinary.uploader.upload_stream(
      { folder },
      (error, result) => {
        if (error) return reject(error);
        resolve(result);
      }
    );
    uploadStream.end(buffer);
  });
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


// --- User Endpoints ---
app.get('/api/users', async (req, res) => {
  try {
    res.json(await User.find());
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});
app.post('/api/users', async (req, res) => {
  try {
    res.json(await new User(req.body).save());
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});
app.put('/api/users/:id', async (req, res) => {
  try {
    res.json(await User.findByIdAndUpdate(req.params.id, req.body, { new: true }));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});
app.delete('/api/users/:id', async (req, res) => {
  try {
    res.json(await User.findByIdAndDelete(req.params.id));
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

// --- Image Upload Endpoint (Cloudinary) ---
// POST /api/uploads/images  (multipart/form-data, field name: images)
app.post('/api/uploads/images', upload.array('images', 10), async (req, res) => {
  try {
    if (!process.env.CLOUDINARY_CLOUD_NAME) {
      return res.status(500).json({ error: 'Cloudinary is not configured' });
    }

    const files = req.files || [];
    if (!files.length) {
      return res.status(400).json({ error: 'No files uploaded' });
    }

    const uploaded = await Promise.all(
      files.map((f) => uploadBufferToCloudinary(f.buffer, 'clothingstore/products'))
    );

    const urls = uploaded.map((u) => u.secure_url);
    res.json({ urls });
  } catch (err) {
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

// --- Auth Endpoints ---
app.post('/api/auth/register', async (req, res) => {
  try {
    const user = new User(req.body);
    await user.save();
    res.json({ message: 'User registered successfully', userId: user._id, role: user.role });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.post('/api/auth/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    const user = await User.findOne({ email, password });
    if (!user) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }
    res.json({ message: 'Login successful', userId: user._id, role: user.role, user: { full_name: user.full_name, email: user.email } });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));