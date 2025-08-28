const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
require('dotenv').config();


// Import models
const User = require('./models/user');
const Product = require('./models/product');
const Order = require('./models/order');
const Inventory = require('./models/inventory');
const Financial = require('./models/financial');

const app = express();
app.use(express.json());
app.use(cors());

// Connect to MongoDB (replace with your connection string)
mongoose.connect(process.env.MONGO_URI)
  .then(() => console.log("✅ MongoDB Connected"))
  .catch(err => console.error("❌ MongoDB connection error:", err));


// test connection
app.get("/test-db", async (req, res) => {
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