const express = require('express');
const router = express.Router();
const multer = require('multer');
const { v2: cloudinary } = require('cloudinary');
const { Parser } = require('json2csv');
const { parse } = require('csv-parse/sync');

const Product = require('../models/product');
const { verifyToken } = require('../middleware/auth');
const { validateImage } = require('../utils/imageProcessor');

const Order = require('../models/order');

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024, files: 10 },
  fileFilter: (req, file, cb) => {
    if (!file.mimetype.startsWith('image/')) {
      return cb(new Error('Only image files are allowed'), false);
    }
    cb(null, true);
  }
});

// Upload buffer to Cloudinary with compression
async function uploadBufferToCloudinary(buffer, folder, options = {}) {
  return new Promise((resolve, reject) => {
    const { maxWidth = 1200, maxHeight = 1200, quality = 85 } = options;
    const uploadStream = cloudinary.uploader.upload_stream(
      { folder, transformation: [{ width: maxWidth, height: maxHeight, crop: 'limit', quality }] },
      (error, result) => {
        if (error) reject(error);
        else resolve(result);
      }
    );
    uploadStream.end(buffer);
  });
}

// Create product
router.post('/', async (req, res) => {
  try {
    res.json(await new Product(req.body).save());
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Upload images
router.post('/uploads/images', verifyToken, upload.array('images', 10), async (req, res) => {
  try {
    if (!process.env.CLOUDINARY_CLOUD_NAME) {
      return res.status(500).json({ error: 'Cloudinary is not configured' });
    }

    const files = req.files || [];
    if (!files.length) {
      return res.status(400).json({ error: 'No files uploaded' });
    }

    const validationResults = await Promise.all(files.map(f => validateImage(f.buffer)));
    const invalidImages = validationResults.filter(r => !r.valid);
    if (invalidImages.length > 0) {
      return res.status(400).json({ 
        error: 'Invalid images detected',
        details: invalidImages.map(r => r.error)
      });
    }

    const uploaded = await Promise.all(
      files.map((f) => uploadBufferToCloudinary(f.buffer, 'clothingstore/products', {
        maxWidth: 1200, maxHeight: 1200, quality: 85
      }))
    );

    res.json({ 
      urls: uploaded.map((u) => u.secure_url),
      count: uploaded.length,
      message: 'Images uploaded and compressed successfully'
    });
  } catch (err) {
    console.error('Image upload error:', err);
    res.status(500).json({ error: err.message });
  }
});

// Export products as CSV
router.get('/export/csv', async (req, res) => {
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
    res.setHeader('Content-Disposition', 'attachment; filename="products.csv"');
    res.status(200).send(csv);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Import products from CSV
router.post('/import/csv', upload.single('file'), async (req, res) => {
  try {
    if (!req.file?.buffer) {
      return res.status(400).json({ error: 'CSV file is required' });
    }

    const csvText = req.file.buffer.toString('utf-8').replace(/^\uFEFF/, '');
    const records = parse(csvText, { columns: true, skip_empty_lines: true, trim: true });

    let inserted = 0, updated = 0;
    const errors = [];

    for (let i = 0; i < records.length; i++) {
      const rowNumber = i + 2;
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

        existing ? updated++ : inserted++;
      } catch (e) {
        errors.push({ rowNumber, message: e.message });
      }
    }

    res.json({ message: 'CSV import completed', inserted, updated, failed: errors.length, errors });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get all products (supports search/filter/sort/pagination)
router.get('/', async (req, res) => {
  try {
    const qRaw = String(req.query.q || '').trim();
    const q = qRaw.length ? qRaw : '';

    const category = String(req.query.category || '').trim();
    const subCategory = String(req.query.sub_category || '').trim();
    const size = String(req.query.size || '').trim();

    const minPrice = req.query.minPrice !== undefined ? Number(req.query.minPrice) : undefined;
    const maxPrice = req.query.maxPrice !== undefined ? Number(req.query.maxPrice) : undefined;

    const sort = String(req.query.sort || '').trim(); // price_asc | price_desc | newest | popular
    const page = Math.max(1, Number(req.query.page || 1));
    const limit = Math.min(50, Math.max(1, Number(req.query.limit || 50)));
    const skip = (page - 1) * limit;

    // Base filter for non-popular queries
    const filter = {};
    if (category) filter.category = category;
    if (subCategory) filter.sub_category = subCategory;
    if (size) filter.sizes = size;

    if (!Number.isNaN(minPrice) && minPrice !== undefined) filter.price = { ...(filter.price || {}), $gte: minPrice };
    if (!Number.isNaN(maxPrice) && maxPrice !== undefined) filter.price = { ...(filter.price || {}), $lte: maxPrice };

    if (q) {
      filter.$or = [
        { name: { $regex: q, $options: 'i' } },
        { description: { $regex: q, $options: 'i' } },
        { category: { $regex: q, $options: 'i' } },
        { sub_category: { $regex: q, $options: 'i' } }
      ];
    }

    if (sort === 'popular') {
      // Popularity based on orders (exclude cancelled)
      const productMatch = {};
      if (category) productMatch['product.category'] = category;
      if (subCategory) productMatch['product.sub_category'] = subCategory;
      if (size) productMatch['product.sizes'] = size;

      if (!Number.isNaN(minPrice) && minPrice !== undefined) {
        productMatch['product.price'] = { ...(productMatch['product.price'] || {}), $gte: minPrice };
      }
      if (!Number.isNaN(maxPrice) && maxPrice !== undefined) {
        productMatch['product.price'] = { ...(productMatch['product.price'] || {}), $lte: maxPrice };
      }

      if (q) {
        productMatch.$or = [
          { 'product.name': { $regex: q, $options: 'i' } },
          { 'product.description': { $regex: q, $options: 'i' } },
          { 'product.category': { $regex: q, $options: 'i' } },
          { 'product.sub_category': { $regex: q, $options: 'i' } }
        ];
      }

      const pipeline = [
        { $match: { status: { $ne: 'cancelled' } } },
        { $unwind: '$items' },
        { $group: { _id: '$items.product_id', soldCount: { $sum: '$items.quantity' } } },
        { $sort: { soldCount: -1 } },
        {
          $lookup: {
            from: 'products',
            localField: '_id',
            foreignField: '_id',
            as: 'product'
          }
        },
        { $unwind: '$product' },
        ...(Object.keys(productMatch).length ? [{ $match: productMatch }] : []),
        { $skip: skip },
        { $limit: limit },
        {
          $replaceRoot: {
            newRoot: { $mergeObjects: ['$product', { soldCount: '$soldCount' }] }
          }
        }
      ];

      const popularProducts = await Order.aggregate(pipeline);
      return res.json(popularProducts);
    }

    // Non-popular sort
    let sortSpec = {};
    if (sort === 'price_asc') sortSpec = { price: 1 };
    else if (sort === 'price_desc') sortSpec = { price: -1 };
    else if (sort === 'newest') sortSpec = { createdAt: -1 };
    else sortSpec = { createdAt: -1 }; // default

    const products = await Product.find(filter).sort(sortSpec).skip(skip).limit(limit);
    res.json(products);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Autocomplete search (small payload)
router.get('/search', async (req, res) => {
  try {
    const q = String(req.query.q || '').trim();
    const limit = Math.min(20, Math.max(1, Number(req.query.limit || 8)));

    if (q.length < 2) return res.json([]);

    const results = await Product.find({
      name: { $regex: q, $options: 'i' }
    })
      .select('_id name price image category')
      .limit(limit)
      .lean();

    res.json(results);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get single product
router.get('/:id', async (req, res) => {
  try {
    const product = await Product.findById(req.params.id);
    if (!product) {
      return res.status(404).json({ error: 'Product not found' });
    }
    res.json(product);
  } catch (err) {
    res.status(400).json({ error: 'Invalid product id' });
  }
});

// Update product
router.put('/:id', async (req, res) => {
  try {
    res.json(await Product.findByIdAndUpdate(req.params.id, req.body, { new: true }));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Delete product
router.delete('/:id', async (req, res) => {
  try {
    res.json(await Product.findByIdAndDelete(req.params.id));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
